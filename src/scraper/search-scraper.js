import { randomDelay } from './stealth.js';

export async function scrapeSearchResults(page, query, location, radius, maxLeads) {
    // 1. Construct search URL
    // Google Maps is smart enough to handle "query in location" directly
    const searchQuery = encodeURIComponent(`${query} in ${location}`);
    const searchUrl = `https://www.google.com/maps/search/${searchQuery}`;
    
    console.log(`Navigating to Google Maps: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await randomDelay(); // Initial load delay

    // Ensure we are not on the consent page
    try {
        const consentButton = await page.$('form[action*="consent"] button');
        if (consentButton) {
            await consentButton.click();
            await randomDelay();
        }
    } catch (e) {
        // Ignore if no consent page
    }

    const results = [];
    let noNewResultsCount = 0;
    let previousResultCount = 0;
    
    // The main scrollable feed container usually has this aria-label or role="feed"
    // Finding the exact scroll container in Maps can be tricky as classes change.
    const scrollSelector = 'div[role="feed"]'; 
    
    try {
        await page.waitForSelector(scrollSelector, { timeout: 15000 });
    } catch (e) {
        console.log("Could not find results feed. It might be a single result page or no results.");
        return results;
    }

    console.log("Found results feed. Starting scroll...");

    // 2. Scroll and extract
    while (true) {
        if (maxLeads !== 'All' && results.length >= parseInt(maxLeads, 10)) {
            console.log(`Reached requested lead count: ${maxLeads}`);
            break;
        }

        // Extract current items
        // Listing items are usually divs inside the feed that have specific link structures
        const items = await page.$$('div[role="feed"] > div > div');
        
        // Parse items on the page context
        const parsedItems = await page.evaluate(() => {
            const listings = [];
            // Target the main container elements for each result
            const itemContainers = document.querySelectorAll('div[role="feed"] > div > div');
            
            for (const container of itemContainers) {
                const aTag = container.querySelector('a[href*="/maps/place/"]');
                if (!aTag) continue;
                
                const url = aTag.href;
                const name = aTag.getAttribute('aria-label');
                
                if (name && url) {
                   listings.push({
                       name: name,
                       detailUrl: url
                   });
                }
            }
            return listings;
        });

        // Add new items
        for (const item of parsedItems) {
            if (!results.find(r => r.detailUrl === item.detailUrl)) {
                results.push(item);
            }
        }

        console.log(`Currently found ${results.length} unique results...`);

        if (results.length === previousResultCount) {
            noNewResultsCount++;
            if (noNewResultsCount >= 3) {
                console.log("No new results after multiple scrolls. Reached end of list.");
                break;
            }
        } else {
            noNewResultsCount = 0;
        }
        
        previousResultCount = results.length;

        // Check if the "You've reached the end of the list" text is visible
        const endOfListVisible = await page.evaluate(() => {
            const textNodes = document.evaluate(
                "//span[contains(text(), \"You've reached the end of the list\")]",
                document, null, XPathResult.ANY_TYPE, null
            );
            return textNodes.iterateNext() !== null;
        });

        if (endOfListVisible) {
             console.log("Found 'end of list' indicator.");
             break;
        }

        // Scroll the feed container
        await page.evaluate((selector) => {
            const feed = document.querySelector(selector);
            if (feed) {
                feed.scrollBy(0, 1000); // Scroll down
            }
        }, scrollSelector);
        
        // Wait for lazy loading
        await randomDelay(2000, 4000); // Wait 2-4 seconds between scrolls
    }

    // Limit to maxLeads if applicable
    if (maxLeads !== 'All' && results.length > parseInt(maxLeads, 10)) {
        return results.slice(0, parseInt(maxLeads, 10));
    }

    return results;
}
