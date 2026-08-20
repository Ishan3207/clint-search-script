/**
 * Toast Notification Component
 * Displays non-intrusive feedback messages at the top right of the viewport.
 */

let toastContainer = null;

function ensureToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

/**
 * Show a toast alert
 * @param {string} message - Text to show
 * @param {'info'|'success'|'warn'|'error'} type - Message status type
 * @param {number} duration - Auto dismiss timeout in ms
 */
export function showToast(message, type = 'info', duration = 4500) {
    const container = ensureToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    const iconMap = {
        success: '✓',
        error: '✕',
        warn: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `
        <span class="toast-icon">${iconMap[type] || 'ℹ'}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Close">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const removeToast = () => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    };

    closeBtn.addEventListener('click', removeToast);

    container.appendChild(toast);

    if (duration > 0) {
        setTimeout(removeToast, duration);
    }
}
