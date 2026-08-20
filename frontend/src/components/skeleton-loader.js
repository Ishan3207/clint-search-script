/**
 * Skeleton Loader Component
 * Injects animated placeholders while asynchronous data or views are initializing.
 */

export function renderSkeleton(container, type = 'search-form') {
    if (!container) return;

    if (type === 'search-form') {
        container.innerHTML = `
            <div class="skeleton-container">
                <div class="skeleton-box skeleton-title"></div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <div class="skeleton-box skeleton-text" style="width: 30%;"></div>
                        <div class="skeleton-box skeleton-input"></div>
                    </div>
                    <div>
                        <div class="skeleton-box skeleton-text" style="width: 25%;"></div>
                        <div class="skeleton-box skeleton-input"></div>
                    </div>
                    <div>
                        <div class="skeleton-box skeleton-text" style="width: 20%;"></div>
                        <div class="skeleton-box skeleton-input"></div>
                    </div>
                </div>
                <div class="skeleton-box skeleton-text" style="width: 35%; margin-top: 1rem;"></div>
                <div class="skeleton-tabs">
                    <div class="skeleton-box skeleton-tab"></div>
                    <div class="skeleton-box skeleton-tab"></div>
                    <div class="skeleton-box skeleton-tab"></div>
                    <div class="skeleton-box skeleton-tab"></div>
                </div>
                <div class="skeleton-box skeleton-input" style="height: 48px;"></div>
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <div class="skeleton-box skeleton-btn" style="width: 150px; height: 44px;"></div>
                </div>
            </div>
        `;
    } else if (type === 'results-table') {
        container.innerHTML = `
            <div class="skeleton-container">
                <div class="skeleton-row" style="border-bottom: 2px solid rgba(255,255,255,0.1);">
                    <div class="skeleton-box skeleton-cell" style="flex: 0.5;"></div>
                    <div class="skeleton-box skeleton-cell" style="flex: 2;"></div>
                    <div class="skeleton-box skeleton-cell" style="flex: 1.5;"></div>
                    <div class="skeleton-box skeleton-cell" style="flex: 1;"></div>
                    <div class="skeleton-box skeleton-cell" style="flex: 1.5;"></div>
                    <div class="skeleton-box skeleton-cell" style="flex: 1;"></div>
                </div>
                ${Array.from({ length: 4 }).map(() => `
                    <div class="skeleton-row">
                        <div class="skeleton-box skeleton-cell" style="flex: 0.5;"></div>
                        <div class="skeleton-box skeleton-cell" style="flex: 2;"></div>
                        <div class="skeleton-box skeleton-cell" style="flex: 1.5;"></div>
                        <div class="skeleton-box skeleton-cell" style="flex: 1;"></div>
                        <div class="skeleton-box skeleton-cell" style="flex: 1.5;"></div>
                        <div class="skeleton-box skeleton-cell" style="flex: 1;"></div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (type === 'console') {
        container.innerHTML = `
            <div class="skeleton-container">
                <div class="skeleton-box skeleton-text" style="width: 60%; margin-bottom: 10px;"></div>
                <div class="skeleton-box skeleton-text" style="width: 80%; margin-bottom: 10px;"></div>
                <div class="skeleton-box skeleton-text" style="width: 45%; margin-bottom: 10px;"></div>
            </div>
        `;
    }
}
