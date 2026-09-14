import { lockScroll, unlockScroll } from '../utils/scroll-lock.js';

const FOCUSABLE_SELECTOR = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
const initializedNavigations = new WeakSet();

function visibleFocusable(container) {
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => !element.closest('[hidden]'));
}

function initMobileNavigation(navigation) {
  if (initializedNavigations.has(navigation)) return;

  const toggle = document.querySelector(`[data-mobile-navigation-toggle][aria-controls="${CSS.escape(navigation.id)}"]`);
  const panel = navigation.querySelector('[data-mobile-navigation-panel]');
  const closeButton = navigation.querySelector('[data-mobile-navigation-close]');
  const rootLevel = navigation.querySelector('[data-mobile-navigation-root]');
  const triggers = [...navigation.querySelectorAll('[data-mobile-navigation-trigger]')];
  const levels = [...navigation.querySelectorAll('[data-mobile-navigation-level]')];
  const entries = triggers.map((trigger) => ({ trigger, level: levels.find((level) => level.id === trigger.getAttribute('aria-controls')) }));
  if (!navigation.id || !toggle || !panel || !closeButton || !rootLevel || entries.length !== 4 || entries.some(({ level }) => !level)) return;

  let activeEntry = null;

  function showRoot({ restoreFocus = false } = {}) {
    const previousEntry = activeEntry;
    rootLevel.hidden = false;
    entries.forEach((entry) => {
      entry.level.hidden = true;
      entry.level.setAttribute('aria-hidden', 'true');
      entry.trigger.setAttribute('aria-expanded', 'false');
    });
    activeEntry = null;
    if (restoreFocus && previousEntry?.trigger.isConnected) previousEntry.trigger.focus();
  }

  function closeNavigation({ restoreFocus = true } = {}) {
    if (navigation.hidden) return;
    navigation.hidden = true;
    navigation.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    showRoot();
    unlockScroll(navigation);
    if (restoreFocus && toggle.isConnected) toggle.focus();
  }

  function openNavigation() {
    const event = new CustomEvent('cascade:overlay-open', { detail: { type: 'mobile-navigation' } });
    document.dispatchEvent(event);
    showRoot();
    navigation.hidden = false;
    navigation.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    lockScroll(navigation);
    closeButton.focus();
  }

  function openLevel(entry) {
    showRoot();
    rootLevel.hidden = true;
    entry.level.hidden = false;
    entry.level.setAttribute('aria-hidden', 'false');
    entry.trigger.setAttribute('aria-expanded', 'true');
    activeEntry = entry;
    (entry.level.querySelector('[data-mobile-navigation-back]') || entry.level).focus();
  }

  toggle.addEventListener('click', () => navigation.hidden ? openNavigation() : closeNavigation());
  closeButton.addEventListener('click', () => closeNavigation());
  navigation.addEventListener('click', (event) => {
    if (event.target === navigation && event.target.hasAttribute('data-mobile-navigation-backdrop')) closeNavigation();
  });
  entries.forEach((entry) => {
    entry.trigger.addEventListener('click', () => openLevel(entry));
    entry.level.querySelector('[data-mobile-navigation-back]')?.addEventListener('click', () => showRoot({ restoreFocus: true }));
  });
  navigation.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (activeEntry) showRoot({ restoreFocus: true });
      else closeNavigation();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = visibleFocusable(panel);
    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (!panel.contains(document.activeElement) || document.activeElement === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!panel.contains(document.activeElement) || document.activeElement === last)) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener('cascade:overlay-open', (event) => {
    if (event.detail?.type === 'modal' && !navigation.hidden) {
      if (navigation.contains(event.detail.trigger)) event.detail.returnFocusTarget = toggle;
      closeNavigation({ restoreFocus: false });
    }
  });
  initializedNavigations.add(navigation);
}

export function initMobileNavigations() {
  document.querySelectorAll('[data-mobile-navigation]').forEach(initMobileNavigation);
}
