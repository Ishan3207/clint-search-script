import { ollama } from './ollama-client.js';

export async function parseNaturalLanguageQuery(query) {
    if (!query || query.trim() === '') {
        return null;
    }

    const isHealthy = await ollama.isHealthy();
    if (!isHealthy) {
        console.warn('Ollama unavailable. Falling back to treating the whole string as a niche.');
        return {
            niche: query,
            location: '',
            radius: '10km',
            maxLeads: 'All',
            filters: ''
        };
    }

    console.log(`Parsing natural language query: "${query}"...`);

    const prompt = `
You are a natural language search parser. I will give you a user's search query, and you need to extract the parameters into a JSON object.

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

Example input: "dentists in New York"
Example output: {
  "niche": "dentists",
  "location": "New York",
  "radius": "10km",
  "maxLeads": "All",
  "filters": ""
}

Return ONLY the JSON object.
Input: "${query}"
Output:`;

    try {
        const parsed = await ollama.generateJSON(prompt);
        console.log(`Parsed query: ${JSON.stringify(parsed)}`);
        
        // Ensure defaults if AI hallucinates missing keys
        return {
            niche: parsed.niche || query,
            location: parsed.location || '',
            radius: parsed.radius || '10km',
            maxLeads: parsed.maxLeads || 'All',
            filters: parsed.filters || ''
        };
    } catch (error) {
        console.error('Natural language parsing failed, using fallback.', error);
        return {
            niche: query,
            location: '',
            radius: '10km',
            maxLeads: 'All',
            filters: ''
        };
    }
}
