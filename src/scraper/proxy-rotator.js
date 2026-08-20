/**
 * Proxy Rotator Engine (Ported from Scrapling ProxyRotator concept)
 * Supports Cyclic (round-robin) rotation, failover health tracking,
 * and seamless integration with Playwright BrowserContexts.
 */

class ProxyRotator {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.quarantineTimeMs = 5 * 60 * 1000; // 5 minutes quarantine for dead proxies
        this.loadProxies();
    }

    loadProxies() {
        const rawList = process.env.PROXY_LIST || process.env.HTTP_PROXY || process.env.HTTPS_PROXY || '';
        if (!rawList.trim()) {
            this.proxies = [];
            return;
        }

        const items = rawList.split(',').map(s => s.trim()).filter(Boolean);
        this.proxies = items.map((p, idx) => {
            const parsed = this._parseProxy(p);
            return {
                id: idx,
                raw: p,
                server: parsed.server,
                username: parsed.username,
                password: parsed.password,
                failCount: 0,
                successCount: 0,
                quarantinedUntil: 0
            };
        });

        if (this.proxies.length > 0) {
            console.log(`[ProxyRotator] Loaded ${this.proxies.length} proxies.`);
        }
    }

    _parseProxy(proxyStr) {
        try {
            // Handle formats: http://user:pass@host:port or host:port:user:pass or host:port
            if (proxyStr.includes('://')) {
                const url = new URL(proxyStr);
                return {
                    server: `${url.protocol}//${url.host}`,
                    username: url.username ? decodeURIComponent(url.username) : undefined,
                    password: url.password ? decodeURIComponent(url.password) : undefined
                };
            }

            const parts = proxyStr.split(':');
            if (parts.length === 4) {
                // host:port:user:pass
                return {
                    server: `http://${parts[0]}:${parts[1]}`,
                    username: parts[2],
                    password: parts[3]
                };
            }

            return {
                server: proxyStr.startsWith('http') ? proxyStr : `http://${proxyStr}`,
                username: undefined,
                password: undefined
            };
        } catch (e) {
            return { server: proxyStr };
        }
    }

    /**
     * Get next available healthy proxy
     */
    getNextProxy() {
        if (this.proxies.length === 0) return null;

        const now = Date.now();
        const available = this.proxies.filter(p => p.quarantinedUntil <= now);

        if (available.length === 0) {
            console.warn('[ProxyRotator] All proxies currently quarantined. Falling back to direct connection.');
            return null;
        }

        this.currentIndex = (this.currentIndex + 1) % available.length;
        const selected = available[this.currentIndex];
        
        return {
            server: selected.server,
            username: selected.username,
            password: selected.password,
            id: selected.id
        };
    }

    /**
     * Report proxy outcome
     */
    reportResult(proxyId, isSuccess) {
        if (proxyId === undefined || proxyId === null) return;
        const target = this.proxies.find(p => p.id === proxyId);
        if (!target) return;

        if (isSuccess) {
            target.successCount++;
            target.failCount = 0;
        } else {
            target.failCount++;
            if (target.failCount >= 3) {
                target.quarantinedUntil = Date.now() + this.quarantineTimeMs;
                console.warn(`[ProxyRotator] Quarantining proxy ${target.server} for 5m due to ${target.failCount} consecutive failures.`);
            }
        }
    }

    hasProxies() {
        return this.proxies.length > 0;
    }
}

export const proxyRotator = new ProxyRotator();
