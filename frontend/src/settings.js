import { showToast } from './components/toast.js';

let activeProvider = 'gemini';
let providersData = [];
let quotaData = {};

const PROVIDER_METADATA = {
    gemini: {
        name: 'Google Gemini',
        icon: '✨',
        envVar: 'GEMINI_API_KEY',
        link: 'https://aistudio.google.com/apikey',
        linkText: 'Google AI Studio',
        desc: 'Fast, high-quality multimodal reasoning with generous free-tier quotas. Recommended for lead parsing and scoring.',
        defaultModel: 'gemini-2.0-flash',
        popularModels: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
    },
    openai: {
        name: 'OpenAI (ChatGPT)',
        icon: '⚡',
        envVar: 'OPENAI_API_KEY',
        link: 'https://platform.openai.com/api-keys',
        linkText: 'OpenAI Developer Dashboard',
        desc: 'Industry standard reasoning models (GPT-4o Mini, GPT-4o) with native JSON mode and rate-limit telemetry.',
        defaultModel: 'gpt-4o-mini',
        popularModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']
    },
    claude: {
        name: 'Anthropic Claude',
        icon: '🧠',
        envVar: 'CLAUDE_API_KEY',
        link: 'https://console.anthropic.com/settings/keys',
        linkText: 'Anthropic Console',
        desc: 'Advanced natural language understanding with Claude 3.5 Sonnet and high-speed Claude 3.5 Haiku.',
        defaultModel: 'claude-3-5-sonnet-20241022',
        popularModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
    },
    ollama: {
        name: 'Ollama (Local AI)',
        icon: '🖥️',
        envVar: 'OLLAMA_BASE_URL',
        link: 'https://ollama.com',
        linkText: 'Ollama Official Website',
        desc: 'Run completely offline models (Gemma 3, Llama 3) directly on your machine. Desktop only; zero API costs.',
        defaultModel: 'gemma3:4b',
        popularModels: ['gemma3:4b', 'llama3:8b', 'mistral']
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    setupNav();
    await loadProviders();
    await loadQuota();
    renderProviderConfig(activeProvider);
});

function setupNav() {
    const list = document.getElementById('providerNavList');
    if (!list) return;

    list.querySelectorAll('.provider-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const provider = item.getAttribute('data-provider');
            activeProvider = provider;

            list.querySelectorAll('.provider-nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            renderProviderConfig(provider);
        });
    });
}

async function loadProviders() {
    try {
        const res = await fetch('/api/ai/providers');
        const data = await res.json();
        providersData = data.providers || [];

        // Update badges
        providersData.forEach(p => {
            const badge = document.getElementById(`${p.id}EnvBadge`);
            if (badge) {
                if (p.isConfigured) {
                    badge.classList.remove('hidden');
                    badge.innerText = p.isLocal ? 'Ready' : 'Configured';
                } else {
                    badge.classList.add('hidden');
                }
            }
        });

        const activeBadge = document.getElementById('activeProviderBadge');
        if (activeBadge && data.active) {
            const dot = activeBadge.querySelector('.status-dot');
            const text = activeBadge.querySelector('.status-text');
            if (dot) dot.className = 'status-dot healthy';
            if (text) text.innerText = `Active: ${data.active.provider.toUpperCase()}`;
        }
    } catch (e) {
        showToast('Failed to load AI providers from server', 'error');
    }
}

async function loadQuota() {
    try {
        const res = await fetch('/api/ai/quota');
        const data = await res.json();
        quotaData = data.quota || {};
    } catch {
        quotaData = {};
    }
}

function renderProviderConfig(provider) {
    const container = document.getElementById('providerConfigPanel');
    if (!container) return;

    const meta = PROVIDER_METADATA[provider] || PROVIDER_METADATA.gemini;
    const providerState = providersData.find(p => p.id === provider) || { isConfigured: false };
    const quota = quotaData[provider] || {};

    let contentHtml = '';

    if (provider === 'ollama') {
        contentHtml = `
            <div class="config-section-title">
                <span>${meta.icon}</span> ${meta.name}
            </div>
            <p class="config-desc">${meta.desc}</p>

            <div class="input-group" style="margin-bottom: 1.25rem;">
                <label for="settingsOllamaUrl">Ollama Server Endpoint</label>
                <input type="text" id="settingsOllamaUrl" value="http://localhost:11434">
            </div>

            <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <button class="btn btn-secondary" id="testSettingsBtn">Test Connection</button>
                <button class="btn btn-primary" id="setActiveProviderBtn">Set as Active Provider</button>
            </div>

            <div class="quota-stat-box">
                <div class="quota-stat-card">
                    <div class="quota-stat-label">Model Quota</div>
                    <div class="quota-stat-value" style="color: #10b981;">Unlimited</div>
                </div>
                <div class="quota-stat-card">
                    <div class="quota-stat-label">Location</div>
                    <div class="quota-stat-value">Local Machine</div>
                </div>
            </div>
        `;
    } else {
        const isConfigured = providerState.isConfigured;
        contentHtml = `
            <div class="config-section-title">
                <span>${meta.icon}</span> ${meta.name}
            </div>
            <p class="config-desc">${meta.desc}</p>

            <!-- Status Indicator -->
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem;">
                <span class="status-dot ${isConfigured ? 'healthy' : 'error'}"></span>
                <span style="font-size: 0.85rem; font-weight: 600;">
                    ${isConfigured ? '✓ API Key is configured & active' : '⚠️ No API Key saved yet'}
                </span>
            </div>

            <!-- Direct API Key Input Card -->
            <div style="background: var(--bg-input); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem; border: 1px solid var(--border-subtle);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <label for="directApiKeyInput" style="font-weight: 600; font-size: 0.85rem;">Enter ${meta.name} API Key:</label>
                    <a href="${meta.link}" target="_blank" style="color: var(--accent-primary, #6366f1); font-size: 0.78rem; text-decoration: underline;">Get free key at ${meta.linkText} ↗</a>
                </div>
                
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <div style="position: relative; flex: 1;">
                        <input type="password" id="directApiKeyInput" placeholder="Paste your ${meta.envVar} here..." autocomplete="off">
                        <button type="button" id="toggleKeyVisibilityBtn" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.85rem; padding: 4px;">👁️</button>
                    </div>
                    <button type="button" class="btn btn-primary" id="saveApiKeyBtn">Save & Verify</button>
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">
                    🔒 Keys are saved securely to your local <code>.env</code> and will never be committed to GitHub.
                </div>
            </div>

            <!-- Model Selection & Testing -->
            <div class="input-group" style="margin-bottom: 1.25rem;">
                <label for="settingsModelSelect">Selected Model</label>
                <div style="display: flex; gap: 0.5rem;">
                    <select id="settingsModelSelect" style="flex: 1;">
                        ${meta.popularModels.map(m => `<option value="${m}">${m}</option>`).join('')}
                    </select>
                    <button class="btn btn-secondary" id="testSettingsBtn">Load Models</button>
                </div>
            </div>

            <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <button class="btn btn-primary" id="setActiveProviderBtn">Set as Active AI Provider</button>
            </div>

            <!-- Quota & Rate Limit Telemetry -->
            <h4 style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;">Live Quota Telemetry</h4>
            <div class="quota-stat-box">
                <div class="quota-stat-card">
                    <div class="quota-stat-label">Remaining Requests</div>
                    <div class="quota-stat-value" id="quotaRemainingVal">${quota.remaining !== null && quota.remaining !== undefined ? quota.remaining : 'Unavailable'}</div>
                </div>
                <div class="quota-stat-card">
                    <div class="quota-stat-label">Total Limit</div>
                    <div class="quota-stat-value" id="quotaTotalVal">${quota.total !== null && quota.total !== undefined ? quota.total : 'Per Tier'}</div>
                </div>
                <div class="quota-stat-card">
                    <div class="quota-stat-label">Reset Window</div>
                    <div class="quota-stat-value" id="quotaResetVal" style="font-size: 0.85rem;">${quota.reset ? quota.reset : 'Active'}</div>
                </div>
            </div>

            <div class="quota-caveat-note" style="margin-top: 1rem;">
                <span class="caveat-icon">ℹ️</span>
                <span>Custom API keys (free tiers or restricted organization keys) may not return rate-limit telemetry headers. Refer to your provider console for official quota counts.</span>
            </div>
        `;
    }

    container.innerHTML = contentHtml;

    // Toggle password visibility
    const toggleBtn = document.getElementById('toggleKeyVisibilityBtn');
    const keyInput = document.getElementById('directApiKeyInput');
    if (toggleBtn && keyInput) {
        toggleBtn.addEventListener('click', () => {
            if (keyInput.type === 'password') {
                keyInput.type = 'text';
                toggleBtn.innerText = '🔒';
            } else {
                keyInput.type = 'password';
                toggleBtn.innerText = '👁️';
            }
        });
    }

    // Direct save key button
    const saveBtn = document.getElementById('saveApiKeyBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => handleSaveKey(provider));
    }

    // Attach listeners
    const testBtn = document.getElementById('testSettingsBtn');
    if (testBtn) {
        testBtn.addEventListener('click', () => handleTestProvider(provider));
    }

    const setActiveBtn = document.getElementById('setActiveProviderBtn');
    if (setActiveBtn) {
        setActiveBtn.addEventListener('click', () => handleSetActive(provider));
    }
}

async function handleSaveKey(provider) {
    const keyInput = document.getElementById('directApiKeyInput');
    const modelSelect = document.getElementById('settingsModelSelect');
    const saveBtn = document.getElementById('saveApiKeyBtn');

    if (!keyInput || !keyInput.value.trim()) {
        showToast('Please enter an API key', 'error');
        return;
    }

    const apiKey = keyInput.value.trim();
    const model = modelSelect ? modelSelect.value : '';

    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    try {
        const res = await fetch('/api/ai/save-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, apiKey, model })
        });
        const data = await res.json();

        if (data.success) {
            if (data.healthy) {
                showToast(`✓ ${provider.toUpperCase()} API key saved and verified successfully!`, 'success');
            } else {
                showToast(`Key saved, but verification reported: ${data.error}`, 'warn');
            }
            await loadProviders();
            await loadQuota();
            renderProviderConfig(provider);
        } else {
            showToast(`Error: ${data.error}`, 'error');
        }
    } catch (e) {
        showToast(`Save failed: ${e.message}`, 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = 'Save & Verify';
        }
    }
}

async function handleTestProvider(provider) {
    const testBtn = document.getElementById('testSettingsBtn');
    if (testBtn) {
        testBtn.disabled = true;
        testBtn.innerText = 'Loading...';
    }

    try {
        const healthRes = await fetch(`/api/ai/health?provider=${provider}`);
        const healthData = await healthRes.json();

        if (healthData.healthy) {
            showToast(`${provider.toUpperCase()} connection verified!`, 'success');

            // Load dynamic models
            const modelsRes = await fetch(`/api/ai/models?provider=${provider}`);
            const modelsData = await modelsRes.json();

            const select = document.getElementById('settingsModelSelect');
            if (select && modelsData.models && modelsData.models.length > 0) {
                select.innerHTML = '';
                modelsData.models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.name || m.id;
                    select.appendChild(opt);
                });
            }

            await loadQuota();
            await loadProviders();
        } else {
            showToast(`Connection failed: ${healthData.error}`, 'error');
        }
    } catch (e) {
        showToast(`Test failed: ${e.message}`, 'error');
    } finally {
        if (testBtn) {
            testBtn.disabled = false;
            testBtn.innerText = provider === 'ollama' ? 'Test Connection' : 'Load Models';
        }
    }
}

async function handleSetActive(provider) {
    const select = document.getElementById('settingsModelSelect');
    const model = select ? select.value : '';
    const ollamaInput = document.getElementById('settingsOllamaUrl');
    const baseUrl = ollamaInput ? ollamaInput.value : '';

    try {
        const res = await fetch('/api/ai/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, model, baseUrl })
        });
        const data = await res.json();

        if (data.success) {
            showToast(`Active AI provider set to ${provider.toUpperCase()}`, 'success');
            await loadProviders();
        } else {
            showToast(`Failed: ${data.error}`, 'error');
        }
    } catch (e) {
        showToast(`Error: ${e.message}`, 'error');
    }
}
