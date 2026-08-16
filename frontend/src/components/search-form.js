export function renderSearchForm(container) {
    container.innerHTML = `
        <div class="card-header">
            <h2>Search</h2>
        </div>
        <form id="searchForm" class="form-grid">
            <div class="input-group">
                <label for="searchQuery">Search Query</label>
                <div class="ai-input-wrapper">
                    <input type="text" id="searchQuery" placeholder="e.g. Find me cafes with no websites" required>
                </div>
            </div>
            
            <div class="input-group">
                <label for="locationInput">Location</label>
                <input type="text" id="locationInput" placeholder="e.g. Bangalore" required>
            </div>
            
            <div class="checkbox-group">
                <input type="checkbox" id="enableAiToggle" checked>
                <label for="enableAiToggle">Enable Local LLM Processing</label>
            </div>

            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button type="button" class="btn btn-secondary" id="openSettingsBtn">Parameters</button>
                <button type="submit" class="btn btn-primary" id="startSearchBtn">Start Scraping</button>
            </div>
        </form>

        <dialog id="settingsDialog">
            <h3 style="margin-bottom: 1rem;">Search Parameters</h3>
            <div class="form-grid">
                <div class="input-group">
                    <label for="radiusInput">Search Radius (e.g. 10km, 5mi)</label>
                    <input type="text" id="radiusInput" value="10km">
                </div>
                
                <div class="input-group">
                    <label for="maxLeadsInput">Max Leads (e.g. 50, or 'All')</label>
                    <input type="text" id="maxLeadsInput" value="All">
                </div>
            </div>
            <div class="dialog-actions">
                <button type="button" class="btn btn-primary" id="closeSettingsBtn">Done</button>
            </div>
        </dialog>
    `;
}
