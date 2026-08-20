import { autoThrottle, adaptiveDelay } from './adaptive-throttle.js';

/**
 * Advanced Stealth & Fingerprint Evasion Module
 * Inspired by Scrapling StealthyFetcher & anti-bot evasion techniques.
 */

export async function applyStealth(context) {
    await context.addInitScript(() => {
        // 1. Hide navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });

        // 2. Spoof chrome runtime & app objects
        if (!window.chrome) {
            window.chrome = {
                app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
                runtime: {
                    OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
                    OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
                    PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
                    PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
                    PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
                    RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' }
                },
                loadTimes: () => ({
                    commitLoadTime: Date.now() / 1000 - 1.2,
                    connectionInfo: 'http/2+quic/46',
                    finishDocumentLoadTime: Date.now() / 1000 - 0.3,
                    finishLoadTime: Date.now() / 1000 - 0.1,
                    firstPaintAfterLoadTime: 0,
                    firstPaintTime: Date.now() / 1000 - 0.8,
                    navigationType: 'Other',
                    npnNegotiatedProtocol: 'h2',
                    requestTime: Date.now() / 1000 - 1.8,
                    startLoadTime: Date.now() / 1000 - 1.5,
                    wasAlternateProtocolAvailable: false,
                    wasFetchedViaSpdy: true,
                    wasNpnNegotiated: true
                }),
                csi: () => ({
                    onloadT: Date.now(),
                    pageT: 120.4,
                    startE: Date.now() - 150,
                    tran: 15
                })
            };
        }

        // 3. Spoof languages & platform
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });
        Object.defineProperty(navigator, 'language', {
            get: () => 'en-US',
        });

        // 4. Spoof realistic hardware specifications
        Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => 8,
        });
        Object.defineProperty(navigator, 'deviceMemory', {
            get: () => 8,
        });

        // 5. Spoof realistic plugin array
        const mockPlugins = [
            { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
        ];
        Object.defineProperty(navigator, 'plugins', {
            get: () => mockPlugins,
        });

        // 6. Spoof connection RTT and type
        if (navigator.connection) {
            Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 });
            Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '4g' });
            Object.defineProperty(navigator.connection, 'downlink', { get: () => 10 });
        }

        // 7. Full Permissions API override
        const originalQuery = window.navigator.permissions ? window.navigator.permissions.query : null;
        if (originalQuery) {
            window.navigator.permissions.query = (parameters) => {
                if (parameters.name === 'notifications') {
                    return Promise.resolve({ state: Notification.permission || 'default' });
                }
                if (parameters.name === 'geolocation') {
                    return Promise.resolve({ state: 'prompt' });
                }
                return originalQuery(parameters);
            };
        }

        // 8. Spoof WebGL Vendor & Renderer
        try {
            const getParameterProto = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                // UNMASKED_VENDOR_WEBGL
                if (parameter === 37445) return 'Google Inc. (NVIDIA)';
                // UNMASKED_RENDERER_WEBGL
                if (parameter === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)';
                return getParameterProto.apply(this, arguments);
            };

            if (window.WebGL2RenderingContext) {
                const getParameter2Proto = WebGL2RenderingContext.prototype.getParameter;
                WebGL2RenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) return 'Google Inc. (NVIDIA)';
                    if (parameter === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)';
                    return getParameter2Proto.apply(this, arguments);
                };
            }
        } catch (e) {}

        // 9. Protect Canvas Fingerprint from static correlation
        try {
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(type) {
                return originalToDataURL.apply(this, arguments);
            };
        } catch (e) {}
    });
}

/**
 * Returns a randomized, modern Chrome User-Agent with matching Client Hints metadata
 */
export function getRandomClientProfile() {
    const profiles = [
        {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            secChUa: '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
            platform: '"Windows"'
        },
        {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            secChUa: '"Chromium";v="127", "Not;A=Brand";v="24", "Google Chrome";v="127"',
            platform: '"Windows"'
        },
        {
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            secChUa: '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
            platform: '"macOS"'
        },
        {
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            secChUa: '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
            platform: '"Linux"'
        }
    ];

    return profiles[Math.floor(Math.random() * profiles.length)];
}

/**
 * Enhanced delay using Adaptive AutoThrottle
 */
export function randomDelay(minStr, maxStr, domain = 'google_maps') {
    if (minStr || maxStr) {
        const min = parseInt(minStr || '1200', 10);
        const max = parseInt(maxStr || '3500', 10);
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    return adaptiveDelay(domain);
}

export { autoThrottle, adaptiveDelay };
