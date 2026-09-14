const initializedSliders = new WeakSet();
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function formatNumber(number) {
  return String(number).padStart(2, '0');
}

function initProjectsSlider(slider) {
  if (initializedSliders.has(slider)) return;

  const viewport = slider.querySelector('[data-projects-slider-viewport]');
  const groups = [...slider.querySelectorAll('[data-projects-slider-group]')];
  const previous = slider.querySelector('[data-projects-slider-previous]');
  const next = slider.querySelector('[data-projects-slider-next]');
  const current = slider.querySelector('[data-projects-slider-current]');
  const total = slider.querySelector('[data-projects-slider-total]');
  if (!viewport?.id || groups.length === 0 || !previous || !next || !current || !total) return;

  let activeIndex = 0;

  function show(index) {
    activeIndex = Math.max(0, Math.min(index, groups.length - 1));
    groups.forEach((group, groupIndex) => {
      const isActive = groupIndex === activeIndex;
      group.hidden = !isActive;
      group.setAttribute('aria-hidden', String(!isActive));
    });
    previous.disabled = activeIndex === 0;
    next.disabled = activeIndex === groups.length - 1;
    slider.dataset.state = activeIndex === 0 ? 'start' : activeIndex === groups.length - 1 ? 'end' : 'middle';
    slider.dataset.activeIndex = String(activeIndex);
    current.textContent = formatNumber(activeIndex + 1);
    total.textContent = formatNumber(groups.length);
  }

  previous.addEventListener('click', () => show(activeIndex - 1));
  next.addEventListener('click', () => show(activeIndex + 1));
  slider.addEventListener('keydown', (event) => {
    if (!(event.target instanceof Element) || event.target.closest(EDITABLE_SELECTOR) || event.target.isContentEditable) return;
    const destinations = {
      ArrowLeft: activeIndex - 1,
      ArrowRight: activeIndex + 1,
      Home: 0,
      End: groups.length - 1,
    };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    show(destinations[event.key]);
  });

  show(0);
  initializedSliders.add(slider);
}

export function initProjectsSliders() {
  document.querySelectorAll('[data-projects-slider]').forEach(initProjectsSlider);
}
