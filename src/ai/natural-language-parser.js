import { aiProvider } from './ai-provider.js';
import { sanitizeUserInput } from './prompt-sanitizer.js';

export async function parseNaturalLanguageQuery(query, providerConfig = {}) {
    if (!query || query.trim() === '') {
        return null;
    }

    const { sanitized: cleanQuery, wasModified } = sanitizeUserInput(query, 1000);
    if (wasModified) {
        console.warn(`[NLP Parser] Query sanitized for security/injection prevention.`);
    }

    console.log(`Parsing natural language query: "${cleanQuery}" via ${providerConfig.provider || 'default AI'}...`);

    const systemPrompt = `You are a natural language search parser. Given a user's search query, extract the parameters into a JSON object.
The required keys in the JSON object are:
- "niche": The type of business or service (e.g., "cafes", "plumber", "marketing agencies"). Default to empty string if not found.
- "location": The city, area, or region mentioned (e.g., "Koramangala Bangalore", "Austin"). Default to empty string if not found.
- "radius": The search radius mentioned (e.g., "5km", "10 miles"). Default to "10km" if not found.
- "maxLeads": The number of results they want (e.g., "10", "50"). Default to "All" if not found.
- "filters": Any specific criteria they asked for (e.g., "no website", "cheap", "good reviews"). Default to empty string if not found.

Example input: "find me 20 cheap cafes with no websites in Indiranagar Bangalore within 5km"
Example output: {
  "niche": "cafes",
  "location": "Indiranagar Bangalore",
  "radius": "5km",
  "maxLeads": "20",
  "filters": "cheap, no websites"
}

Return ONLY the valid JSON object.`;

    const userPrompt = `Input: "${cleanQuery}"\nOutput:`;

    try {
        const response = await aiProvider.generateJSON(userPrompt, providerConfig, systemPrompt);
        const parsed = response.data;
        console.log(`Parsed query result: ${JSON.stringify(parsed)}`);

        return {
            niche: parsed.niche || cleanQuery,
            location: parsed.location || '',
            radius: parsed.radius || '10km',
            maxLeads: parsed.maxLeads || 'All',
            filters: parsed.filters || '',
            quota: response.quota
        };
    } catch (primaryError) {
        console.warn(`Primary AI provider failed (${primaryError.message}). Attempting Ollama fallback...`);

        // Fallback to Ollama if primary was not ollama
        if (providerConfig.provider && providerConfig.provider !== 'ollama') {
            try {
                const fallbackResponse = await aiProvider.generateJSON(userPrompt, { provider: 'ollama' }, systemPrompt);
                const parsed = fallbackResponse.data;
                return {
                    niche: parsed.niche || cleanQuery,
                    location: parsed.location || '',
                    radius: parsed.radius || '10km',
                    maxLeads: parsed.maxLeads || 'All',
                    filters: parsed.filters || '',
                    quota: fallbackResponse.quota
                };
            } catch (fallbackError) {
                console.warn(`Ollama fallback also failed (${fallbackError.message}). Using raw string fallback.`);
            }
        }

        // Final graceful fallback: raw query
        return {
            niche: cleanQuery,
            location: '',
            radius: '10km',
            maxLeads: 'All',
            filters: '',
            quota: null
        };
    }
}
