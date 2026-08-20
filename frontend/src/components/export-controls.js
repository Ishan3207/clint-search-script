export function renderExportControls(container) {
    container.innerHTML = `
        <button id="exportCsvBtn" class="btn btn-secondary btn-sm" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export CSV
        </button>
    `;
}

export function enableExport(jobId) {
    const btn = document.getElementById('exportCsvBtn');
    if (btn) {
        btn.disabled = false;
        btn.dataset.jobId = jobId;
    }
}

export function disableExport() {
     const btn = document.getElementById('exportCsvBtn');
     if (btn) btn.disabled = true;
}

export async function handleExportClick() {
    const btn = document.getElementById('exportCsvBtn');
    const jobId = btn?.dataset?.jobId;
    
    if (!jobId) return;
    
    try {
        const response = await fetch('/api/export/csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId })
        });
        
        if (!response.ok) throw new Error('Export failed');
        
        // Handle file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads_export_${jobId}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (e) {
        console.error('Failed to export CSV', e);
        alert('Failed to export CSV. See console for details.');
    }
}
