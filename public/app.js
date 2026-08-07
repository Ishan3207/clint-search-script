document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('searchForm');
  const providerToggle = document.getElementById('providerToggle');
  const apiKeyGroup = document.getElementById('apiKeyGroup');
  const apiKeyInput = document.getElementById('apiKey');
  const locationTextInput = document.getElementById('locationText');
  const nicheInput = document.getElementById('niche');
  const radiusInput = document.getElementById('radiusMeters');
  const latInput = document.getElementById('latitude');
  const lngInput = document.getElementById('longitude');
  const maxResultsInput = document.getElementById('maxResults');
  
  const submitBtn = document.getElementById('submitBtn');
  const exportBtn = document.getElementById('exportBtn');
  const geoBtn = document.getElementById('geoBtn');
  const clearLogBtn = document.getElementById('clearLogBtn');

  const envText = document.getElementById('envText');
  const consoleLog = document.getElementById('consoleLog');
  const tableBody = document.getElementById('tableBody');
  const leadCountSpan = document.getElementById('leadCount');
  const searchStatusBadge = document.getElementById('searchStatusBadge');

  let currentLeads = [];
  let eventSource = null;

  function getSelectedProvider() {
    return providerToggle.checked ? 'google' : 'osm';
  }

  // Handle Sliding Switch Toggle Event
  providerToggle.addEventListener('change', () => {
    const selected = getSelectedProvider();
    if (selected === 'google') {
      apiKeyGroup.classList.remove('hidden');
      envText.textContent = 'Google Places Mode';
    } else {
      apiKeyGroup.classList.add('hidden');
      envText.textContent = 'OpenStreetMap Mode (Free)';
    }
  });

  // Browser Geolocation Helper
  geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      logToConsole('Geolocation is not supported by your browser.', 'warn');
      return;
    }
    logToConsole('Fetching browser location...', 'info');
    geoBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        latInput.value = pos.coords.latitude.toFixed(6);
        lngInput.value = pos.coords.longitude.toFixed(6);
        locationTextInput.value = `GPS (${latInput.value}, ${lngInput.value})`;
        logToConsole(`📍 Location set from GPS: (${latInput.value}, ${lngInput.value})`, 'success');
        geoBtn.disabled = false;
      },
      (err) => {
        logToConsole(`Failed to get location: ${err.message}`, 'error');
        geoBtn.disabled = false;
      }
    );
  });

  // Clear Console
  clearLogBtn.addEventListener('click', () => {
    consoleLog.innerHTML = '<div class="log-line text-muted">Console cleared.</div>';
  });

  // Search Form Submit
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (eventSource) {
      eventSource.close();
    }

    const provider = getSelectedProvider();

    // Reset UI state
    currentLeads = [];
    leadCountSpan.textContent = '0';
    tableBody.innerHTML = '';
    exportBtn.disabled = true;
    
    setSearchingState(true);
    logToConsole(`Initiating search request via ${provider === 'osm' ? 'OpenStreetMap (100% Free)' : 'Google Places API'}...`, 'info');

    // Build Query String
    const params = new URLSearchParams({
      provider: provider,
      niche: nicheInput.value.trim(),
      locationText: locationTextInput.value.trim(),
      radiusMeters: radiusInput.value,
      maxResults: maxResultsInput.value
    });

    if (latInput.value.trim()) {
      params.append('latitude', latInput.value.trim());
    }

    if (lngInput.value.trim()) {
      params.append('longitude', lngInput.value.trim());
    }

    if (provider === 'google' && apiKeyInput.value.trim()) {
      params.append('apiKey', apiKeyInput.value.trim());
    }

    // Connect Server-Sent Events
    eventSource = new EventSource(`/api/search-stream?${params.toString()}`);

    eventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      logToConsole(data.message, data.type || 'info');
    });

    eventSource.addEventListener('lead', (e) => {
      const lead = JSON.parse(e.data);
      currentLeads.push(lead);
      leadCountSpan.textContent = currentLeads.length;
      appendLeadToTable(lead, currentLeads.length);
      exportBtn.disabled = false;
    });

    eventSource.addEventListener('complete', (e) => {
      eventSource.close();
      setSearchingState(false);
    });

    eventSource.addEventListener('error', (e) => {
      try {
        if (e.data) {
          const data = JSON.parse(e.data);
          logToConsole(`❌ Error: ${data.message}`, 'error');
        } else {
          logToConsole('❌ Connection ended or failed.', 'error');
        }
      } catch (err) {
        logToConsole('❌ Connection error occurred.', 'error');
      }
      eventSource.close();
      setSearchingState(false);
    });
  });

  // Export CSV (Includes Email and Social Media columns)
  exportBtn.addEventListener('click', () => {
    if (currentLeads.length === 0) return;

    const headers = [
      'Business Name',
      'Profession / Category',
      'Email',
      'Social Media Links',
      'Phone (Local)',
      'Phone (Intl)',
      'Address',
      'Rating',
      'Total Reviews',
      'Google Maps Link'
    ];
    
    const csvRows = [headers.join(',')];

    for (const lead of currentLeads) {
      const row = [
        escapeCsv(lead.businessName),
        escapeCsv(lead.profession || 'N/A'),
        escapeCsv(lead.email || 'N/A'),
        escapeCsv(lead.socialLinks || 'N/A'),
        escapeCsv(lead.phoneLocal),
        escapeCsv(lead.phoneIntl),
        escapeCsv(lead.address),
        lead.rating,
        lead.totalReviews,
        escapeCsv(lead.googleMapsLink)
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `leads_no_website_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Helper Functions
  function setSearchingState(isSearching) {
    submitBtn.disabled = isSearching;
    submitBtn.textContent = isSearching ? 'SEARCHING...' : 'START SEARCH';
    searchStatusBadge.textContent = isSearching ? 'SEARCHING' : 'IDLE';
    if (isSearching) {
      searchStatusBadge.classList.add('active');
    } else {
      searchStatusBadge.classList.remove('active');
    }
  }

  function logToConsole(message, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-line log-${type}`;
    const timestamp = new Date().toLocaleTimeString();
    line.textContent = `[${timestamp}] ${message}`;
    consoleLog.appendChild(line);
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  function appendLeadToTable(lead, index) {
    const emptyRow = document.getElementById('emptyRow');
    if (emptyRow) emptyRow.remove();

    const tr = document.createElement('tr');
    
    const emailHtml = (lead.email && lead.email !== 'N/A') 
      ? `<a href="mailto:${escapeHtml(lead.email)}" class="map-link">${escapeHtml(lead.email)}</a>` 
      : '<span class="text-muted">N/A</span>';

    const socialHtml = (lead.socialLinks && lead.socialLinks !== 'N/A')
      ? lead.socialLinks.split('; ').map(link => `<a href="${escapeHtml(link)}" target="_blank" class="map-link">Link</a>`).join(', ')
      : '<span class="text-muted">N/A</span>';

    tr.innerHTML = `
      <td>${index}</td>
      <td><strong>${escapeHtml(lead.businessName)}</strong></td>
      <td><span class="badge">${escapeHtml(lead.profession || 'General')}</span></td>
      <td>${emailHtml}</td>
      <td>${socialHtml}</td>
      <td>${escapeHtml(lead.phoneLocal)}</td>
      <td>${escapeHtml(lead.address)}</td>
      <td>${lead.rating}</td>
      <td>${lead.googleMapsLink !== 'N/A' ? `<a href="${escapeHtml(lead.googleMapsLink)}" target="_blank" class="map-link">Map</a>` : 'N/A'}</td>
    `;
    tableBody.appendChild(tr);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeCsv(str) {
    const stringValue = String(str || '');
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }
});
