import { chromium } from 'playwright';
import { applyStealth, getRandomClientProfile } from './stealth.js';
import { proxyRotator } from './proxy-rotator.js';

/**
 * High-Performance Event-Driven Browser & Context Pool
 * Features:
 * - Domain-level tracker & ad blocking (inspired by Scrapling domain blocker)
 * - Map tile & unnecessary asset filtering for 3x faster page loads
 * - FIFO Semaphore-based context acquisition (zero busy-wait polling)
 * - Per-context operation lifecycle tracking & memory leak recycling
 * - Native ProxyRotator integration
 */

const BLOCKED_DOMAINS = [
    'google-analytics.com',
    'googletagmanager.com',
    'doubleclick.net',
    'googleadservices.com',
    'adservice.google.com',
    'facebook.net',
    'connect.facebook.net',
    'clarity.ms',
    'hotjar.com',
    'segment.io',
    'scorecardresearch.com',
    'criteo.com',
    'outbrain.com',
    'taboola.com'
];

class BrowserPool {
    constructor(maxConcurrency) {
        this.maxConcurrency = maxConcurrency;
        this.browser = null;
        this.contexts = [];
        this.availableContexts = [];
        this.waitingQueue = [];
        this.isInitialized = false;
        this.maxOpsPerContext = 30; // Auto-recycle after 30 pages to prevent memory leaks
    }

    async initialize() {
        if (this.isInitialized) return;

        this.browser = await chromium.launch({
            headless: process.env.HEADLESS !== 'false',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--blink-settings=imagesEnabled=false' // Native Blink flag to disable rendering images
            ]
        });

        for (let i = 0; i < this.maxConcurrency; i++) {
            const contextItem = await this._createContext(i);
            this.contexts.push(contextItem);
            this.availableContexts.push(contextItem);
        }

        this.isInitialized = true;
        console.log(`[BrowserPool] Initialized pool with ${this.maxConcurrency} stealth contexts.`);
    }

    async _createContext(id) {
        const clientProfile = getRandomClientProfile();
        const proxyConfig = proxyRotator.getNextProxy();

        const contextOptions = {
            viewport: {
                width: 1366 + Math.floor(Math.random() * 200),
                height: 768 + Math.floor(Math.random() * 200)
            },
            locale: 'en-US',
            timezoneId: 'America/New_York',
            userAgent: clientProfile.userAgent,
            extraHTTPHeaders: {
                'sec-ch-ua': clientProfile.secChUa,
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': clientProfile.platform,
                'accept-language': 'en-US,en;q=0.9'
            },
            ignoreHTTPSErrors: true
        };

        if (proxyConfig) {
            contextOptions.proxy = {
                server: proxyConfig.server,
                username: proxyConfig.username,
                password: proxyConfig.password
            };
        }

        const context = await this.browser.newContext(contextOptions);

        // Smart route filtering: block trackers, heavy fonts/images, map vector tiles
        await context.route('**/*', (route) => {
            const request = route.request();
            const url = request.url().toLowerCase();
            const resourceType = request.resourceType();

            // 1. Block known tracker/telemetry domains
            if (BLOCKED_DOMAINS.some(domain => url.includes(domain))) {
                return route.abort();
            }

            // 2. Block heavy media and map tiles that consume massive RAM
            if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
                return route.abort();
            }

            // 3. Block Google Maps satellite raster tiles, audio, and StreetView panoramas
            if (url.includes('/maps/vt?') || url.includes('/maps/photometa') || url.includes('/maps/preview/imagery/')) {
                return route.abort();
            }

            route.continue();
        });

        await applyStealth(context);

        return {
            id,
            context,
            inUse: false,
            opCount: 0,
            proxyId: proxyConfig ? proxyConfig.id : null
        };
    }

    /**
     * Acquire a context via FIFO Semaphore Queue (Zero CPU polling)
     */
    async acquireContext() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.availableContexts.length > 0) {
            const contextItem = this.availableContexts.pop();
            contextItem.inUse = true;
            return contextItem;
        }

        // Suspend until a context is released
        return new Promise((resolve) => {
            this.waitingQueue.push(resolve);
        });
    }

    /**
     * Release a context back to the pool or dispatch to next waiting task
     */
    async releaseContext(contextItem) {
        if (!contextItem) return;

        contextItem.opCount++;

        // Auto-recycle context if it has performed too many operations
        if (contextItem.opCount >= this.maxOpsPerContext && this.browser) {
            try {
                await contextItem.context.close().catch(() => {});
                const fresh = await this._createContext(contextItem.id);
                const idx = this.contexts.findIndex(c => c.id === contextItem.id);
                if (idx !== -1) this.contexts[idx] = fresh;
                contextItem = fresh;
            } catch (e) {
                console.warn('[BrowserPool] Error recycling context:', e.message);
            }
        }

        contextItem.inUse = false;

        // If tasks are waiting in FIFO queue, dispatch immediately
        if (this.waitingQueue.length > 0) {
            const nextResolver = this.waitingQueue.shift();
            contextItem.inUse = true;
            nextResolver(contextItem);
        } else {
            this.availableContexts.push(contextItem);
        }
    }

    async close() {
        if (this.browser) {
            for (const c of this.contexts) {
                await c.context.close().catch(() => {});
            }
            await this.browser.close().catch(() => {});
            this.browser = null;
            this.isInitialized = false;
            this.contexts = [];
            this.availableContexts = [];
            this.waitingQueue = [];
            console.log('[BrowserPool] Closed all browser contexts.');
        }
    }
}

export const browserPool = new BrowserPool(
    parseInt(process.env.SCRAPER_CONCURRENCY || '4', 10)
);
