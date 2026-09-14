const initializedNotices = new WeakSet();
const FALLBACK_FOCUS_SELECTOR = [
  '[data-mobile-navigation-toggle]:not([disabled])',
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isSafeFocusTarget(element) {
  return element instanceof HTMLElement
    && element.isConnected
    && !element.matches(':disabled')
    && !element.closest('[hidden], [aria-hidden="true"], [inert]')
    && element.getClientRects().length > 0;
}

function linkName(link) {
  return (link.getAttribute('aria-label') || link.textContent).replace(/[→←]+\s*$/, '').trim();
}

function initDemoNotice(notice) {
  if (initializedNotices.has(notice)) return;

  const message = notice.querySelector('[data-demo-notice-message]');
  const closeButton = notice.querySelector('[data-demo-notice-close]');
  if (!message || !closeButton) return;

  let returnFocusTarget = null;

  function fallbackFocusTarget() {
    return [...document.querySelectorAll(FALLBACK_FOCUS_SELECTOR)]
      .find((element) => !notice.contains(element) && isSafeFocusTarget(element));
  }

  function close() {
    const shouldRestoreFocus = notice.contains(document.activeElement);
    notice.hidden = true;
    message.textContent = '';
    if (shouldRestoreFocus) {
      const target = isSafeFocusTarget(returnFocusTarget) ? returnFocusTarget : fallbackFocusTarget();
      target?.focus();
    }
  }

  function open(link) {
    const name = linkName(link);
    document.dispatchEvent(new CustomEvent('cascade:demo-notice-open', { detail: { trigger: link } }));
    returnFocusTarget = isSafeFocusTarget(document.activeElement) ? document.activeElement : link;
    notice.hidden = false;
    message.textContent = '';
    window.setTimeout(() => {
      message.textContent = name
        ? `Раздел „${name}“ пока не входит в демонстрационный макет.`
        : 'Этот раздел пока не входит в демонстрационный макет.';
    }, 0);
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest('a[href="#not-implemented"]');
    if (!link) return;
    event.preventDefault();
    open(link);
  });
  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !notice.hidden) close();
  });
  initializedNotices.add(notice);
}

export function initDemoNotices() {
  document.querySelectorAll('[data-demo-notice]').forEach(initDemoNotice);
}
