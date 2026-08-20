import { renderSearchForm } from './components/search-form.js';
import { renderProgressBar, updateProgress, resetProgress } from './components/progress-bar.js';
import { renderResultsTable, appendLead, clearTable } from './components/results-table.js';
import { logMessage, clearConsole, openConsoleDrawer, closeConsoleDrawer, toggleConsoleDrawer } from './components/console-log.js';
import { renderExportControls, enableExport, disableExport, handleExportClick } from './components/export-controls.js';
import { renderSkeleton } from './components/skeleton-loader.js';
import { showToast } from './components/toast.js';
import { setupMobileMenu } from './components/mobile-menu.js';
import { setupResizablePanels } from './components/resizable-panel.js';

let currentEventSource = null;
let currentJobId = null;
let activeProvider = 'gemini';
let activeModel = '';
let sessionAiCalls = 0;
let lastQuotaMetrics = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Instantly display skeleton placeholders
    renderSkeleton(document.getElementById('searchFormContainer'), 'search-form');
    renderSkeleton(document.getElementById('resultsTableContainer'), 'results-table');
    renderSkeleton(document.getElementById('consoleLogContainer'), 'console');

    // 2. Setup Mobile Navigation & Resizable Splitters
    setupMobileMenu();
    setupResizablePanels();

    // 3. Render real UI Components
    setTimeout(async () => {
        renderSearchForm(document.getElementById('searchFormContainer'));
        renderProgressBar(document.getElementById('progressContainer'));
        renderResultsTable(document.getElementById('resultsTableContainer'));
        renderExportControls(document.getElementById('exportControlsContainer'));

        // Bind events
        document.getElementById('searchForm').addEventListener('submit', handleSearchSubmit);
        document.getElementById('clearConsoleBtn').addEventListener('click', clearConsole);
        document.getElementById('exportCsvBtn').addEventListener('click', handleExportClick);
        document.getElementById('stopSearchBtn').addEventListener('click', handleStopSearch);

        // Console Drawer Events
        const toggleConsoleBtn = document.getElementById('consoleToggleBtn');
        const minimizeConsoleBtn = document.getElementById('minimizeConsoleBtn');
        if (toggleConsoleBtn) toggleConsoleBtn.addEventListener('click', toggleConsoleDrawer);
        if (minimizeConsoleBtn) minimizeConsoleBtn.addEventListener('click', closeConsoleDrawer);

        // Load active provider & model info & initialize quota meter
        await loadActiveProviderState();
        updateCircularQuotaMeter();
    }, 150);
});

/**
 * Load Active AI Provider state from server and update chat chips
 */
async function loadActiveProviderState() {
    try {
        const res = await fetch('/api/ai/providers');
        const data = await res.json();

        if (data.active) {
            activeProvider = data.active.provider || 'gemini';
            activeModel = data.active.model || '';
        }

        const icons = { gemini: '✨', openai: '⚡', claude: '🧠', ollama: '🖥️' };
        const icon = icons[activeProvider] || '🤖';
        const label = `${icon} ${activeProvider.toUpperCase()}${activeModel ? ` (${activeModel})` : ''}`;

        const chipText = document.getElementById('chatModelChipText');
        if (chipText) chipText.innerText = label;

        updateHeaderAiBadge(true, label);
    } catch {
        updateHeaderAiBadge(false, 'AI Offline');
    }
}

function updateHeaderAiBadge(healthy, text) {
    const badges = [document.getElementById('aiStatusBadge'), document.getElementById('mobileAiStatusBadge')];
    badges.forEach(badge => {
        if (!badge) return;
        const dot = badge.querySelector('.status-dot');
        const span = badge.querySelector('.status-text');
        if (dot) dot.className = `status-dot ${healthy ? 'healthy' : 'error'}`;
        if (span) span.innerText = text;
    });
}

/**
 * Updates the circular SVG quota progress meter on the chat bar using exact API token usage & rate limits
 */
export function updateCircularQuotaMeter(quotaData = null) {
    if (quotaData) lastQuotaMetrics = quotaData;

    const fillPath = document.getElementById('quotaMeterFill');
    const centerText = document.getElementById('quotaMeterCenter');
    const tooltipModel = document.getElementById('quotaTooltipModel');
    const tooltipDetail = document.getElementById('quotaTooltipDetail');

    if (!fillPath || !centerText) return;

    let percentage = 0;
    let detailHtml = `Session requests: ${sessionAiCalls}`;

    if (lastQuotaMetrics) {
        const tokens = lastQuotaMetrics.totalTokensConsumed || 0;
        const reqs = lastQuotaMetrics.requestsCount || sessionAiCalls;
        
        if (lastQuotaMetrics.remaining !== null && lastQuotaMetrics.total) {
            const remaining = parseInt(lastQuotaMetrics.remaining, 10);
            const total = parseInt(lastQuotaMetrics.total, 10);
            const used = Math.max(0, total - remaining);
            percentage = Math.min(100, Math.round((used / total) * 100));
            detailHtml = `<div>Quota: ${remaining} / ${total} remaining (${percentage}% used)</div><div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">Exact Tokens Used: ${tokens.toLocaleString()} | Calls: ${reqs}</div>`;
        } else {
            // Free Tier (e.g. Gemini 15 RPM / 1M TPM context limit)
            percentage = Math.min(100, Math.round((tokens / 100000) * 100) || Math.min(100, reqs * 10));
            detailHtml = `<div>Tokens Consumed: ${tokens.toLocaleString()}</div><div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">Total API Calls: ${reqs} | Provider: ${activeProvider.toUpperCase()}</div>`;
        }
    } else {
        percentage = Math.min(100, sessionAiCalls * 10);
    }

    fillPath.setAttribute('stroke-dasharray', `${percentage}, 100`);
    centerText.innerText = `${percentage}%`;

    // Color gradient classes
    fillPath.classList.remove('warn', 'danger');
    if (percentage >= 75) {
        fillPath.classList.add('danger');
    } else if (percentage >= 40) {
        fillPath.classList.add('warn');
    }

    if (tooltipModel) tooltipModel.innerText = `${activeProvider.toUpperCase()} Actual Usage`;
    if (tooltipDetail) tooltipDetail.innerHTML = detailHtml;
}

/**
 * Search submit handler
 */
async function handleSearchSubmit(e) {
    e.preventDefault();

    if (currentEventSource) {
        currentEventSource.close();
    }

    sessionAiCalls += 1;
    updateCircularQuotaMeter();

    const submitBtn = document.getElementById('startSearchBtn');
    const stopBtn = document.getElementById('stopSearchBtn');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Scraping...</span> <span class="live-pulse-dot"></span>';
    stopBtn.classList.remove('hidden');

    document.getElementById('progressContainer').classList.remove('hidden');
    clearTable();
    disableExport();
    resetProgress();

    // ⚡ AUTO-SLIDE OPEN THE LIVE CONSOLE WINDOW
    openConsoleDrawer();
    const jobStatusText = document.getElementById('consoleJobStatus');
    if (jobStatusText) jobStatusText.innerText = 'Scraping in progress...';

    const query = document.getElementById('searchQuery').value;
    const locationInput = document.getElementById('locationInput');
    const radiusInput = document.getElementById('radiusInput');
    const maxLeadsInput = document.getElementById('maxLeadsInput');

    const location = locationInput ? locationInput.value : '';
    const radius = radiusInput ? radiusInput.value : '10km';
    const maxLeads = maxLeadsInput ? maxLeadsInput.value : 'All';

    logMessage(`Starting search pipeline with AI provider: [${activeProvider}]...`, 'info');
    showToast('Search pipeline initiated...', 'info');

    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                location,
                radius,
                maxLeads,
                enableAi: true,
                aiProvider: activeProvider,
                aiModel: activeModel
            })
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error);

        currentJobId = data.jobId;
        connectStream(data.jobId);
    } catch (error) {
        logMessage(`Failed to start search: ${error.message}`, 'error');
        showToast(`Failed: ${error.message}`, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Find Leads</span> <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
        stopBtn.classList.add('hidden');
    }
}

async function handleStopSearch() {
    if (!currentJobId) return;

    const stopBtn = document.getElementById('stopSearchBtn');
    stopBtn.disabled = true;
    stopBtn.innerText = 'Stopping...';

    try {
        await fetch(`/api/search/${currentJobId}/cancel`, {
            method: 'POST'
        });
        logMessage('Stop signal sent. Closing browser contexts immediately...', 'warn');
        showToast('Terminating active search...', 'warn');
    } catch (e) {
        logMessage('Failed to send stop signal', 'error');
        showToast('Failed to cancel search', 'error');
    }
}

function connectStream(jobId) {
    currentEventSource = new EventSource(`/api/search/${jobId}/stream`);
    let leadCount = 0;

    currentEventSource.addEventListener('connection', () => {
        logMessage('Connected to live search stream.', 'success');
    });

    currentEventSource.addEventListener('log', (e) => {
        const data = JSON.parse(e.data);
        logMessage(data.message, data.type);
    });

    currentEventSource.addEventListener('progress', (e) => {
        const data = JSON.parse(e.data);
        updateProgress(data.percent, data.phase);
    });

    currentEventSource.addEventListener('quota', (e) => {
        const data = JSON.parse(e.data);
        updateCircularQuotaMeter(data);
    });

    currentEventSource.addEventListener('stats', (e) => {
        const data = JSON.parse(e.data);
        const percentText = document.getElementById('progressPercent');
        const leadsText = document.getElementById('progressLeads');
        const elapsedText = document.getElementById('progressElapsed');

        if (percentText) percentText.innerText = `${data.percent}%`;
        if (leadsText) leadsText.innerText = `Leads found: ${data.leadsFound}`;
        if (elapsedText) {
            const m = Math.floor(data.elapsed / 60);
            const s = data.elapsed % 60;
            elapsedText.innerText = `Elapsed: ${m}m ${s}s`;
        }
    });

    currentEventSource.addEventListener('lead', (e) => {
        const lead = JSON.parse(e.data);
        leadCount++;
        appendLead(lead, leadCount);
    });

    currentEventSource.addEventListener('refresh_leads', (e) => {
        const leads = JSON.parse(e.data);
        clearTable();
        leadCount = 0;
        for (const lead of leads) {
            leadCount++;
            appendLead(lead, leadCount);
        }
        logMessage(`Results refreshed: ${leads.length} qualified leads.`, 'info');
        showToast(`Filtered to ${leads.length} matching leads`, 'info');
    });

    currentEventSource.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data);
        const jobStatusText = document.getElementById('consoleJobStatus');

        if (data.cancelled) {
            logMessage(`Search stopped. Total leads finalized: ${data.totalLeads}`, 'warn');
            showToast(`Search stopped (${data.totalLeads} leads)`, 'warn');
            if (jobStatusText) jobStatusText.innerText = 'Stopped';
        } else {
            logMessage(`Search completed! Total leads finalized: ${data.totalLeads}`, 'success');
            showToast(`Scraping complete: ${data.totalLeads} leads found!`, 'success');
            if (jobStatusText) jobStatusText.innerText = 'Completed';
        }
        finishSearch(jobId);
    });

    currentEventSource.addEventListener('error', (e) => {
        if (e.data) {
            const data = JSON.parse(e.data);
            logMessage(`Stream error: ${data.message}`, 'error');
            showToast(`Error: ${data.message}`, 'error');
        } else {
            logMessage('Stream disconnected.', 'warn');
        }
        finishSearch(jobId);
    });
}

function finishSearch(jobId) {
    if (currentEventSource) {
        currentEventSource.close();
        currentEventSource = null;
    }

    currentJobId = null;

    const submitBtn = document.getElementById('startSearchBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Find Leads</span> <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;

    const stopBtn = document.getElementById('stopSearchBtn');
    stopBtn.disabled = false;
    stopBtn.innerHTML = '<span class="btn-stop-icon">■</span> Stop';
    stopBtn.classList.add('hidden');

    enableExport(jobId);
}
