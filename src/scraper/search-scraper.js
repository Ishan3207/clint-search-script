import { randomDelay } from './stealth.js';

export async function scrapeSearchResults(page, query, location, radius, maxLeads, log) {
    const searchQuery = encodeURIComponent(`${query} in ${location}`);
    const searchUrl = `https://www.google.com/maps/search/${searchQuery}`;
    
    if (log) log(`Navigating to Google Maps: ${searchUrl}`);
    
    // Add per-query timeout logic
    let isTimeout = false;
    const timeoutId = setTimeout(() => {
        isTimeout = true;
        if (log) log('Query timeout reached (60 seconds). Finishing early.', 'warn');
    }, 60000);

    try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await randomDelay(); // Initial load delay

        // Handle Google Consent Page
        try {
            if (log) log('Checking for Google consent page...');
            
            // Try setting cookie directly as fallback bypass
            await page.context().addCookies([{
                name: 'SOCS',
                value: 'CAESHAgCEhJnd3NfMjAyMzA4MTAtMF9SQzIaAmVuIAEaBgiA_LyaBg',
                domain: '.google.com',
                path: '/'
            }]);

            // Try multiple known selectors for the consent button
            const consentSelectors = [
                'button[aria-label="Accept all"]',
                'button[id*="agree"]',
                'form[action*="consent"] button',
                'div[role="dialog"] button'
            ];
            
            for (const selector of consentSelectors) {
                const btn = await page.$(selector);
                if (btn) {
                    if (log) log('Found consent button, clicking...');
                    await btn.click();
                    await randomDelay();
                    break;
                }
            }
        } catch (e) {
            // Ignore if no consent page
        }

        const results = [];
        let noNewResultsCount = 0;
        let previousResultCount = 0;
        let scrollCount = 0;
        const MAX_SCROLLS = 15;
        
        const scrollSelector = 'div[role="feed"]'; 
        
        try {
            await page.waitForSelector(scrollSelector, { timeout: 15000 });
        } catch (e) {
            if (log) log("Could not find results feed. It might be a single result page or no results.", 'warn');
            clearTimeout(timeoutId);
            return results;
        }

        if (log) log("Found results feed. Starting extraction...");

        while (!isTimeout && scrollCount < MAX_SCROLLS) {
            if (maxLeads !== 'All' && results.length >= parseInt(maxLeads, 10)) {
                if (log) log(`Reached requested lead count: ${maxLeads}`, 'success');
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
                log(`Found ${results.length} unique results so far... (Scroll ${scrollCount + 1})`);
            }

            if (results.length === previousResultCount) {
                noNewResultsCount++;
                if (noNewResultsCount >= 3) {
                    if (log) log("No new results after multiple scrolls. Reached end of list.");
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
                 if (log) log("Found 'end of list' indicator.");
                 break;
            }

            await page.evaluate((selector) => {
                const feed = document.querySelector(selector);
                if (feed) feed.scrollBy(0, 1000);
            }, scrollSelector);
            
            scrollCount++;
            await randomDelay(2000, 4000);
        }

        if (scrollCount >= MAX_SCROLLS && log) {
             log(`Reached max scrolls limit (${MAX_SCROLLS}).`);
        }

        if (maxLeads !== 'All' && results.length > parseInt(maxLeads, 10)) {
            return results.slice(0, parseInt(maxLeads, 10));
        }

        return results;
    } finally {
        clearTimeout(timeoutId);
    }
}
