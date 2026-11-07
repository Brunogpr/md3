const header = document.querySelector<HTMLElement>('[data-header]');
const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const nav = document.querySelector<HTMLElement>('[data-nav]');
const label = document.querySelector<HTMLElement>('[data-menu-label]');
const mobileQuery = window.matchMedia('(max-width: 1023px)');

function setOpen(open: boolean, { restoreFocus = true } = {}) {
  if (!toggle || !nav) return;
  toggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
  document.body.classList.toggle('menu-open', open);
  if (label) label.textContent = (open ? toggle.dataset.labelClose : toggle.dataset.labelOpen) ?? '';
  if (open) {
    nav.querySelector<HTMLElement>('a')?.focus();
  } else if (restoreFocus) {
    toggle.focus();
  }
}

const isOpen = () => toggle?.getAttribute('aria-expanded') === 'true';

toggle?.addEventListener('click', () => setOpen(!isOpen()));

nav?.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('[data-nav-link]') && isOpen()) {
    setOpen(false, { restoreFocus: false });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isOpen()) setOpen(false);

  // Mantém o foco dentro do menu aberto (botão + links).
  if (event.key === 'Tab' && isOpen() && nav && toggle) {
    const focusable = [toggle, ...nav.querySelectorAll<HTMLElement>('a[href]')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

mobileQuery.addEventListener('change', (event) => {
  if (!event.matches && isOpen()) setOpen(false, { restoreFocus: false });
});

// Cabeçalho compacto e barra de progresso de leitura.
const progress = document.querySelector<HTMLElement>('[data-scroll-progress]');
let ticking = false;
const onScroll = () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    header?.classList.toggle('is-scrolled', window.scrollY > 8);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress?.style.setProperty('--progress', String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
    ticking = false;
  });
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });
