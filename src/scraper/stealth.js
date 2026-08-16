export async function applyStealth(context) {
    await context.addInitScript(() => {
        // Overwrite the `webdriver` property to false
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });

        // Spoof languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });

        // Spoof plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });

        // Spoof connection
        if (navigator.connection) {
             Object.defineProperty(navigator.connection, 'rtt', {
                 get: () => 50,
             });
        }
        
        // Pass the permissions test
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
    });
}

export function randomDelay(minStr, maxStr) {
    const min = parseInt(minStr || process.env.SCRAPER_DELAY_MIN_MS || '4000', 10);
    const max = parseInt(maxStr || process.env.SCRAPER_DELAY_MAX_MS || '8000', 10);
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}
