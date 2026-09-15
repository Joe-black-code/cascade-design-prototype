const ALLOWED_CONCEPTS = new Set(['a', 'b']);
const PAGE_PATH_PATTERN = /(?:^|\/)(?:index|catalog)\.html$/;

function selectedConcept() {
  const value = new URLSearchParams(window.location.search).get('concept');
  return ALLOWED_CONCEPTS.has(value) ? value : 'a';
}

function isPageLink(anchor) {
  const rawHref = anchor.getAttribute('href');
  if (!rawHref || rawHref.startsWith('#')) return false;

  let url;
  try {
    url = new URL(rawHref, window.location.href);
  } catch {
    return false;
  }

  return url.origin === window.location.origin && PAGE_PATH_PATTERN.test(url.pathname);
}

export function initConcept() {
  const concept = selectedConcept();
  document.documentElement.dataset.concept = concept;

  document.querySelectorAll('a[href]').forEach((anchor) => {
    if (!isPageLink(anchor)) return;
    const url = new URL(anchor.getAttribute('href'), window.location.href);
    url.searchParams.set('concept', concept);
    anchor.setAttribute('href', `${url.pathname.split('/').pop()}${url.search}${url.hash}`);
  });
}
