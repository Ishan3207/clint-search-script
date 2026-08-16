import { ollama } from './ollama-client.js';

export async function expandQuery(niche, location) {
    if (!niche) return [];

    const isHealthy = await ollama.isHealthy();
    if (!isHealthy) {
        console.warn('Ollama unavailable or missing model. Falling back to single query.');
        return [niche];
    }

    console.log(`Expanding query for niche: "${niche}" via Ollama...`);

    const prompt = `
Generate a JSON array containing 3 to 5 alternative Google Maps search queries for finding businesses related to '${niche}'. 
The queries should cast a wider net to find similar or related businesses.
Do not include the location in the queries.
Keep the queries short and relevant.
The original niche should be the first item in the array.

Example input: "plumber"
Example output: ["plumber", "plumbing services", "pipe repair", "drain cleaning"]

Example input: "cafe"
Example output: ["cafe", "coffee shop", "espresso bar", "bakery cafe"]

Return ONLY a JSON array of strings.
Input: "${niche}"
Output:`;

    try {
        const expandedQueries = await ollama.generateJSON(prompt);
        
        if (Array.isArray(expandedQueries) && expandedQueries.length > 0) {
            // Ensure the original niche is included and lowercase everything for deduplication
            const uniqueQueries = [...new Set([niche.toLowerCase(), ...expandedQueries.map(q => String(q).toLowerCase())])];
            console.log(`Expanded queries: ${JSON.stringify(uniqueQueries)}`);
            return uniqueQueries.slice(0, 5); // Max 5 queries to not overload scraping
        }
        
        return [niche];
    } catch (error) {
        console.error('Query expansion failed, using fallback.', error);
        return [niche];
    }
}
