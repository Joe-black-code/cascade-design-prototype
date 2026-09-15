const FOCUSABLE_LINK_SELECTOR = 'a[href]:not([tabindex="-1"])';
const initializedRoots = new WeakSet();

function initMegaMenu(root) {
  if (initializedRoots.has(root)) return;

  const navigation = root.querySelector('[data-mega-menu-navigation]');
  const triggers = [...root.querySelectorAll('[data-mega-menu-trigger]')];
  const panels = [...root.querySelectorAll('[data-mega-menu-panel]')];
  const entries = triggers.map((trigger) => ({
    trigger,
    panel: panels.find((panel) => panel.id === trigger.getAttribute('aria-controls')),
  }));

  if (!navigation || entries.length === 0 || entries.some(({ panel }) => !panel)) return;

  let activeEntry = null;
  const desktopViewport = window.matchMedia('(min-width: 80rem)');

  function closeMenu({ restoreFocus = false } = {}) {
    if (!activeEntry) return;

    const closingEntry = activeEntry;
    closingEntry.trigger.setAttribute('aria-expanded', 'false');
    closingEntry.panel.hidden = true;
    closingEntry.panel.setAttribute('aria-hidden', 'true');
    activeEntry = null;
    root.dataset.megaMenuState = 'closed';
    delete root.dataset.megaMenuOpen;
    if (restoreFocus && closingEntry.trigger.isConnected) closingEntry.trigger.focus();
  }

  function openMenu(entry) {
    if (activeEntry && activeEntry !== entry) closeMenu();
    entry.panel.hidden = false;
    entry.panel.setAttribute('aria-hidden', 'false');
    entry.trigger.setAttribute('aria-expanded', 'true');
    activeEntry = entry;
    root.dataset.megaMenuState = 'open';
    root.dataset.megaMenuOpen = entry.panel.id;
  }

  entries.forEach((entry, index) => {
    entry.trigger.addEventListener('click', () => {
      if (activeEntry === entry) closeMenu();
      else openMenu(entry);
    });
    entry.trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        openMenu(entry);
        entry.panel.querySelector(FOCUSABLE_LINK_SELECTOR)?.focus();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        triggers[(index + offset + triggers.length) % triggers.length].focus();
      }
    });
  });

  document.addEventListener('pointerdown', (event) => {
    if (activeEntry && !navigation.contains(event.target) && !activeEntry.panel.contains(event.target)) closeMenu();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeEntry) {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  });
  document.addEventListener('cascade:overlay-open', () => closeMenu());
  document.addEventListener('cascade:demo-notice-open', () => {
    closeMenu({ restoreFocus: Boolean(activeEntry?.panel.contains(document.activeElement)) });
  });
  desktopViewport.addEventListener('change', (event) => {
    if (!event.matches && activeEntry) {
      const focusWasInside = activeEntry.panel.contains(document.activeElement)
        || activeEntry.trigger === document.activeElement;
      closeMenu({ restoreFocus: false });
      if (focusWasInside) document.activeElement?.blur();
    }
  });
  initializedRoots.add(root);
}

export function initMegaMenus() {
  document.querySelectorAll('[data-mega-menu-root]').forEach(initMegaMenu);
}
