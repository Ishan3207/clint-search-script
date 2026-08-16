import express from 'express';
import { ollama } from '../../ai/ollama-client.js';
import { parseNaturalLanguageQuery } from '../../ai/natural-language-parser.js';
import { expandQuery } from '../../ai/query-expander.js';

const router = express.Router();

// GET /api/ai/health - Check if Ollama is running and model is available
router.get('/health', async (req, res) => {
    const isHealthy = await ollama.isHealthy();
    res.json({
        healthy: isHealthy,
        model: ollama.model,
        baseUrl: ollama.baseUrl
    });
});

// POST /api/ai/parse - Parse NL query directly (for UI suggestions/preview)
router.post('/parse', async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        const parsed = await parseNaturalLanguageQuery(query);
        res.json({ parsed });
    } catch (error) {
        res.status(500).json({ error: 'Failed to parse query' });
    }
});

// POST /api/ai/expand - Expand a query directly
router.post('/expand', async (req, res) => {
    const { niche, location } = req.body;
    if (!niche) {
        return res.status(400).json({ error: 'Niche is required' });
    }

    try {
        const expanded = await expandQuery(niche, location);
        res.json({ expanded });
    } catch (error) {
        res.status(500).json({ error: 'Failed to expand query' });
    }
});

export default router;
