let isAutoScrollEnabled = true;

export function openConsoleDrawer() {
    const drawer = document.getElementById('consoleDrawer');
    const toggleBtn = document.getElementById('consoleToggleBtn');
    if (drawer) {
        drawer.classList.add('open');
        drawer.classList.remove('collapsed');
    }
    if (toggleBtn) {
        toggleBtn.classList.add('active');
    }
}

export function closeConsoleDrawer() {
    const drawer = document.getElementById('consoleDrawer');
    const toggleBtn = document.getElementById('consoleToggleBtn');
    if (drawer) {
        drawer.classList.remove('open');
        drawer.classList.add('collapsed');
    }
    if (toggleBtn) {
        toggleBtn.classList.remove('active');
    }
}

export function toggleConsoleDrawer() {
    const drawer = document.getElementById('consoleDrawer');
    if (drawer) {
        if (drawer.classList.contains('open')) {
            closeConsoleDrawer();
        } else {
            openConsoleDrawer();
        }
    }
}

export function logMessage(message, type = 'info') {
    const container = document.getElementById('consoleLogContainer');
    if (!container) return;

    if (!container.hasAttribute('data-scroll-bound')) {
        container.setAttribute('data-scroll-bound', 'true');
        container.addEventListener('scroll', () => {
            const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 15;
            isAutoScrollEnabled = isAtBottom;
        });
    }

    const line = document.createElement('div');
    line.className = `log-line log-${type}`;

    const timestamp = new Date().toLocaleTimeString([], { hour12: false });

    let icon = '';
    if (type === 'success') icon = '✓ ';
    else if (type === 'error') icon = '✕ ';
    else if (type === 'warn') icon = '⚠ ';
    else icon = '→ ';

    line.innerHTML = `<span class="log-time">[${timestamp}]</span> <span class="log-icon">${icon}</span> ${escapeHtml(message)}`;

    container.appendChild(line);

    if (isAutoScrollEnabled) {
        container.scrollTop = container.scrollHeight;
    }
}

export function clearConsole() {
    const container = document.getElementById('consoleLogContainer');
    if (container) {
        container.innerHTML = '<div class="log-line text-muted">Console cleared.</div>';
        isAutoScrollEnabled = true;
    }
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
