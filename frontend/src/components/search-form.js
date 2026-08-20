/**
 * Central Conversational AI Chat & Lead Search Form Component
 * Gemini & Apollo.io inspired horizontal left-pane conversational filter and search tool.
 */

export function renderSearchForm(container) {
    container.innerHTML = `
        <div class="chat-search-card">
            <div class="chat-card-header">
                <div class="chat-card-title">
                    <span style="font-size: 1.25rem;">✨</span>
                    <div>
                        <h2 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">Conversational Lead Search</h2>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">AI-powered prompt search & contact extraction</span>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <!-- Active AI Model Tag linking to API Setup -->
                    <a href="/settings.html" class="active-model-chip" id="chatActiveModelChip" title="Configure in API Setup">
                        <span class="chip-dot"></span>
                        <span id="chatModelChipText">AI: Loading...</span>
                        <span class="chip-settings-icon">⚙️</span>
                    </a>
                </div>
            </div>

            <!-- Central Conversational Prompt Box -->
            <form id="searchForm" class="chat-input-container">
                <div class="chat-textarea-wrapper">
                    <textarea 
                        id="searchQuery" 
                        class="chat-prompt-input" 
                        placeholder="Describe the leads you want to extract... (e.g. 'Find 25 high-rated marketing agencies in Indiranagar Bangalore with no website within 5km')" 
                        rows="3" 
                        required
                    ></textarea>
                </div>

                <!-- Chat Bar Footer Controls -->
                <div class="chat-controls-bar">
                    <div class="chat-left-controls">
                        <!-- Expand / Retract Area & Parameters Button -->
                        <button type="button" class="btn-expand-area" id="toggleParamsBtn" title="Expand / Retract Area & Location Filter">
                            <span class="expand-icon">📍</span>
                            <span>Area & Parameters</span>
                            <span class="expand-arrow" id="expandArrowIcon">▼</span>
                        </button>
                    </div>

                    <div class="chat-right-controls">
                        <!-- Stop Scraping Button (STRICTLY HIDDEN by default, shown ONLY during active search) -->
                        <button type="button" class="btn btn-danger-pill hidden" id="stopSearchBtn" title="Cancel and kill scraping task immediately">
                            <span class="btn-stop-icon">■</span> Stop
                        </button>

                        <!-- Start Scraping Action Button -->
                        <button type="submit" class="btn-send-chat" id="startSearchBtn" title="Start Scraping Leads (Ctrl+Enter)">
                            <span>Find Leads</span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Expandable / Retractable Area & Place Window (Smooth Animation) -->
                <div class="expandable-params-panel hidden" id="expandableParamsPanel">
                    <div class="params-header-row">
                        <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">📍 Location & Search Scope</span>
                        <button type="button" id="closeParamsBtn" class="btn-close-mini" title="Retract Area Panel">&times;</button>
                    </div>
                    <div class="params-grid">
                        <div class="input-group">
                            <label for="locationInput">Specific City / Region</label>
                            <input type="text" id="locationInput" placeholder="e.g. Indiranagar, Bangalore" autocomplete="off">
                        </div>
                        <div class="input-group">
                            <label for="radiusInput">Search Radius</label>
                            <input type="text" id="radiusInput" value="10km" placeholder="e.g. 5km, 10 miles">
                        </div>
                        <div class="input-group">
                            <label for="maxLeadsInput">Max Leads Limit</label>
                            <input type="text" id="maxLeadsInput" value="All" placeholder="e.g. 25, 50, or All">
                        </div>
                    </div>
                </div>
            </form>

            <!-- Quick Suggestion Prompt Chips (Apollo / Gemini style) -->
            <div class="quick-prompts-section">
                <span class="prompts-label">Quick Suggestions:</span>
                <div class="quick-prompts-wrap" id="quickPromptsRow">
                    <button type="button" class="prompt-chip" data-prompt="Find 20 cafes with no websites in Indiranagar Bangalore">☕ Cafes without website</button>
                    <button type="button" class="prompt-chip" data-prompt="Plumbers in Austin Texas with 4+ star reviews">🔧 Plumbers in Austin</button>
                    <button type="button" class="prompt-chip" data-prompt="Marketing agencies in New York within 10km">📈 Marketing agencies in NY</button>
                    <button type="button" class="prompt-chip" data-prompt="Dentists in London with direct email contacts">🦷 Dentists in London</button>
                </div>
            </div>
        </div>
    `;

    // Interactive prompt chips
    const textarea = document.getElementById('searchQuery');
    container.querySelectorAll('.prompt-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            if (textarea) {
                textarea.value = chip.getAttribute('data-prompt');
                textarea.focus();
            }
        });
    });

    // Expand / Retract Area & Parameters button
    const toggleBtn = document.getElementById('toggleParamsBtn');
    const closeParamsBtn = document.getElementById('closeParamsBtn');
    const paramsPanel = document.getElementById('expandableParamsPanel');
    const arrowIcon = document.getElementById('expandArrowIcon');

    function setParamsOpen(open) {
        if (open) {
            paramsPanel.classList.remove('hidden');
            toggleBtn.classList.add('active');
            if (arrowIcon) arrowIcon.innerText = '▲';
        } else {
            paramsPanel.classList.add('hidden');
            toggleBtn.classList.remove('active');
            if (arrowIcon) arrowIcon.innerText = '▼';
        }
    }

    if (toggleBtn && paramsPanel) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = paramsPanel.classList.contains('hidden');
            setParamsOpen(isHidden);
        });
    }

    if (closeParamsBtn) {
        closeParamsBtn.addEventListener('click', () => setParamsOpen(false));
    }

    // Ctrl+Enter or Cmd+Enter to submit
    if (textarea) {
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('searchForm').dispatchEvent(new Event('submit'));
            }
        });
    }
}
