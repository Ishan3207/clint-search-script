import { randomDelay } from './stealth.js';

export async function scrapePlaceDetails(page, url) {
    console.log(`Navigating to detail page: ${url}`);
    
    // Wait between 4-8 seconds before visiting a detail page to simulate human
    await randomDelay();
    
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Wait for the main title element to be visible
    try {
        await page.waitForSelector('h1', { timeout: 10000 });
    } catch (e) {
        console.log(`Timeout waiting for detail page load: ${url}`);
        return null;
    }

    const details = await page.evaluate(() => {
        const getElementText = (selector) => {
            const el = document.querySelector(selector);
            return el ? el.innerText.trim() : null;
        };

        const getButtonAria = (labelContains) => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => {
                const aria = b.getAttribute('aria-label');
                return aria && aria.toLowerCase().includes(labelContains.toLowerCase());
            });
            return btn ? btn.getAttribute('aria-label') : null;
        };
        
        const getLinkTextByProtocol = (protocol) => {
            const links = Array.from(document.querySelectorAll('a'));
            const link = links.find(a => a.href.startsWith(protocol));
            if (link) {
                return protocol === 'mailto:' ? link.href.replace('mailto:', '') : link.href;
            }
            return null;
        };

        // Extracting Data
        const name = getElementText('h1');
        
        // Categories can sometimes be found near the rating
        let category = null;
        const categoryBtn = document.querySelector('button[jsaction="pane.rating.category"]');
        if (categoryBtn) {
            category = categoryBtn.innerText;
        }

        // Phone number
        let phone = null;
        const phoneAria = getButtonAria('phone');
        if (phoneAria) {
            // usually looks like "Phone: +1 123 456 7890"
            phone = phoneAria.replace(/phone:/i, '').trim();
        }

        // Address
        let address = null;
        const addressAria = getButtonAria('address');
        if (addressAria) {
             address = addressAria.replace(/address:/i, '').trim();
        }

        // Website
        let website = null;
        const websiteAria = getButtonAria('website');
        if (websiteAria) {
            const aTag = document.querySelector('a[aria-label="' + websiteAria + '"]');
            if (aTag) {
                website = aTag.href;
            }
        }
        
        // Rating and reviews
        let rating = null;
        let reviews = null;
        const ratingDiv = document.querySelector('div[font-display="block"]');
        if (ratingDiv && ratingDiv.innerText) {
             rating = ratingDiv.innerText.trim();
        }
        
        const reviewBtn = document.querySelector('button[aria-label*="reviews"]');
        if (reviewBtn) {
            const text = reviewBtn.innerText;
            if (text && text.includes('(')) {
                reviews = text.replace('(', '').replace(')', '').trim();
            }
        }

        return {
            name: name,
            category: category,
            phone: phone,
            address: address,
            website: website,
            rating: rating,
            reviews: reviews,
            mapsLink: window.location.href
        };
    });

    return details;
}
