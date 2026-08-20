/**
 * Adaptive AutoThrottle Controller (Ported from Scrapling AutoThrottle concept)
 * Dynamically tunes request delays per domain based on response latency,
 * server responsiveness, and rate-limit / block detections.
 */

class AdaptiveThrottle {
    constructor() {
        this.domainStats = new Map();
        this.defaultMinDelay = parseInt(process.env.SCRAPER_DELAY_MIN_MS || '1200', 10);
        this.defaultMaxDelay = parseInt(process.env.SCRAPER_DELAY_MAX_MS || '8000', 10);
        this.defaultTargetDelay = parseInt(process.env.SCRAPER_DELAY_TARGET_MS || '2000', 10);
    }

    _getOrCreateDomain(domain) {
        if (!this.domainStats.has(domain)) {
            this.domainStats.set(domain, {
                currentDelay: this.defaultTargetDelay,
                minDelay: this.defaultMinDelay,
                maxDelay: this.defaultMaxDelay,
                history: [], // recent response times in ms
                consecutiveSuccesses: 0,
                consecutiveBlocks: 0,
                lastRequestTime: 0
            });
        }
        return this.domainStats.get(domain);
    }

    /**
     * Record the latency and outcome of a page fetch or action
     */
    recordResponse(domain = 'google_maps', responseTimeMs = 1000, wasBlocked = false) {
        const stats = this._getOrCreateDomain(domain);
        
        stats.history.push(responseTimeMs);
        if (stats.history.length > 10) stats.history.shift();

        if (wasBlocked) {
            stats.consecutiveBlocks++;
            stats.consecutiveSuccesses = 0;
            // Exponential backoff with multiplier 1.8x
            stats.currentDelay = Math.min(stats.maxDelay, Math.max(stats.currentDelay * 1.8, 4000));
            console.log(`[AutoThrottle] Block/Rate-limit detected on ${domain}. Increasing delay to ${Math.round(stats.currentDelay)}ms`);
        } else {
            stats.consecutiveSuccesses++;
            stats.consecutiveBlocks = 0;

            // If we have 3+ consecutive fast successes, gradually reduce delay towards minDelay
            if (stats.consecutiveSuccesses >= 3 && stats.currentDelay > stats.minDelay) {
                const avgLatency = stats.history.reduce((a, b) => a + b, 0) / stats.history.length;
                // Target roughly 1.5x of average page response time, bounded by min/max
                const optimalDelay = Math.max(stats.minDelay, avgLatency * 1.2);
                stats.currentDelay = Math.max(stats.minDelay, stats.currentDelay * 0.85 + optimalDelay * 0.15);
            }
        }
    }

    /**
     * Get the adaptive wait delay with slight jitter (+- 15%)
     */
    getDelay(domain = 'google_maps') {
        const stats = this._getOrCreateDomain(domain);
        const jitter = (Math.random() * 0.3) - 0.15; // -15% to +15%
        const delay = Math.round(stats.currentDelay * (1 + jitter));
        return Math.max(stats.minDelay, Math.min(stats.maxDelay, delay));
    }

    /**
     * Async sleep for the computed adaptive delay
     */
    async wait(domain = 'google_maps') {
        const delay = this.getDelay(domain);
        return new Promise(resolve => setTimeout(resolve, delay));
    }
}

export const autoThrottle = new AdaptiveThrottle();

export function adaptiveDelay(domain = 'google_maps') {
    return autoThrottle.wait(domain);
}
