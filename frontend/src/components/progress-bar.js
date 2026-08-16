export function renderProgressBar(container) {
    container.innerHTML = `
        <div class="card-header">
            <h2>Job Status</h2>
        </div>
        <div class="progress-wrapper">
            <div class="progress-fill" id="progressFill" style="width: 0%;"></div>
        </div>
        <div class="progress-text">
            <span id="progressPhase">Waiting to start...</span>
            <span id="progressPercent">0%</span>
        </div>
    `;
}

export function updateProgress(percent, phase) {
    const fill = document.getElementById('progressFill');
    const phaseText = document.getElementById('progressPhase');
    const percentText = document.getElementById('progressPercent');
    
    if (fill && phaseText && percentText) {
        if (percent === -1) {
            fill.classList.add('indeterminate');
            fill.style.width = '30%';
            percentText.innerText = '';
        } else {
            fill.classList.remove('indeterminate');
            fill.style.width = `${percent}%`;
            percentText.innerText = `${percent}%`;
            
            if (percent === 100) {
                fill.style.background = 'var(--status-success)';
            } else {
                fill.style.background = 'var(--gradient-accent)';
            }
        }
        
        phaseText.innerText = phase;
    }
}

export function resetProgress() {
    const fill = document.getElementById('progressFill');
    if (fill) {
        fill.style.width = '0%';
        fill.classList.remove('indeterminate');
        fill.style.background = 'var(--gradient-accent)';
    }
    const phaseText = document.getElementById('progressPhase');
    if (phaseText) phaseText.innerText = 'Waiting to start...';
    
    const percentText = document.getElementById('progressPercent');
    if (percentText) percentText.innerText = '0%';
}
