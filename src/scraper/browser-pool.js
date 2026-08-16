import { chromium } from 'playwright';
import { applyStealth } from './stealth.js';

class BrowserPool {
  constructor(maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
    this.browser = null;
    this.contexts = [];
    this.availableContexts = [];
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    // Launch a single browser instance
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    // Create the pool of contexts
    for (let i = 0; i < this.maxConcurrency; i++) {
      const context = await this.browser.newContext({
        viewport: { 
          width: 1280 + Math.floor(Math.random() * 640), 
          height: 720 + Math.floor(Math.random() * 360) 
        },
        locale: 'en-US',
        userAgent: this._getRandomUserAgent(),
        // Block images/fonts/css to speed up scraping
        ignoreHTTPSErrors: true
      });

      // Apply stealth scripts to the context
      await applyStealth(context);
      
      const contextItem = { id: i, context, inUse: false };
      this.contexts.push(contextItem);
      this.availableContexts.push(contextItem);
    }
    
    this.isInitialized = true;
    console.log(`Browser pool initialized with ${this.maxConcurrency} contexts.`);
  }

  _getRandomUserAgent() {
    const uas = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ];
    return uas[Math.floor(Math.random() * uas.length)];
  }

  async acquireContext() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Wait for a context to become available if all are in use
    while (this.availableContexts.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const contextItem = this.availableContexts.pop();
    contextItem.inUse = true;
    return contextItem;
  }

  releaseContext(contextItem) {
    if (contextItem && this.contexts.includes(contextItem)) {
      contextItem.inUse = false;
      this.availableContexts.push(contextItem);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.isInitialized = false;
      this.contexts = [];
      this.availableContexts = [];
      console.log('Browser pool closed.');
    }
  }
}

export const browserPool = new BrowserPool(
  parseInt(process.env.SCRAPER_CONCURRENCY || '4', 10)
);
