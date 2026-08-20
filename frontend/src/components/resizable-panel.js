/**
 * Resizable Panel & Splitter Component
 * Handles horizontal splitter resizing (Left Chat Pane vs Right Leads Table)
 * and vertical console drawer resizing.
 */

export function setupResizablePanels() {
    // 1. Horizontal Splitter between Left Chat Pane and Right Leads Results Table
    const splitter = document.getElementById('horizontalSplitter');
    const leftPane = document.getElementById('leftChatPane');
    const rightPane = document.getElementById('rightResultsPane');

    if (splitter && leftPane && rightPane) {
        let isDraggingHorizontal = false;
        let startX = 0;
        let startLeftWidth = 0;

        // Restore saved width preference
        const savedLeftWidth = localStorage.getItem('leadfinder_left_pane_width');
        if (savedLeftWidth && window.innerWidth >= 1024) {
            leftPane.style.flex = `0 0 ${savedLeftWidth}px`;
        }

        splitter.addEventListener('mousedown', (e) => {
            isDraggingHorizontal = true;
            startX = e.clientX;
            startLeftWidth = leftPane.getBoundingClientRect().width;
            document.body.classList.add('resizing-horizontal');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDraggingHorizontal) return;
            const deltaX = e.clientX - startX;
            const newWidth = Math.max(340, Math.min(window.innerWidth * 0.65, startLeftWidth + deltaX));
            leftPane.style.flex = `0 0 ${newWidth}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDraggingHorizontal) {
                isDraggingHorizontal = false;
                document.body.classList.remove('resizing-horizontal');
                const finalWidth = leftPane.getBoundingClientRect().width;
                localStorage.setItem('leadfinder_left_pane_width', finalWidth);
            }
        });
    }

    // 2. Resizable Handle for Live Console Bottom Drawer
    const consoleDrawer = document.getElementById('consoleDrawer');
    const consoleHandle = document.getElementById('consoleResizeHandle');

    if (consoleDrawer && consoleHandle) {
        let isDraggingConsole = false;
        let startY = 0;
        let startHeight = 0;

        // Restore saved height
        const savedConsoleHeight = localStorage.getItem('leadfinder_console_height') || '280';
        consoleDrawer.style.height = `${savedConsoleHeight}px`;

        consoleHandle.addEventListener('mousedown', (e) => {
            isDraggingConsole = true;
            startY = e.clientY;
            startHeight = consoleDrawer.getBoundingClientRect().height;
            document.body.classList.add('resizing-vertical');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDraggingConsole) return;
            const deltaY = startY - e.clientY; // Dragging UP increases height
            const newHeight = Math.max(120, Math.min(window.innerHeight * 0.75, startHeight + deltaY));
            consoleDrawer.style.height = `${newHeight}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDraggingConsole) {
                isDraggingConsole = false;
                document.body.classList.remove('resizing-vertical');
                const finalHeight = consoleDrawer.getBoundingClientRect().height;
                localStorage.setItem('leadfinder_console_height', finalHeight);
            }
        });
    }
}
