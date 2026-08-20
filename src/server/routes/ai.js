import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { aiProvider } from '../../ai/ai-provider.js';
import { parseNaturalLanguageQuery } from '../../ai/natural-language-parser.js';
import { expandQuery } from '../../ai/query-expander.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../../.env');

const router = express.Router();

// In-memory active selection state
let activeRuntimeConfig = {
    provider: process.env.AI_PROVIDER || 'gemini',
    model: null,
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
};

// Helper to update .env file safely
function updateEnvFile(key, value) {
    try {
        let content = '';
        if (fs.existsSync(envPath)) {
            content = fs.readFileSync(envPath, 'utf8');
        }

        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${value}`);
        } else {
            content += `\n${key}=${value}`;
        }

        fs.writeFileSync(envPath, content.trim() + '\n', 'utf8');
        return true;
    } catch (err) {
        console.error('Failed to write .env file:', err.message);
        return false;
    }
}

// GET /api/ai/providers - List configured providers
router.get('/providers', (req, res) => {
    try {
        const providers = aiProvider.getConfiguredProviders();
        res.json({
            providers,
            active: activeRuntimeConfig
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/models - List models available for a given provider
router.get('/models', async (req, res) => {
    try {
        const provider = req.query.provider || activeRuntimeConfig.provider;
        const models = await aiProvider.listModels({
            provider,
            baseUrl: activeRuntimeConfig.baseUrl
        });
        res.json({ provider, models });
    } catch (err) {
        res.status(500).json({ error: `Failed to fetch models: ${err.message}` });
    }
});

// GET /api/ai/quota - Get quota info
router.get('/quota', (req, res) => {
    try {
        const provider = req.query.provider || null;
        const quota = aiProvider.getQuota(provider);
        res.json({ quota });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/health - Check provider health
router.get('/health', async (req, res) => {
    try {
        const provider = req.query.provider || activeRuntimeConfig.provider;
        const model = req.query.model || activeRuntimeConfig.model;
        const healthInfo = await aiProvider.healthCheck({
            provider,
            model,
            baseUrl: activeRuntimeConfig.baseUrl
        });
        res.json(healthInfo);
    } catch (err) {
        res.status(500).json({ healthy: false, error: err.message });
    }
});

// POST /api/ai/save-key - Direct API Key submission & persistent storage
router.post('/save-key', async (req, res) => {
    const { provider, apiKey, model } = req.body;

    if (!provider) {
        return res.status(400).json({ error: 'Provider is required' });
    }

    const envMap = {
        gemini: 'GEMINI_API_KEY',
        openai: 'OPENAI_API_KEY',
        claude: 'CLAUDE_API_KEY'
    };

    const envVar = envMap[provider];
    if (!envVar) {
        return res.status(400).json({ error: `Invalid cloud provider: ${provider}` });
    }

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        return res.status(400).json({ error: 'API key cannot be empty' });
    }

    const cleanKey = apiKey.trim();

    // 1. Update in-memory process.env
    process.env[envVar] = cleanKey;

    // 2. Persist to local .env
    updateEnvFile(envVar, cleanKey);
    updateEnvFile('AI_PROVIDER', provider);
    if (model) updateEnvFile('AI_MODEL', model);

    // 3. Update runtime active selection
    activeRuntimeConfig.provider = provider;
    if (model) activeRuntimeConfig.model = model;

    // 4. Verify the key immediately
    const health = await aiProvider.healthCheck({ provider, apiKey: cleanKey, model });

    res.json({
        success: true,
        message: `${provider.toUpperCase()} API key saved successfully!`,
        healthy: health.healthy,
        error: health.error || null,
        active: activeRuntimeConfig
    });
});

// POST /api/ai/select - Switch active provider and model
router.post('/select', async (req, res) => {
    const { provider, model, baseUrl } = req.body;
    if (!provider) {
        return res.status(400).json({ error: 'Provider is required' });
    }

    activeRuntimeConfig.provider = provider;
    if (model) activeRuntimeConfig.model = model;
    if (baseUrl) activeRuntimeConfig.baseUrl = baseUrl;

    updateEnvFile('AI_PROVIDER', provider);
    if (model) updateEnvFile('AI_MODEL', model);

    res.json({
        success: true,
        message: `Active AI provider switched to ${provider}`,
        active: activeRuntimeConfig
    });
});

// POST /api/ai/configure - Update Ollama base URL or configuration
router.post('/configure', (req, res) => {
    const { baseUrl, provider, model } = req.body;
    if (baseUrl) {
        activeRuntimeConfig.baseUrl = baseUrl;
        updateEnvFile('OLLAMA_BASE_URL', baseUrl);
    }
    if (provider) {
        activeRuntimeConfig.provider = provider;
        updateEnvFile('AI_PROVIDER', provider);
    }
    if (model) {
        activeRuntimeConfig.model = model;
        updateEnvFile('AI_MODEL', model);
    }

    res.json({ success: true, message: 'AI configuration updated', active: activeRuntimeConfig });
});

// POST /api/ai/parse - Parse NL query directly
router.post('/parse', async (req, res) => {
    const { query, provider, model } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        const providerConfig = {
            provider: provider || activeRuntimeConfig.provider,
            model: model || activeRuntimeConfig.model,
            baseUrl: activeRuntimeConfig.baseUrl
        };
        const parsed = await parseNaturalLanguageQuery(query, providerConfig);
        res.json({ parsed });
    } catch (error) {
        res.status(500).json({ error: 'Failed to parse query', details: error.message });
    }
});

// POST /api/ai/expand - Expand a query directly
router.post('/expand', async (req, res) => {
    const { niche, location, provider, model } = req.body;
    if (!niche) {
        return res.status(400).json({ error: 'Niche is required' });
    }

    try {
        const providerConfig = {
            provider: provider || activeRuntimeConfig.provider,
            model: model || activeRuntimeConfig.model,
            baseUrl: activeRuntimeConfig.baseUrl
        };
        const expanded = await expandQuery(niche, location, providerConfig);
        res.json({ expanded });
    } catch (error) {
        res.status(500).json({ error: 'Failed to expand query', details: error.message });
    }
});

export default router;
