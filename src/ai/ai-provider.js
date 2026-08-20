/**
 * Multi-Provider AI Abstraction Layer
 * Supports Ollama (Local), Google Gemini, OpenAI (ChatGPT), and Anthropic Claude.
 * Security: API keys are read server-side from environment variables, never logged in plain text,
 * and never echoed back in API responses.
 * 
 * Telemetry: Extracts exact token counts from API response bodies (Gemini usageMetadata, OpenAI usage, Claude usage)
 * and real-time rate limit headers.
 */

// In-memory quota store to keep track of the latest actual usage & rate limit headers per provider
const quotaStore = {
    gemini: { 
        remaining: null, 
        total: null, 
        reset: null, 
        lastUpdated: null, 
        totalTokensConsumed: 0, 
        lastRequestTokens: 0, 
        requestsCount: 0,
        note: null 
    },
    openai: { 
        remaining: null, 
        total: null, 
        reset: null, 
        lastUpdated: null, 
        totalTokensConsumed: 0, 
        lastRequestTokens: 0, 
        requestsCount: 0,
        note: null 
    },
    claude: { 
        remaining: null, 
        total: null, 
        reset: null, 
        lastUpdated: null, 
        totalTokensConsumed: 0, 
        lastRequestTokens: 0, 
        requestsCount: 0,
        note: null 
    },
    ollama: { 
        remaining: 'Unlimited (Local)', 
        total: null, 
        reset: null, 
        lastUpdated: null, 
        totalTokensConsumed: 0, 
        lastRequestTokens: 0, 
        requestsCount: 0,
        note: 'Running locally on machine' 
    }
};

// Default models per provider
export const DEFAULT_MODELS = {
    ollama: process.env.OLLAMA_MODEL || 'gemma3:4b',
    gemini: process.env.AI_MODEL || 'gemini-2.0-flash',
    openai: process.env.AI_MODEL || 'gpt-4o-mini',
    claude: process.env.AI_MODEL || 'claude-3-5-sonnet-20241022'
};

// Known popular text/chat models per provider for fallback / listing
export const POPULAR_MODELS = {
    gemini: [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Recommended & Fast)' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
    ],
    openai: [
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Affordable & Fast)' },
        { id: 'gpt-4o', name: 'GPT-4o (High Intelligence)' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ],
    claude: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
    ]
};

/**
 * Mask API key for secure logging
 * @param {string} key
 * @returns {string}
 */
export function maskApiKey(key) {
    if (!key || typeof key !== 'string') return '[NONE]';
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Clean up markdown wrapping from LLM JSON responses
 * @param {string} text 
 * @returns {string}
 */
function cleanJsonText(text) {
    let cleaned = (text || '').trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
    return cleaned.trim();
}

/**
 * Helper to get active API key from environment for a given provider
 */
export function getProviderApiKey(provider) {
    switch (provider) {
        case 'gemini':
            return process.env.GEMINI_API_KEY || '';
        case 'openai':
            return process.env.OPENAI_API_KEY || '';
        case 'claude':
            return process.env.CLAUDE_API_KEY || '';
        default:
            return '';
    }
}

/**
 * Helper to get provider base URL or defaults
 */
export function getProviderConfig(overrides = {}) {
    const defaultProvider = process.env.AI_PROVIDER || 'gemini';
    const provider = overrides.provider || defaultProvider;
    const model = overrides.model || DEFAULT_MODELS[provider];
    const baseUrl = overrides.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const apiKey = getProviderApiKey(provider);

    return {
        provider,
        model,
        baseUrl,
        apiKey
    };
}

/**
 * AI Provider Class
 */
export class AIProvider {
    /**
     * Get quota summary for all or a specific provider
     */
    getQuota(provider = null) {
        if (provider && quotaStore[provider]) {
            return quotaStore[provider];
        }
        return quotaStore;
    }

    /**
     * Check which providers have API keys configured
     */
    getConfiguredProviders() {
        return [
            {
                id: 'gemini',
                name: 'Google Gemini',
                isConfigured: Boolean(process.env.GEMINI_API_KEY),
                isLocal: false,
                defaultModel: DEFAULT_MODELS.gemini
            },
            {
                id: 'openai',
                name: 'OpenAI (ChatGPT)',
                isConfigured: Boolean(process.env.OPENAI_API_KEY),
                isLocal: false,
                defaultModel: DEFAULT_MODELS.openai
            },
            {
                id: 'claude',
                name: 'Anthropic Claude',
                isConfigured: Boolean(process.env.CLAUDE_API_KEY),
                isLocal: false,
                defaultModel: DEFAULT_MODELS.claude
            },
            {
                id: 'ollama',
                name: 'Ollama (Local)',
                isConfigured: true,
                isLocal: true,
                defaultModel: DEFAULT_MODELS.ollama
            }
        ];
    }

    /**
     * Check provider health
     */
    async healthCheck(configOverride = {}) {
        const config = getProviderConfig(configOverride);

        switch (config.provider) {
            case 'ollama':
                return this.healthCheckOllama(config);
            case 'gemini':
                return this.healthCheckGemini(config);
            case 'openai':
                return this.healthCheckOpenAI(config);
            case 'claude':
                return this.healthCheckClaude(config);
            default:
                return { healthy: false, error: `Unknown provider: ${config.provider}` };
        }
    }

    async healthCheckOllama(config) {
        try {
            const res = await fetch(`${config.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) {
                return { healthy: false, provider: 'ollama', error: `HTTP ${res.status} from Ollama` };
            }
            const data = await res.json();
            const models = (data.models || []).map(m => m.name);
            return {
                healthy: true,
                provider: 'ollama',
                url: config.baseUrl,
                model: config.model,
                availableModels: models
            };
        } catch (err) {
            return { healthy: false, provider: 'ollama', error: `Ollama offline: ${err.message}` };
        }
    }

    async healthCheckGemini(config) {
        if (!config.apiKey) {
            return { healthy: false, provider: 'gemini', error: 'GEMINI_API_KEY not configured in .env' };
        }
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`, {
                signal: AbortSignal.timeout(5000)
            });
            if (!res.ok) {
                return { healthy: false, provider: 'gemini', error: `Gemini API error: HTTP ${res.status}` };
            }
            return { healthy: true, provider: 'gemini', model: config.model };
        } catch (err) {
            return { healthy: false, provider: 'gemini', error: `Gemini connection failed: ${err.message}` };
        }
    }

    async healthCheckOpenAI(config) {
        if (!config.apiKey) {
            return { healthy: false, provider: 'openai', error: 'OPENAI_API_KEY not configured in .env' };
        }
        try {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${config.apiKey}` },
                signal: AbortSignal.timeout(5000)
            });
            if (!res.ok) {
                return { healthy: false, provider: 'openai', error: `OpenAI API error: HTTP ${res.status}` };
            }
            return { healthy: true, provider: 'openai', model: config.model };
        } catch (err) {
            return { healthy: false, provider: 'openai', error: `OpenAI connection failed: ${err.message}` };
        }
    }

    async healthCheckClaude(config) {
        if (!config.apiKey) {
            return { healthy: false, provider: 'claude', error: 'CLAUDE_API_KEY not configured in .env' };
        }
        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': config.apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: config.model || DEFAULT_MODELS.claude,
                    max_tokens: 5,
                    messages: [{ role: 'user', content: 'hi' }]
                }),
                signal: AbortSignal.timeout(6000)
            });

            if (res.status === 401) {
                return { healthy: false, provider: 'claude', error: 'Invalid CLAUDE_API_KEY' };
            }
            if (res.ok || res.status === 400) {
                return { healthy: true, provider: 'claude', model: config.model };
            }
            return { healthy: false, provider: 'claude', error: `Claude API returned status ${res.status}` };
        } catch (err) {
            return { healthy: false, provider: 'claude', error: `Claude connection failed: ${err.message}` };
        }
    }

    /**
     * List available models for provider - STRICTLY FILTERED TO TEXT/CHAT LLMS ONLY
     */
    async listModels(configOverride = {}) {
        const config = getProviderConfig(configOverride);

        switch (config.provider) {
            case 'ollama': {
                try {
                    const res = await fetch(`${config.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
                    if (!res.ok) return [];
                    const data = await res.json();
                    return (data.models || [])
                        .filter(m => !/embed|bge|nomic/i.test(m.name))
                        .map(m => ({ id: m.name, name: m.name }));
                } catch {
                    return [{ id: config.model, name: config.model }];
                }
            }

            case 'gemini': {
                if (!config.apiKey) return POPULAR_MODELS.gemini;
                try {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`, {
                        signal: AbortSignal.timeout(6000)
                    });
                    if (!res.ok) return POPULAR_MODELS.gemini;
                    const data = await res.json();

                    // Non-text filter regex: Excludes Imagen, Veo, embeddings, audio, aqa, etc.
                    const nonTextFilter = /imagen|veo|embed|aqa|audio|deepresearch|learnlm|vision/i;

                    const models = (data.models || [])
                        .filter(m => {
                            const id = m.name.replace(/^models\//, '');
                            const isGemini = /^gemini-/i.test(id);
                            const supportsGenerate = m.supportedGenerationMethods?.includes('generateContent');
                            const isNotMedia = !nonTextFilter.test(id) && !nonTextFilter.test(m.displayName || '');
                            return isGemini && supportsGenerate && isNotMedia;
                        })
                        .map(m => ({
                            id: m.name.replace(/^models\//, ''),
                            name: m.displayName ? `${m.displayName} (${m.name.replace(/^models\//, '')})` : m.name.replace(/^models\//, '')
                        }));

                    return models.length > 0 ? models : POPULAR_MODELS.gemini;
                } catch {
                    return POPULAR_MODELS.gemini;
                }
            }

            case 'openai': {
                if (!config.apiKey) return POPULAR_MODELS.openai;
                try {
                    const res = await fetch('https://api.openai.com/v1/models', {
                        headers: { 'Authorization': `Bearer ${config.apiKey}` },
                        signal: AbortSignal.timeout(6000)
                    });
                    if (!res.ok) return POPULAR_MODELS.openai;
                    const data = await res.json();

                    const nonTextFilter = /audio|realtime|instruct|whisper|dall-e|embedding|embed|moderation|tts|babbage|davinci/i;

                    const chatModels = (data.data || [])
                        .filter(m => {
                            const isChat = /^(gpt-4|gpt-3\.5|o1|o3)/i.test(m.id);
                            const isNotMedia = !nonTextFilter.test(m.id);
                            return isChat && isNotMedia;
                        })
                        .map(m => ({ id: m.id, name: m.id }))
                        .sort((a, b) => a.id.localeCompare(b.id));

                    return chatModels.length > 0 ? chatModels : POPULAR_MODELS.openai;
                } catch {
                    return POPULAR_MODELS.openai;
                }
            }

            case 'claude':
                return POPULAR_MODELS.claude;

            default:
                return [];
        }
    }

    /**
     * Generate JSON output from prompt
     * @param {string} prompt - Main prompt
     * @param {object} configOverride - Provider config override
     * @param {string} systemPrompt - Optional explicit system prompt
     * @returns {Promise<{ data: object, quota: object }>}
     */
    async generateJSON(prompt, configOverride = {}, systemPrompt = null) {
        const config = getProviderConfig(configOverride);
        const sysPrompt = systemPrompt || 'You are an AI assistant specialized in structuring data. You MUST return ONLY valid JSON. Do not include markdown code blocks, do not include explanations. ONLY raw JSON.';

        console.log(`[AI Provider] Calling ${config.provider} (${config.model}) with key ${maskApiKey(config.apiKey)}`);

        switch (config.provider) {
            case 'gemini':
                return this.generateGemini(prompt, sysPrompt, config);
            case 'openai':
                return this.generateOpenAI(prompt, sysPrompt, config);
            case 'claude':
                return this.generateClaude(prompt, sysPrompt, config);
            case 'ollama':
            default:
                return this.generateOllama(prompt, sysPrompt, config);
        }
    }

    /**
     * Ollama generation
     */
    async generateOllama(prompt, systemPrompt, config) {
        const fullPrompt = `${systemPrompt}\n\n${prompt}`;
        const res = await fetch(`${config.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                prompt: fullPrompt,
                stream: false,
                format: 'json',
                options: { temperature: 0.2 }
            }),
            signal: AbortSignal.timeout(30000)
        });

        if (!res.ok) {
            throw new Error(`Ollama API error: HTTP ${res.status}`);
        }

        const data = await res.json();
        const cleaned = cleanJsonText(data.response);
        const parsed = JSON.parse(cleaned);

        quotaStore.ollama.requestsCount += 1;
        quotaStore.ollama.lastUpdated = new Date().toISOString();

        return {
            data: parsed,
            quota: quotaStore.ollama
        };
    }

    /**
     * Google Gemini generation with actual usageMetadata token tracking
     */
    async generateGemini(prompt, systemPrompt, config) {
        if (!config.apiKey) {
            throw new Error('GEMINI_API_KEY is not configured in .env');
        }

        const model = config.model || DEFAULT_MODELS.gemini;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

        const payload = {
            system_instruction: {
                parts: [{ text: systemPrompt }]
            },
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                response_mime_type: 'application/json',
                temperature: 0.2
            }
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000)
        });

        // Extract rate limit headers if available
        const remainingReq = res.headers.get('x-ratelimit-remaining-requests') || res.headers.get('x-goog-ratelimit-remaining-requests');
        if (remainingReq) {
            quotaStore.gemini.remaining = parseInt(remainingReq, 10);
        }

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Gemini API error (HTTP ${res.status}): ${errBody}`);
        }

        const json = await res.json();
        const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidate) {
            throw new Error('Empty response from Gemini API');
        }

        // Exact token usage from Gemini response body
        if (json.usageMetadata) {
            const totalTokens = json.usageMetadata.totalTokenCount || 0;
            quotaStore.gemini.totalTokensConsumed += totalTokens;
            quotaStore.gemini.lastRequestTokens = totalTokens;
        }

        quotaStore.gemini.requestsCount += 1;
        quotaStore.gemini.lastUpdated = new Date().toISOString();

        const cleaned = cleanJsonText(candidate);
        const parsed = JSON.parse(cleaned);

        return {
            data: parsed,
            quota: quotaStore.gemini
        };
    }

    /**
     * OpenAI generation with actual usage token tracking
     */
    async generateOpenAI(prompt, systemPrompt, config) {
        if (!config.apiKey) {
            throw new Error('OPENAI_API_KEY is not configured in .env');
        }

        const model = config.model || DEFAULT_MODELS.openai;
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.2
            }),
            signal: AbortSignal.timeout(30000)
        });

        // Parse rate limit headers
        const remainingReq = res.headers.get('x-ratelimit-remaining-requests');
        const resetReq = res.headers.get('x-ratelimit-reset-requests');

        if (remainingReq !== null) {
            quotaStore.openai.remaining = parseInt(remainingReq, 10);
            quotaStore.openai.total = res.headers.get('x-ratelimit-limit-requests') ? parseInt(res.headers.get('x-ratelimit-limit-requests'), 10) : null;
            quotaStore.openai.reset = resetReq;
        }

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`OpenAI API error (HTTP ${res.status}): ${errBody}`);
        }

        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }

        // Exact tokens from OpenAI response
        if (json.usage) {
            const totalTokens = json.usage.total_tokens || 0;
            quotaStore.openai.totalTokensConsumed += totalTokens;
            quotaStore.openai.lastRequestTokens = totalTokens;
        }

        quotaStore.openai.requestsCount += 1;
        quotaStore.openai.lastUpdated = new Date().toISOString();

        const cleaned = cleanJsonText(content);
        const parsed = JSON.parse(cleaned);

        return {
            data: parsed,
            quota: quotaStore.openai
        };
    }

    /**
     * Anthropic Claude generation with actual usage token tracking
     */
    async generateClaude(prompt, systemPrompt, config) {
        if (!config.apiKey) {
            throw new Error('CLAUDE_API_KEY is not configured in .env');
        }

        const model = config.model || DEFAULT_MODELS.claude;
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                system: `${systemPrompt} Output raw JSON only.`,
                max_tokens: 2048,
                temperature: 0.2,
                messages: [
                    { role: 'user', content: prompt }
                ]
            }),
            signal: AbortSignal.timeout(30000)
        });

        // Parse rate limit headers
        const remainingReq = res.headers.get('anthropic-ratelimit-requests-remaining');
        const resetReq = res.headers.get('anthropic-ratelimit-requests-reset');

        if (remainingReq !== null) {
            quotaStore.claude.remaining = parseInt(remainingReq, 10);
            quotaStore.claude.total = res.headers.get('anthropic-ratelimit-requests-limit') ? parseInt(res.headers.get('anthropic-ratelimit-requests-limit'), 10) : null;
            quotaStore.claude.reset = resetReq;
        }

        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Claude API error (HTTP ${res.status}): ${errBody}`);
        }

        const json = await res.json();
        const contentBlock = json.content?.find(c => c.type === 'text');
        const text = contentBlock ? contentBlock.text : '';

        // Exact tokens from Claude response
        if (json.usage) {
            const totalTokens = (json.usage.input_tokens || 0) + (json.usage.output_tokens || 0);
            quotaStore.claude.totalTokensConsumed += totalTokens;
            quotaStore.claude.lastRequestTokens = totalTokens;
        }

        quotaStore.claude.requestsCount += 1;
        quotaStore.claude.lastUpdated = new Date().toISOString();

        const cleaned = cleanJsonText(text);
        const parsed = JSON.parse(cleaned);

        return {
            data: parsed,
            quota: quotaStore.claude
        };
    }
}

export const aiProvider = new AIProvider();
