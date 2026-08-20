import { aiProvider } from './ai-provider.js';
import { sanitizeUserInput } from './prompt-sanitizer.js';

export async function expandQuery(niche, location = '', providerConfig = {}) {
    if (!niche) return [];

    const { sanitized: cleanNiche } = sanitizeUserInput(niche, 200);
    const { sanitized: cleanLocation } = sanitizeUserInput(location, 200);

    console.log(`Expanding query for niche: "${cleanNiche}" via ${providerConfig.provider || 'default AI'}...`);

    const systemPrompt = `You are a search query expansion assistant. Generate a JSON array containing 3 to 5 alternative Google Maps search queries for finding businesses related to the given niche.
The queries should cast a wider net to find similar or related businesses.
Do not include the location in the queries.
Keep the queries short and relevant.
The original niche MUST be the first item in the array.

Example input: "plumber"
Example output: ["plumber", "plumbing services", "pipe repair", "drain cleaning"]

Return ONLY a valid JSON array of strings.`;

    const userPrompt = `Niche: "${cleanNiche}"\nLocation context: "${cleanLocation}"\nOutput:`;

    try {
        const response = await aiProvider.generateJSON(userPrompt, providerConfig, systemPrompt);
        const expandedQueries = response.data;

        if (Array.isArray(expandedQueries) && expandedQueries.length > 0) {
            const uniqueQueries = [...new Set([cleanNiche.toLowerCase(), ...expandedQueries.map(q => String(q).toLowerCase())])];
            console.log(`Expanded queries: ${JSON.stringify(uniqueQueries)}`);
            return {
                queries: uniqueQueries.slice(0, 5),
                quota: response.quota
            };
        }
        return { queries: [cleanNiche], quota: response.quota };
    } catch (primaryError) {
        console.warn(`Primary query expansion failed (${primaryError.message}). Trying fallback...`);

        if (providerConfig.provider && providerConfig.provider !== 'ollama') {
            try {
                const fallbackResponse = await aiProvider.generateJSON(userPrompt, { provider: 'ollama' }, systemPrompt);
                const expandedQueries = fallbackResponse.data;
                if (Array.isArray(expandedQueries) && expandedQueries.length > 0) {
                    const uniqueQueries = [...new Set([cleanNiche.toLowerCase(), ...expandedQueries.map(q => String(q).toLowerCase())])];
                    return { queries: uniqueQueries.slice(0, 5), quota: fallbackResponse.quota };
                }
            } catch (fallbackError) {
                console.warn(`Ollama fallback failed (${fallbackError.message}). Using single query.`);
            }
        }

        return { queries: [cleanNiche], quota: null };
    }
}
