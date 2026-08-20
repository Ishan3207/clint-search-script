/**
 * Mobile Navigation Menu Component
 * Handles the responsive hamburger toggle and slide-out navigation sheet.
 */

export function setupMobileMenu() {
    const hamburgerBtn = document.getElementById('mobileMenuBtn');
    const drawer = document.getElementById('mobileNavDrawer');
    const backdrop = document.getElementById('mobileNavBackdrop');
    const closeBtn = document.getElementById('closeMobileMenuBtn');

    if (!hamburgerBtn || !drawer || !backdrop) return;

    function openMenu() {
        drawer.classList.add('open');
        backdrop.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        drawer.classList.remove('open');
        backdrop.classList.remove('visible');
        document.body.style.overflow = '';
    }

    hamburgerBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    backdrop.addEventListener('click', closeMenu);

    // Close on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('open')) {
            closeMenu();
        }
    });

    // Close when clicking nav items inside drawer
    drawer.querySelectorAll('a, button').forEach(el => {
        if (el.id !== 'closeMobileMenuBtn') {
            el.addEventListener('click', () => {
                setTimeout(closeMenu, 150);
            });
        }
    });
}
