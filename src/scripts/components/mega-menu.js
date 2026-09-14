const FOCUSABLE_LINK_SELECTOR = 'a[href]:not([tabindex="-1"])';
const HOVER_OPEN_DELAY = 150;
const HOVER_CLOSE_DELAY = 200;
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
  let openTimer = null;
  let closeTimer = null;
  const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  function clearTimers() {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    openTimer = null;
    closeTimer = null;
  }

  function closeMenu({ restoreFocus = false } = {}) {
    clearTimers();
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
    clearTimers();
    if (activeEntry && activeEntry !== entry) closeMenu();
    entry.panel.hidden = false;
    entry.panel.setAttribute('aria-hidden', 'false');
    entry.trigger.setAttribute('aria-expanded', 'true');
    activeEntry = entry;
    root.dataset.megaMenuState = 'open';
    root.dataset.megaMenuOpen = entry.panel.id;
  }

  function scheduleOpen(entry) {
    if (!supportsHover.matches) return;
    clearTimers();
    openTimer = window.setTimeout(() => openMenu(entry), HOVER_OPEN_DELAY);
  }

  function scheduleClose() {
    if (!supportsHover.matches) return;
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => closeMenu(), HOVER_CLOSE_DELAY);
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
    entry.trigger.addEventListener('pointerenter', () => scheduleOpen(entry));
    entry.trigger.addEventListener('pointerleave', scheduleClose);
    entry.panel.addEventListener('pointerenter', clearTimers);
    entry.panel.addEventListener('pointerleave', scheduleClose);
  });

  document.addEventListener('pointerdown', (event) => {
    if (activeEntry && !navigation.contains(event.target) && !activeEntry.panel.contains(event.target)) closeMenu();
  });
  root.addEventListener('focusout', (event) => {
    if (activeEntry && !root.contains(event.relatedTarget)) closeMenu();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeEntry) {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  });
  document.addEventListener('cascade:overlay-open', () => closeMenu());
  initializedRoots.add(root);
}

export function initMegaMenus() {
  document.querySelectorAll('[data-mega-menu-root]').forEach(initMegaMenu);
}
