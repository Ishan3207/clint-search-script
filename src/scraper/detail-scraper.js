import { randomDelay } from './stealth.js';

export async function scrapePlaceDetails(page, url, log) {
    if (log) log(`Navigating to detail page: ${url}`);
    
    await randomDelay();
    
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('h1', { timeout: 10000 });
    } catch (e) {
        if (log) log(`Timeout waiting for detail page load: ${url}`, 'warn');
        return null;
    }

    const details = await page.evaluate(() => {
        const getElementText = (selector) => {
            const el = document.querySelector(selector);
            return el ? el.innerText.trim() : null;
        };

        const name = getElementText('h1');
        
        // Phone
        let phone = null;
        const phoneLink = document.querySelector('a[href^="tel:"]');
        if (phoneLink) {
            phone = phoneLink.href.replace('tel:', '');
        } else {
            const phoneBtn = document.querySelector('button[data-tooltip*="phone" i]') || document.querySelector('button[aria-label*="phone" i]');
            if (phoneBtn) phone = phoneBtn.getAttribute('aria-label')?.replace(/phone:/i, '')?.trim();
        }

        // Address
        let address = null;
        const addrBtn = document.querySelector('button[data-item-id="address"]') || document.querySelector('button[aria-label*="Address" i]');
        if (addrBtn) {
            address = addrBtn.getAttribute('aria-label')?.replace(/address:/i, '')?.trim();
        }

        // Website
        let website = null;
        const webLink = document.querySelector('a[data-item-id="authority"]') || document.querySelector('a[aria-label*="Website" i]');
        if (webLink) {
            website = webLink.href;
        }

        // Direct Email from Google Maps pane
        let email = null;
        const mailtoLink = document.querySelector('a[href^="mailto:"]');
        if (mailtoLink) {
            email = mailtoLink.href.replace('mailto:', '').split('?')[0].trim();
        } else {
            const emailBtn = document.querySelector('button[data-tooltip*="email" i]') || document.querySelector('button[aria-label*="email" i]') || document.querySelector('button[data-item-id*="email" i]');
            if (emailBtn) {
                const label = emailBtn.getAttribute('aria-label') || emailBtn.getAttribute('data-tooltip') || '';
                const match = label.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
                if (match) email = match[1];
            }
        }

        // Fallback email regex scan on details pane text
        if (!email) {
            const sidebar = document.querySelector('div[role="main"]') || document.body;
            const text = sidebar.innerText;
            const matches = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
            if (matches && matches.length > 0) {
                const valid = matches.filter(m => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(m) && !m.includes('google.com'));
                if (valid.length > 0) email = valid[0];
            }
        }

        // Rating
        let rating = null;
        const ratingSpan = document.querySelector('span[aria-hidden="true"]');
        if (ratingSpan && /^\d\.\d$/.test(ratingSpan.innerText.trim())) {
            rating = ratingSpan.innerText.trim();
        } else {
            const match = document.body.innerText.match(/(\d\.\d)\s*stars/);
            if (match) rating = match[1];
        }

        // Reviews
        let reviews = null;
        const reviewBtn = document.querySelector('button[aria-label*="reviews" i]');
        if (reviewBtn) {
            const match = reviewBtn.getAttribute('aria-label')?.match(/([\d,]+)\s*reviews/i);
            if (match) reviews = match[1];
        }

        // Category
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
    });

    if (!details || !details.name) {
        if (log) log(`Skipping invalid lead: no name extracted for ${url}`, 'warn');
        return null;
    }

    if (log) {
        log(`Extracted: ${details.name} (Phone: ${details.phone ? '✓' : '✕'}, Email: ${details.email ? '✓' : '✕'}, Web: ${details.website ? '✓' : '✕'})`);
    }

    return details;
}
