export function logMessage(message, type = 'info') {
    const container = document.getElementById('consoleLogContainer');
    if (!container) return;

    const line = document.createElement('div');
    line.className = `log-line log-${type}`;
    
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    
    line.innerHTML = `<span class="log-time">[${timestamp}]</span> ${escapeHtml(message)}`;
    
    container.appendChild(line);
    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

export function clearConsole() {
    const container = document.getElementById('consoleLogContainer');
    if (container) {
        container.innerHTML = '<div class="log-line text-muted">Console cleared.</div>';
    }
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
