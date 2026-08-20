/**
 * Results Table Component
 * Displays qualified leads extracted from Google Maps with stats and filtering.
 */

let allLeads = [];

export function renderResultsTable(container) {
    allLeads = [];
    container.innerHTML = `
        <!-- Table Filter / Summary Bar -->
        <div class="table-toolbar">
            <div class="lead-metrics-row" id="leadMetricsRow">
                <div class="mini-metric-pill">
                    <span class="metric-label">Total Leads:</span>
                    <strong class="metric-val" id="metricTotal">0</strong>
                </div>
                <div class="mini-metric-pill">
                    <span class="metric-label">Emails:</span>
                    <strong class="metric-val" style="color: #10b981;" id="metricEmails">0</strong>
                </div>
                <div class="mini-metric-pill">
                    <span class="metric-label">Phones:</span>
                    <strong class="metric-val" style="color: #6366f1;" id="metricPhones">0</strong>
                </div>
                <div class="mini-metric-pill">
                    <span class="metric-label">No Website:</span>
                    <strong class="metric-val" style="color: #f59e0b;" id="metricNoWebsite">0</strong>
                </div>
            </div>

            <div class="table-search-box">
                <input type="text" id="tableFilterInput" placeholder="Filter extracted results..." autocomplete="off">
            </div>
        </div>

        <div class="table-scroll-area">
            <table id="leadsTable">
                <thead>
                    <tr>
                        <th style="width: 50px;">#</th>
                        <th>Business Name</th>
                        <th>Category</th>
                        <th>Phone</th>
                        <th>Address</th>
                        <th>Website</th>
                        <th>Email Contact</th>
                        <th>Socials</th>
                        <th>Map</th>
                    </tr>
                </thead>
                <tbody id="tableBody">
                    <tr id="emptyRow">
                        <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 3.5rem 1rem;">
                            <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.6;">🎯</div>
                            <div style="font-weight: 600; font-size: 1rem; color: var(--text-secondary); margin-bottom: 0.25rem;">No leads extracted yet</div>
                            <div style="font-size: 0.85rem;">Use the AI chat bar above to start scraping verified leads.</div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    // Filter input handler
    const filterInput = document.getElementById('tableFilterInput');
    if (filterInput) {
        filterInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            filterTableRows(query);
        });
    }
}

function updateMetrics() {
    const total = allLeads.length;
    const emails = allLeads.filter(l => l.email).length;
    const phones = allLeads.filter(l => l.phone && l.phone !== 'N/A').length;
    const noWebsite = allLeads.filter(l => !l.website).length;

    const elTotal = document.getElementById('metricTotal');
    const elEmails = document.getElementById('metricEmails');
    const elPhones = document.getElementById('metricPhones');
    const elNoWebsite = document.getElementById('metricNoWebsite');
    const countBadge = document.getElementById('leadCountBadge');

    if (elTotal) elTotal.innerText = total;
    if (elEmails) elEmails.innerText = emails;
    if (elPhones) elPhones.innerText = phones;
    if (elNoWebsite) elNoWebsite.innerText = noWebsite;
    if (countBadge) countBadge.innerText = total;
}

function filterTableRows(query) {
    const rows = document.querySelectorAll('#tableBody tr:not(#emptyRow)');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if (!query || text.includes(query)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

export function appendLead(lead, index) {
    const tableBody = document.getElementById('tableBody');
    const emptyRow = document.getElementById('emptyRow');
    if (emptyRow) emptyRow.remove();

    allLeads.push(lead);
    updateMetrics();

    const tr = document.createElement('tr');
    tr.className = 'animate-slide-in lead-row';

    const escapeHtml = (str) => {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    const emailHtml = (lead.email)
        ? `<a href="mailto:${escapeHtml(lead.email)}" class="lead-email-link">✉️ ${escapeHtml(lead.email)}</a>`
        : '<span class="text-muted">N/A</span>';

    const socialHtml = (lead.socialLinks && lead.socialLinks.length > 0)
        ? lead.socialLinks.map(link => `<a href="${escapeHtml(link)}" target="_blank" class="social-chip" title="${escapeHtml(link)}">Link</a>`).join(' ')
        : '<span class="text-muted">N/A</span>';

    const websiteHtml = (lead.website)
        ? `<a href="${escapeHtml(lead.website)}" target="_blank" class="lead-web-link">🌐 Visit</a>`
        : '<span class="badge primary" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);">No Website</span>';

    const mapsHtml = (lead.mapsLink)
        ? `<a href="${escapeHtml(lead.mapsLink)}" target="_blank" class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Map</a>`
        : '<span class="text-muted">N/A</span>';

    tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 0.8rem;">${index}</td>
        <td>
            <strong style="color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(lead.name)}</strong>
            ${lead.rating ? `<div style="color: #f59e0b; font-size: 0.75rem; margin-top: 0.15rem;">★ ${lead.rating} (${lead.reviews || 0} reviews)</div>` : ''}
        </td>
        <td><span class="badge">${escapeHtml(lead.category || 'General')}</span></td>
        <td><span style="font-family: monospace; font-size: 0.85rem;">${escapeHtml(lead.phone || 'N/A')}</span></td>
        <td><span style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(lead.address || 'N/A')}</span></td>
        <td>${websiteHtml}</td>
        <td>${emailHtml}</td>
        <td>${socialHtml}</td>
        <td>${mapsHtml}</td>
    `;

    tableBody.appendChild(tr);
}

export function clearTable() {
    allLeads = [];
    updateMetrics();

    const tableBody = document.getElementById('tableBody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr id="emptyRow">
                <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚡</div>
                    <div>Scraping in progress...</div>
                </td>
            </tr>
        `;
    }
}
