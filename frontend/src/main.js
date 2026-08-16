import { renderSearchForm } from './components/search-form.js';
import { renderProgressBar, updateProgress, resetProgress } from './components/progress-bar.js';
import { renderResultsTable, appendLead, clearTable } from './components/results-table.js';
import { logMessage, clearConsole } from './components/console-log.js';
import { renderExportControls, enableExport, disableExport, handleExportClick } from './components/export-controls.js';

let currentEventSource = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize UI Components
    renderSearchForm(document.getElementById('searchFormContainer'));
    renderProgressBar(document.getElementById('progressContainer'));
    renderResultsTable(document.getElementById('resultsTableContainer'));
    renderExportControls(document.getElementById('exportControlsContainer'));

    // Bind event listeners
    document.getElementById('searchForm').addEventListener('submit', handleSearchSubmit);
    document.getElementById('clearConsoleBtn').addEventListener('click', clearConsole);
    document.getElementById('exportCsvBtn').addEventListener('click', handleExportClick);
    
    // Dialog listeners
    const dialog = document.getElementById('settingsDialog');
    document.getElementById('openSettingsBtn').addEventListener('click', () => dialog.showModal());
    document.getElementById('closeSettingsBtn').addEventListener('click', () => dialog.close());

    // Check AI status
    await checkAiStatus();
});

async function checkAiStatus() {
    const badge = document.getElementById('aiStatusBadge');
    const dot = badge.querySelector('.status-dot');
    const text = badge.querySelector('.status-text');

    try {
        const response = await fetch('/api/ai/health');
        const data = await response.json();
        
        if (data.healthy) {
            dot.className = 'status-dot healthy';
            text.innerText = 'AI Ready (Gemma)';
        } else {
            dot.className = 'status-dot error';
            text.innerText = 'AI Offline';
        }
    } catch (e) {
        dot.className = 'status-dot error';
        text.innerText = 'Server Offline';
    }
}

async function handleSearchSubmit(e) {
    e.preventDefault();
    
    // Close existing connection if any
    if (currentEventSource) {
        currentEventSource.close();
    }

    const submitBtn = document.getElementById('startSearchBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Scraping...';
    
    document.getElementById('progressContainer').classList.remove('hidden');
    clearTable();
    disableExport();
    resetProgress();
    
    const query = document.getElementById('searchQuery').value;
    const location = document.getElementById('locationInput').value;
    const radius = document.getElementById('radiusInput').value;
    const maxLeads = document.getElementById('maxLeadsInput').value;
    const enableAi = document.getElementById('enableAiToggle').checked;

    logMessage('Starting new search job...', 'info');

    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, location, radius, maxLeads, enableAi })
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error);

        connectStream(data.jobId);
    } catch (error) {
        logMessage(`Failed to start search: ${error.message}`, 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Start Scraping';
    }
}

function connectStream(jobId) {
    currentEventSource = new EventSource(`/api/search/${jobId}/stream`);
    let leadCount = 0;

    currentEventSource.addEventListener('connection', (e) => {
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

    currentEventSource.addEventListener('lead', (e) => {
        const lead = JSON.parse(e.data);
        leadCount++;
        appendLead(lead, leadCount);
    });

    currentEventSource.addEventListener('refresh_leads', (e) => {
        // When AI filtering happens, we need to replace the whole table
        const leads = JSON.parse(e.data);
        clearTable();
        leadCount = 0;
        for (const lead of leads) {
            leadCount++;
            appendLead(lead, leadCount);
        }
        logMessage(`Table refreshed with ${leads.length} filtered leads.`, 'info');
    });

    currentEventSource.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data);
        logMessage(`Search completed. Total leads finalized: ${data.totalLeads}`, 'success');
        finishSearch(jobId);
    });

    currentEventSource.addEventListener('error', (e) => {
        if (e.data) {
            const data = JSON.parse(e.data);
            logMessage(`Stream error: ${data.message}`, 'error');
        } else {
             logMessage('Stream disconnected.', 'warn');
        }
        finishSearch(jobId);
    });
}

function finishSearch(jobId) {
    if (currentEventSource) {
        currentEventSource.close();
    }
    
    const submitBtn = document.getElementById('startSearchBtn');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Start Scraping';
    
    enableExport(jobId);
}
