import { aiProvider } from './ai-provider.js';
import { sanitizeUserInput } from './prompt-sanitizer.js';

export async function filterLeads(leads, criteria, providerConfig = {}) {
    if (!leads || leads.length === 0) return { leads: [], quota: null };
    if (!criteria || criteria.trim() === '') return { leads, quota: null };

    const { sanitized: cleanCriteria } = sanitizeUserInput(criteria, 500);

    console.log(`Filtering ${leads.length} leads using criteria: "${cleanCriteria}" via ${providerConfig.provider || 'default AI'}...`);

    let currentLeads = [...leads];

    // =========================================================================
    // 1. Deterministic Rule-Based Pre-Filtering (ONLY when explicitly requested)
    // =========================================================================
    const lowerCriteria = cleanCriteria.toLowerCase();

    // Rule: Explicit "no website" / "without website"
    const hasNoWebsiteRule = /\b(no\s+websites?|without\s+websites?|no\s+sites?|without\s+sites?)\b/i.test(lowerCriteria);
    if (hasNoWebsiteRule) {
        console.log(`[Deterministic Filter] User explicitly requested 'No Website'. Filtering ${currentLeads.length} leads.`);
        currentLeads = currentLeads.filter(l => !l.website || l.website === 'no_website' || l.website === 'N/A' || l.website.trim() === '');
    }

    // Rule: Explicit "has email" / "with email"
    const hasEmailRule = /\b(has\s+email|with\s+email|emails?\s+only)\b/i.test(lowerCriteria);
    if (hasEmailRule) {
        console.log(`[Deterministic Filter] User explicitly requested 'Has Email'.`);
        currentLeads = currentLeads.filter(l => Boolean(l.email && l.email !== 'N/A' && l.email.trim() !== ''));
    }

    // Rule: Explicit "has phone" / "with phone"
    const hasPhoneRule = /\b(has\s+phones?|with\s+phones?|phones?\s+only)\b/i.test(lowerCriteria);
    if (hasPhoneRule) {
        console.log(`[Deterministic Filter] User explicitly requested 'Has Phone'.`);
        currentLeads = currentLeads.filter(l => Boolean(l.phone && l.phone !== 'N/A' && l.phone.trim() !== ''));
    }

    // Rule: Explicit Min Rating (e.g. "4+ star", "rating > 4", "4.5 stars")
    const ratingMatch = lowerCriteria.match(/(\d(?:\.\d)?)\s*\+?\s*(?:stars?|ratings?)/i);
    if (ratingMatch) {
        const minRating = parseFloat(ratingMatch[1]);
        if (!isNaN(minRating)) {
            console.log(`[Deterministic Filter] Enforcing Min Rating >= ${minRating}`);
            currentLeads = currentLeads.filter(l => {
                const r = parseFloat(l.rating);
                return !isNaN(r) && r >= minRating;
            });
        }
    }

    // If deterministic filters were the only criteria (e.g. only "no website" or "with email"), return immediately
    const remainingSemanticCriteria = cleanCriteria
        .replace(/\b(no\s+websites?|without\s+websites?|no\s+sites?|without\s+sites?)\b/gi, '')
        .replace(/\b(has\s+email|with\s+email|emails?\s+only|has\s+phones?|with\s+phones?|phones?\s+only)\b/gi, '')
        .replace(/(\d(?:\.\d)?)\s*\+?\s*(?:stars?|ratings?)/gi, '')
        .replace(/,\s*,/g, ',')
        .trim();

    if (!remainingSemanticCriteria || remainingSemanticCriteria === ',' || remainingSemanticCriteria === '') {
        console.log(`[Lead Filter] Filtering complete: kept ${currentLeads.length} of ${leads.length}`);
        return { leads: currentLeads, quota: null };
    }

    // =========================================================================
    // 2. Semantic LLM Filter for Qualitative Criteria (e.g. "rooftop", "vegan")
    // =========================================================================
    const BATCH_SIZE = 25;
    let filteredIndices = [];
    let latestQuota = null;

    const systemPrompt = `You are a lead filtering assistant. Given a list of businesses and filtering criteria, return the IDs of the businesses that match the criteria.
Return ONLY a valid JSON array of integers representing the IDs of matching businesses.
If none match, return an empty array [].`;

    for (let i = 0; i < currentLeads.length; i += BATCH_SIZE) {
        const batch = currentLeads.slice(i, i + BATCH_SIZE);

        const simplifiedBatch = batch.map((lead, index) => ({
            id: i + index,
            name: sanitizeUserInput(lead.name || '', 100).sanitized,
            category: sanitizeUserInput(lead.category || '', 100).sanitized,
            rating: lead.rating,
            reviews: lead.reviews
        }));

        const userPrompt = `Criteria: "${remainingSemanticCriteria}"\nBusinesses:\n${JSON.stringify(simplifiedBatch, null, 2)}\nOutput:`;

        try {
            const response = await aiProvider.generateJSON(userPrompt, providerConfig, systemPrompt);
            const batchIndices = response.data;
            if (response.quota) latestQuota = response.quota;

            if (Array.isArray(batchIndices)) {
                filteredIndices = filteredIndices.concat(batchIndices.map(id => parseInt(id, 10)).filter(id => !isNaN(id)));
            }
        } catch (primaryError) {
            console.error(`Semantic filter batch ${i / BATCH_SIZE} failed:`, primaryError.message);
            filteredIndices = filteredIndices.concat(simplifiedBatch.map(b => b.id));
        }
    }

    const uniqueIndices = [...new Set(filteredIndices)];
    const finalLeads = currentLeads.filter((_, index) => uniqueIndices.includes(index));

    console.log(`Filtering complete. Kept ${finalLeads.length} out of ${leads.length} leads.`);
    return {
        leads: finalLeads,
        quota: latestQuota
    };
}
