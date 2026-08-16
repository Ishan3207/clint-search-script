export function renderResultsTable(container) {
    container.innerHTML = `
        <table id="leadsTable">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Business Name</th>
                    <th>Category</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Website</th>
                    <th>Email</th>
                    <th>Socials</th>
                    <th>Maps Link</th>
                </tr>
            </thead>
            <tbody id="tableBody">
                <tr id="emptyRow">
                    <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                        No leads found yet. Enter location and start a search above.
                    </td>
                </tr>
            </tbody>
        </table>
    `;
}

export function appendLead(lead, index) {
    const tableBody = document.getElementById('tableBody');
    const emptyRow = document.getElementById('emptyRow');
    if (emptyRow) emptyRow.remove();

    const tr = document.createElement('tr');
    tr.className = 'animate-slide-in';
    
    // Formatting helpers
    const escapeHtml = (str) => {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    const emailHtml = (lead.email) 
      ? `<a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a>` 
      : '<span class="text-muted">N/A</span>';

    const socialHtml = (lead.socialLinks && lead.socialLinks.length > 0)
      ? lead.socialLinks.map(link => `<a href="${escapeHtml(link)}" target="_blank" title="${escapeHtml(link)}">Link</a>`).join(', ')
      : '<span class="text-muted">N/A</span>';
      
    const websiteHtml = (lead.website)
      ? `<a href="${escapeHtml(lead.website)}" target="_blank">Website</a>`
      : '<span class="badge primary">No Website</span>';

    const mapsHtml = (lead.mapsLink)
      ? `<a href="${escapeHtml(lead.mapsLink)}" target="_blank">Map</a>`
      : 'N/A';

    tr.innerHTML = `
      <td>${index}</td>
      <td><strong>${escapeHtml(lead.name)}</strong>
          ${lead.rating ? `<br><small style="color:var(--status-warning)">★ ${lead.rating} (${lead.reviews})</small>` : ''}
      </td>
      <td><span class="badge">${escapeHtml(lead.category || 'General')}</span></td>
      <td>${escapeHtml(lead.phone || 'N/A')}</td>
      <td><small>${escapeHtml(lead.address || 'N/A')}</small></td>
      <td>${websiteHtml}</td>
      <td>${emailHtml}</td>
      <td>${socialHtml}</td>
      <td>${mapsHtml}</td>
    `;
    
    tableBody.appendChild(tr);
    
    const countBadge = document.getElementById('leadCountBadge');
    if (countBadge) {
        countBadge.innerText = document.querySelectorAll('#tableBody tr:not(#emptyRow)').length;
    }
}

export function clearTable() {
    const tableBody = document.getElementById('tableBody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr id="emptyRow">
                <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 3rem;">
                    Searching...
                </td>
            </tr>
        `;
    }
    const countBadge = document.getElementById('leadCountBadge');
    if (countBadge) countBadge.innerText = '0';
}
