import { ollama } from './ollama-client.js';

export async function filterLeads(leads, criteria) {
    if (!leads || leads.length === 0) return [];
    if (!criteria || criteria.trim() === '') return leads;

    const isHealthy = await ollama.isHealthy();
    if (!isHealthy) {
        console.warn('Ollama unavailable. Returning unfiltered leads.');
        return leads;
    }

    console.log(`Filtering ${leads.length} leads using criteria: "${criteria}"...`);

    // To prevent context window overflow, we might need to batch this if leads list is huge.
    // For now, assume batching if > 50 leads.
    const BATCH_SIZE = 25;
    let filteredIndices = [];

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        
        // Prepare simplified data for AI to save tokens
        const simplifiedBatch = batch.map((lead, index) => ({
            id: i + index, // global index
            name: lead.name,
            category: lead.category,
            website: lead.website ? "has_website" : null,
            rating: lead.rating,
            reviews: lead.reviews
        }));

        const prompt = `
You are a lead filtering assistant. Given a list of businesses and a filtering criteria, you must return the IDs of the businesses that match the criteria.

Criteria: "${criteria}"

Businesses:
${JSON.stringify(simplifiedBatch, null, 2)}

Analyze the businesses based on the criteria. 
If the criteria mentions "no website", ONLY include businesses where website is null.
If the criteria mentions a specific rating, check the rating field.

Return ONLY a JSON array of integers representing the IDs of matching businesses.
If none match, return an empty array [].
Output:`;

        try {
            const batchIndices = await ollama.generateJSON(prompt);
            
            if (Array.isArray(batchIndices)) {
                filteredIndices = filteredIndices.concat(batchIndices.map(id => parseInt(id, 10)).filter(id => !isNaN(id)));
            }
        } catch (error) {
            console.error(`Failed to filter batch ${i / BATCH_SIZE}, skipping filter for this batch.`, error);
            // Fallback: keep all in this batch if AI fails
            filteredIndices = filteredIndices.concat(simplifiedBatch.map(b => b.id));
        }
    }

    // Deduplicate and filter the original list
    const uniqueIndices = [...new Set(filteredIndices)];
    const finalLeads = leads.filter((_, index) => uniqueIndices.includes(index));
    
    console.log(`Filtering complete. Kept ${finalLeads.length} out of ${leads.length} leads.`);
    return finalLeads;
}
