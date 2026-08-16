export async function extractEmailAndSocial(page, url) {
    if (!url) return { email: null, socialLinks: [] };

    console.log(`Extracting emails/socials from: ${url}`);
    
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        // Quick scan of the homepage
        let data = await scanPage(page);

        // If email not found, try to find a contact page
        if (!data.email) {
            const contactHref = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a'));
                const contactLink = links.find(a => {
                    const text = a.innerText.toLowerCase();
                    return text.includes('contact') || text.includes('about');
                });
                return contactLink ? contactLink.href : null;
            });

            if (contactHref) {
                console.log(`Navigating to contact page: ${contactHref}`);
                try {
                    await page.goto(contactHref, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    const contactData = await scanPage(page);
                    data.email = contactData.email || data.email;
                    // Merge socials
                    const allSocials = new Set([...data.socialLinks, ...contactData.socialLinks]);
                    data.socialLinks = Array.from(allSocials);
                } catch (e) {
                    // Ignore contact page load errors
                }
            }
        }
        
        return data;
    } catch (e) {
        console.log(`Failed to extract from ${url}: ${e.message}`);
        return { email: null, socialLinks: [] };
    }
}

async function scanPage(page) {
    return await page.evaluate(() => {
        let email = null;
        let socialLinks = new Set();
        
        // 1. Look for mailto: links
        const links = Array.from(document.querySelectorAll('a'));
        const mailto = links.find(a => a.href.startsWith('mailto:'));
        if (mailto) {
            email = mailto.href.replace('mailto:', '').split('?')[0].trim();
        }

        // 2. Look for social links
        const socialDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'youtube.com'];
        for (const link of links) {
            for (const domain of socialDomains) {
                if (link.href.includes(domain)) {
                    socialLinks.add(link.href);
                }
            }
        }

        // 3. Fallback: Regex on page text for emails (basic)
        if (!email) {
             const text = document.body.innerText;
             const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
             const matches = text.match(emailRegex);
             if (matches && matches.length > 0) {
                 // Filter out common image extensions that might get caught
                 const validEmails = matches.filter(m => !m.endsWith('.png') && !m.endsWith('.jpg') && !m.endsWith('.jpeg'));
                 if (validEmails.length > 0) {
                     email = validEmails[0];
                 }
             }
        }

        return {
            email: email,
            socialLinks: Array.from(socialLinks)
        };
    });
}
