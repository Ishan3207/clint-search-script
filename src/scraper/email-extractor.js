export async function extractEmailAndSocial(contextPage, url, log) {
    if (!url) return { email: null, socialLinks: [] };

    if (log) log(`Scanning website for verified contacts: ${url}`);
    
    let page = null;
    try {
        page = await contextPage.context().newPage();
        
        // Fast page load with 8s timeout
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        
        // 1. Scan Homepage
        let data = await scanPage(page);

        // 2. If no email found on homepage, search for contact / about subpages
        if (!data.email) {
            const candidateUrls = await page.evaluate((baseUrl) => {
                const links = Array.from(document.querySelectorAll('a'));
                const matched = [];
                const contactKeywords = ['contact', 'about', 'get in touch', 'reach us', 'impressum'];

                for (const a of links) {
                    const text = (a.innerText || '').toLowerCase();
                    const href = a.href || '';
                    if (contactKeywords.some(kw => text.includes(kw) || href.toLowerCase().includes(kw))) {
                        if (href && href.startsWith('http') && !matched.includes(href)) {
                            matched.push(href);
                        }
                    }
                }
                return matched.slice(0, 2); // Scan at most 2 contact pages to keep scraping fast
            }, url);

            for (const contactUrl of candidateUrls) {
                if (data.email) break;
                try {
                    if (log) log(`Deep scanning subpage: ${contactUrl}`);
                    await page.goto(contactUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
                    const subData = await scanPage(page);
                    if (subData.email) data.email = subData.email;
                    data.socialLinks = Array.from(new Set([...data.socialLinks, ...subData.socialLinks]));
                } catch {
                    // Ignore subpage navigation failures
                }
            }
        }
        
        return data;
    } catch (e) {
        if (log) log(`Note: Website scan incomplete for ${url}: ${e.message}`, 'warn');
        return { email: null, socialLinks: [] };
    } finally {
        if (page) await page.close().catch(() => {});
    }
}

async function scanPage(page) {
    return await page.evaluate(() => {
        let email = null;
        let socialLinks = new Set();
        
        // 1. Extract all mailto: links
        const links = Array.from(document.querySelectorAll('a'));
        for (const a of links) {
            const href = a.href || '';
            if (href.startsWith('mailto:')) {
                const clean = href.replace('mailto:', '').split('?')[0].split('/')[0].trim();
                if (clean && clean.includes('@') && !email) {
                    email = clean;
                }
            }
        }

        // 2. Extract social links
        const socialDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'youtube.com', 'tiktok.com'];
        for (const a of links) {
            const href = a.href || '';
            for (const domain of socialDomains) {
                if (href.includes(domain) && !href.includes('/share') && !href.includes('/intent')) {
                    socialLinks.add(href);
                }
            }
        }

        // 3. Schema.org JSON-LD scan
        if (!email) {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
                try {
                    const json = JSON.parse(script.innerText);
                    if (json.email && typeof json.email === 'string') {
                        email = json.email.replace('mailto:', '').trim();
                        break;
                    }
                } catch {}
            }
        }

        // 4. Text regex scan across body with image/asset exclusion
        if (!email) {
            const text = document.body ? document.body.innerText : '';
            const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
            const matches = text.match(emailRegex);
            if (matches && matches.length > 0) {
                const invalidExts = /\.(png|jpg|jpeg|gif|svg|webp|avif|css|js|woff|woff2|ttf|eot)$/i;
                const filtered = matches.filter(m => !invalidExts.test(m) && !m.includes('sentry') && !m.includes('example.com'));
                if (filtered.length > 0) {
                    email = filtered[0];
                }
            }
        }

        return {
            email: email,
            socialLinks: Array.from(socialLinks)
        };
    });
}
