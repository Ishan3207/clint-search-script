import { autoThrottle, adaptiveDelay } from './adaptive-throttle.js';

/**
 * High-Speed Place Details & Contact Extractor
 * Features:
 * - Scrapling-inspired XHR payload interception for structured Google Maps entities
 * - Multi-attribute DOM fallback with microdata and contact link scanning
 * - Adaptive delay and latency tracking
 */

export async function scrapePlaceDetails(page, url, log) {
    if (log) log(`Navigating to detail page: ${url}`);
    
    await adaptiveDelay('google_maps');
    
    const startTime = Date.now();
    let xhrCapturedData = {};

    // Background XHR interceptor for Google Maps place preview payload
    const responseHandler = async (response) => {
        try {
            const resUrl = response.url();
            if (resUrl.includes('/maps/preview/place') || resUrl.includes('/maps/rpc/')) {
                const text = await response.text().catch(() => '');
                if (text && text.includes('@')) {
                    const emails = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
                    if (emails) {
                        const valid = emails.filter(e => !/\.(png|jpg|jpeg|gif|svg|webp|js|css)$/i.test(e) && !e.includes('google.com'));
                        if (valid.length > 0) xhrCapturedData.email = valid[0];
                    }
                }
            }
        } catch {}
    };

    page.on('response', responseHandler);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForSelector('h1', { timeout: 8000 });
        
        const latency = Date.now() - startTime;
        autoThrottle.recordResponse('google_maps', latency, false);
    } catch (e) {
        if (log) log(`Timeout or partial load for detail page: ${url}`, 'warn');
        autoThrottle.recordResponse('google_maps', Date.now() - startTime, true);
        return null;
    } finally {
        page.off('response', responseHandler);
    }

    const details = await page.evaluate((xhrData) => {
        const getElementText = (selector) => {
            const el = document.querySelector(selector);
            return el ? el.innerText.trim() : null;
        };

        const name = getElementText('h1');
        
        // 1. Phone Extraction
        let phone = null;
        const phoneLink = document.querySelector('a[href^="tel:"]');
        if (phoneLink) {
            phone = phoneLink.href.replace('tel:', '').trim();
        } else {
            const phoneBtn = document.querySelector('button[data-tooltip*="phone" i]') || 
                             document.querySelector('button[aria-label*="phone" i]') ||
                             document.querySelector('button[data-item-id*="phone"]');
            if (phoneBtn) {
                phone = phoneBtn.getAttribute('aria-label')?.replace(/phone:/i, '')?.trim() ||
                        phoneBtn.innerText?.trim();
            }
        }

        // 2. Address Extraction
        let address = null;
        const addrBtn = document.querySelector('button[data-item-id="address"]') || 
                        document.querySelector('button[aria-label*="Address" i]');
        if (addrBtn) {
            address = addrBtn.getAttribute('aria-label')?.replace(/address:/i, '')?.trim();
        }

        // 3. Website Extraction
        let website = null;
        const webLink = document.querySelector('a[data-item-id="authority"]') || 
                        document.querySelector('a[aria-label*="Website" i]') ||
                        document.querySelector('a[data-tooltip*="Website" i]');
        if (webLink) {
            website = webLink.href;
        }

        // 4. Direct Email from Google Maps pane or XHR capture
        let email = xhrData.email || null;
        if (!email) {
            const mailtoLink = document.querySelector('a[href^="mailto:"]');
            if (mailtoLink) {
                email = mailtoLink.href.replace('mailto:', '').split('?')[0].trim();
            } else {
                const emailBtn = document.querySelector('button[data-tooltip*="email" i]') || 
                                 document.querySelector('button[aria-label*="email" i]') || 
                                 document.querySelector('button[data-item-id*="email" i]');
                if (emailBtn) {
                    const label = emailBtn.getAttribute('aria-label') || emailBtn.getAttribute('data-tooltip') || '';
                    const match = label.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
                    if (match) email = match[1];
                }
            }
        }

        // Fallback text scan across details pane
        if (!email) {
            const sidebar = document.querySelector('div[role="main"]') || document.body;
            const text = sidebar ? sidebar.innerText : '';
            const matches = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
            if (matches && matches.length > 0) {
                const valid = matches.filter(m => !/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(m) && !m.includes('google.com'));
                if (valid.length > 0) email = valid[0];
            }
        }

        // 5. Rating Extraction
        let rating = null;
        const ratingSpan = document.querySelector('span[aria-hidden="true"]');
        if (ratingSpan && /^\d\.\d$/.test(ratingSpan.innerText.trim())) {
            rating = ratingSpan.innerText.trim();
        } else {
            const match = document.body ? document.body.innerText.match(/(\d\.\d)\s*stars/) : null;
            if (match) rating = match[1];
        }

        // 6. Review Count Extraction
        let reviews = null;
        const reviewBtn = document.querySelector('button[aria-label*="reviews" i]');
        if (reviewBtn) {
            const match = reviewBtn.getAttribute('aria-label')?.match(/([\d,]+)\s*reviews/i);
            if (match) reviews = match[1];
        }

        // 7. Business Category Extraction
        let category = null;
        const catBtn = document.querySelector('button[jsaction*="category"]');
        if (catBtn) {
            category = catBtn.innerText.trim();
        } else {
            const h1Parent = document.querySelector('h1')?.parentElement;
            if (h1Parent) {
                const textNodes = Array.from(h1Parent.childNodes).filter(n => n.nodeType === 3);
                if (textNodes.length > 0) category = textNodes[0].textContent.trim();
            }
        }

        return { name, category, phone, address, website, email, rating, reviews, mapsLink: window.location.href };
    }, xhrCapturedData);

    if (!details || !details.name) {
        if (log) log(`Skipping unidentifiable place at ${url}`, 'warn');
        return null;
    }

    if (log) {
        log(`Extracted: ${details.name} (Phone: ${details.phone ? '✓' : '✕'}, Email: ${details.email ? '✓' : '✕'}, Web: ${details.website ? '✓' : '✕'})`);
    }

    return details;
}
