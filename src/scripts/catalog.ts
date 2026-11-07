import { interpolate } from '../i18n/interpolate';

const catalog = document.querySelector<HTMLElement>('[data-catalog]');
const filters = catalog?.querySelector<HTMLElement>('[data-catalog-filters]');

if (catalog && filters) {
  const buttons = [...filters.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const items = [...catalog.querySelectorAll<HTMLElement>('[data-catalog-item]')];
  const empty = catalog.querySelector<HTMLElement>('[data-catalog-empty]');
  const count = catalog.querySelector<HTMLElement>('[data-catalog-count]');

  // Filtros só aparecem quando o JavaScript está disponível para os fazer funcionar.
  filters.hidden = false;

  const apply = (filter: string) => {
    let visible = 0;
    for (const item of items) {
      const match = filter === 'all' || (item.dataset.categories ?? '').split(' ').includes(filter);
      item.hidden = !match;
      if (match) visible++;
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    }
    if (empty) empty.hidden = visible > 0;
    if (count) {
      count.textContent =
        visible === 1
          ? (count.dataset.labelOne ?? '')
          : interpolate(count.dataset.labelMany ?? '', { count: visible });
    }
  };

  filters.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-filter]');
    if (button?.dataset.filter) apply(button.dataset.filter);
  });
}
