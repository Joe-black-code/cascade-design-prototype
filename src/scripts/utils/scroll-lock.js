const owners = new Set();

function syncScrollLock() {
  document.body.classList.toggle('is-scroll-locked', owners.size > 0);
}

export function lockScroll(owner) {
  owners.add(owner);
  syncScrollLock();
}

export function unlockScroll(owner) {
  owners.delete(owner);
  syncScrollLock();
}
