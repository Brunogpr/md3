// Movimento global: revelação ao rolar (em cascata), títulos palavra a palavra,
// botões "magnéticos" e cartões com inclinação 3D. Tudo desligado com "reduzir movimento".
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

// ---- Títulos palavra a palavra (o texto continua legível e seleccionável) ----
for (const el of document.querySelectorAll<HTMLElement>('.split-words')) {
  if (el.dataset.split) continue;
  el.dataset.split = 'true';
  const words = (el.textContent ?? '').trim().split(/\s+/);
  el.replaceChildren(
    ...words.flatMap((word, i) => {
      const outer = document.createElement('span');
      outer.className = 'word';
      const inner = document.createElement('span');
      inner.className = 'word__inner';
      inner.style.setProperty('--i', String(i));
      inner.textContent = word;
      outer.append(inner);
      return i < words.length - 1 ? [outer, document.createTextNode(' ')] : [outer];
    }),
  );
}

// ---- Revelação ao entrar no ecrã, com atraso em cascata entre irmãos ----
const elements = document.querySelectorAll<HTMLElement>('.reveal, .split-words');
if (!('IntersectionObserver' in window) || reduceMotion) {
  elements.forEach((el) => el.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting);
      visible.forEach((entry, index) => {
        (entry.target as HTMLElement).style.setProperty('--stagger', `${index * 90}ms`);
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  elements.forEach((el) => observer.observe(el));
}

// ---- Botões magnéticos: seguem ligeiramente o cursor ----
if (finePointer && !reduceMotion) {
  for (const el of document.querySelectorAll<HTMLElement>('.magnetic')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.translate = '';
    });
  }

  // ---- Inclinação 3D nos cartões ----
  for (const el of document.querySelectorAll<HTMLElement>('.tilt')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-4px)`;
      el.style.setProperty('--glare-x', `${((px + 0.5) * 100).toFixed(0)}%`);
      el.style.setProperty('--glare-y', `${((py + 0.5) * 100).toFixed(0)}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  }
}

// Ano do copyright sempre atual, mesmo que a página esteja em cache.
document.querySelectorAll<HTMLElement>('[data-current-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

export {};
