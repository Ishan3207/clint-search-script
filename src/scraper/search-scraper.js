import { autoThrottle, adaptiveDelay } from './adaptive-throttle.js';

/**
 * High-Speed Search Scraper for Google Maps
 * Features:
 * - Scrapling-inspired background XHR stream capture for place listings
 * - Adaptive dynamic delay tuning per scroll iteration
 * - Fast consent dialog bypass
 * - Robust feed extraction with deduplication
 */

export async function scrapeSearchResults(page, query, location, radius, maxLeads, log) {
    const searchQuery = encodeURIComponent(`${query} ${location ? `in ${location}` : ''}`.trim());
    const searchUrl = `https://www.google.com/maps/search/${searchQuery}`;
    
    if (log) log(`Navigating to Google Maps: ${searchUrl}`);
    
    let isTimeout = false;
    const timeoutId = setTimeout(() => {
        isTimeout = true;
        if (log) log('Search timeout reached (60s). Completing partial batch.', 'warn');
    }, 60000);

    const startTime = Date.now();
    const results = [];

    // Background XHR interceptor (inspired by Scrapling capture_xhr)
    page.on('response', async (response) => {
        try {
            const url = response.url();
            if (url.includes('/maps/preview/search') || url.includes('/maps/rpc/search')) {
                const text = await response.text().catch(() => '');
                // Google Maps responses prepend )]}' prefix
                const clean = text.replace(/^\)\]\}'\s*/, '');
                // Basic string scan for /maps/place/ URLs in the payload
                const matches = clean.match(/\/maps\/place\/[^"'\\]+/g);
                if (matches) {
                    for (const m of matches) {
                        const fullUrl = `https://www.google.com${m.split('\\')[0]}`;
                        if (!results.find(r => r.detailUrl === fullUrl)) {
                            // Extract title if possible from URL slug
                            const slug = m.split('/')[3] || '';
                            const name = decodeURIComponent(slug.replace(/\+/g, ' '));
                            if (name && fullUrl) {
                                results.push({ name, detailUrl: fullUrl });
                            }
                        }
                    }
                }
            }
        } catch {}
    });

    try {
        const navStart = Date.now();
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        const navLatency = Date.now() - navStart;
        autoThrottle.recordResponse('google_maps', navLatency, false);

        await adaptiveDelay('google_maps');

        // Handle Google Consent Page
        try {
            await page.context().addCookies([{
                name: 'SOCS',
                value: 'CAESHAgCEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiA_LyaBg',
                domain: '.google.com',
                path: '/'
            }]);

            const consentBtn = await page.$('button[aria-label="Accept all"], button[id*="agree"], form[action*="consent"] button');
            if (consentBtn) {
                if (log) log('Handling Google cookie consent...');
                await consentBtn.click();
                await adaptiveDelay('google_maps');
            }
        } catch {}

        let noNewResultsCount = 0;
        let previousResultCount = 0;
        let scrollCount = 0;
        const MAX_SCROLLS = 15;
        const scrollSelector = 'div[role="feed"]'; 
        
        try {
            await page.waitForSelector(scrollSelector, { timeout: 12000 });
        } catch (e) {
            // Check if it's a single direct listing page
            const currentUrl = page.url();
            if (currentUrl.includes('/maps/place/')) {
                const singleName = await page.$eval('h1', el => el.innerText.trim()).catch(() => query);
                if (log) log(`Direct single place match found: "${singleName}"`, 'success');
                clearTimeout(timeoutId);
                return [{ name: singleName, detailUrl: currentUrl }];
            }

            if (log) log("Could not find results feed or single match. Check query/location.", 'warn');
            clearTimeout(timeoutId);
            return results;
        }

        if (log) log("Found results feed. Starting extraction...");

        while (!isTimeout && scrollCount < MAX_SCROLLS) {
            if (maxLeads !== 'All' && results.length >= parseInt(maxLeads, 10)) {
                if (log) log(`Reached target lead limit: ${maxLeads}`, 'success');
                break;
            }

            const parsedItems = await page.evaluate(() => {
                const listings = [];
                const itemContainers = document.querySelectorAll('div[role="feed"] > div > div');
                
                for (const container of itemContainers) {
                    const aTag = container.querySelector('a[href*="/maps/place/"]');
                    if (!aTag) continue;
                    
                    const url = aTag.href;
                    const name = aTag.getAttribute('aria-label');
                    
                    if (name && url) {
                       listings.push({ name: name, detailUrl: url });
                    }
                }
                return listings;
            });

            for (const item of parsedItems) {
                if (!results.find(r => r.detailUrl === item.detailUrl)) {
                    results.push(item);
                }
            }

            if (log && results.length > previousResultCount) {
                log(`Collected ${results.length} unique listings (Scroll ${scrollCount + 1})...`);
            }

            if (results.length === previousResultCount) {
                noNewResultsCount++;
                if (noNewResultsCount >= 3) {
                    if (log) log("No further results detected. Reached end of scroll stream.");
                    break;
                }
            } else {
                noNewResultsCount = 0;
            }
            
            previousResultCount = results.length;

            const endOfListVisible = await page.evaluate(() => {
                const textNodes = document.evaluate(
                    "//span[contains(text(), \"You've reached the end of the list\")]",
                    document, null, XPathResult.ANY_TYPE, null
                );
                return textNodes.iterateNext() !== null;
            });

            if (endOfListVisible) {
                if (log) log("Reached end of Google Maps feed.");
                break;
            }

            // Smooth scroll feed container
            await page.evaluate((selector) => {
                const feed = document.querySelector(selector);
                if (feed) feed.scrollBy(0, 1200);
            }, scrollSelector);
            
            scrollCount++;
            await adaptiveDelay('google_maps');
        }

        if (maxLeads !== 'All' && results.length > parseInt(maxLeads, 10)) {
            return results.slice(0, parseInt(maxLeads, 10));
        }

        return results;
    } catch (err) {
        autoThrottle.recordResponse('google_maps', Date.now() - startTime, true);
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}
