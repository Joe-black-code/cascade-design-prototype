import { lockScroll, unlockScroll } from '../utils/scroll-lock.js';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const initializedModals = new WeakSet();

function getFocusableElements(dialog) {
  return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
    return !element.hidden && element.getAttribute('aria-hidden') !== 'true';
  });
}

function initModal(modal) {
  if (initializedModals.has(modal)) return;

  const id = modal.id;
  const dialog = modal.querySelector('[data-modal-dialog]');
  const closeButton = modal.querySelector('[data-modal-close]');
  const triggers = [...document.querySelectorAll(`[data-modal-open="${CSS.escape(id)}"]`)];

  if (!id || !dialog || !closeButton || triggers.length === 0) return;

  let openingTrigger = null;

  function openModal(event) {
    const coordinationEvent = new CustomEvent('cascade:overlay-open', {
      detail: { type: 'modal', trigger: event.currentTarget, returnFocusTarget: null },
    });
    document.dispatchEvent(coordinationEvent);
    openingTrigger = coordinationEvent.detail.returnFocusTarget || event.currentTarget;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    lockScroll(modal);

    const [firstFocusable] = getFocusableElements(dialog);
    (firstFocusable || dialog).focus();
  }

  function closeModal({ restoreFocus = true } = {}) {
    if (modal.hidden) return;

    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    unlockScroll(modal);

    if (restoreFocus && openingTrigger?.isConnected) openingTrigger.focus();
    openingTrigger = null;
  }

  function handleKeydown(event) {
    if (modal.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = getFocusableElements(dialog);
    if (focusableElements.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements.at(-1);
    const focusIsInside = dialog.contains(document.activeElement);

    if (event.shiftKey && (!focusIsInside || document.activeElement === firstFocusable)) {
      event.preventDefault();
      lastFocusable.focus();
    } else if (!event.shiftKey && (!focusIsInside || document.activeElement === lastFocusable)) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  triggers.forEach((trigger) => trigger.addEventListener('click', openModal));
  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal && event.target.hasAttribute('data-modal-backdrop')) closeModal();
  });
  modal.addEventListener('keydown', handleKeydown);
  document.addEventListener('cascade:overlay-open', (event) => {
    if (event.detail?.type === 'mobile-navigation') closeModal({ restoreFocus: false });
  });
  initializedModals.add(modal);
}

export function initModals() {
  document.querySelectorAll('[data-modal]').forEach(initModal);
}
