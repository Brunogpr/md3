// Coreografia do dragão animado no banner: entra a andar, olha à volta, atravessa as letras, salta e volta.
// A velocidade de deslocação acompanha o ciclo das pernas (sem "deslizar").
const stage = document.querySelector<HTMLElement>('[data-banner]');
const walker = stage?.querySelector<HTMLElement>('[data-walker]');
const rig = walker?.querySelector<HTMLElement>('[data-dragon-rig]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Posições (left, em % do palco): direita do M, esquerda do M e o meio. */
const HOME = 68;
const LEFT = 30;
const MIDDLE = 50;
/**
 * Velocidade em larguras do dragão por segundo. Os passos são curtos (para os pés nunca destaparem
 * o encaixe), por isso anda devagar, como um bebé dinossauro, e os trajetos são curtos.
 */
const SPEED_WIDTHS_PER_SECOND = 0.13;

if (stage && walker && rig && !reduceMotion) {
  let x = 104; // começa fora do palco, à direita
  let busy = false;
  let visible = true;
  walker.style.left = `${x}%`;

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = () => {
        // Pausa a contagem enquanto o banner não está visível.
        if (visible && performance.now() - start >= ms) resolve();
        else window.setTimeout(tick, 100);
      };
      window.setTimeout(tick, Math.min(ms, 100));
    });

  const whenVisible = () =>
    new Promise<void>((resolve) => {
      const check = () => (visible ? resolve() : window.setTimeout(check, 250));
      check();
    });

  const face = (dir: 'left' | 'right') => (walker.dataset.facing = dir);

  async function walkTo(target: number) {
    await whenVisible();
    face(target < x ? 'left' : 'right');
    const walkerWidth = walker!.getBoundingClientRect().width;
    const distancePx = (Math.abs(target - x) / 100) * stage!.getBoundingClientRect().width;
    const duration = (distancePx / (walkerWidth * SPEED_WIDTHS_PER_SECOND)) * 1000;
    rig!.classList.add('is-walking');
    const anim = walker!.animate([{ left: `${x}%` }, { left: `${target}%` }], { duration, easing: 'linear', fill: 'forwards' });
    await anim.finished;
    walker!.style.left = `${target}%`;
    anim.cancel();
    x = target;
    rig!.classList.remove('is-walking');
  }

  async function act(state: 'is-looking' | 'is-jumping', ms: number) {
    await whenVisible();
    rig!.classList.remove(state);
    void rig!.getBoundingClientRect();
    rig!.classList.add(state);
    await wait(ms);
    rig!.classList.remove(state);
  }

  async function routine() {
    busy = true;
    await walkTo(HOME);
    face('left');
    await wait(1200);
    await act('is-looking', 2200);
    await wait(2500);
    await walkTo(LEFT);
    await wait(900);
    face('right');
    await act('is-jumping', 750);
    await wait(1400);
    await walkTo(MIDDLE);
    await act('is-looking', 2200);
    await walkTo(HOME);
    face('left');
    busy = false;
    await wait(5000);
    void routine();
  }

  // Clique: olha à volta (ou salta, alternando) quando está parado.
  let clicks = 0;
  walker.addEventListener('click', () => {
    if (rig.classList.contains('is-walking')) return;
    void act(clicks++ % 2 ? 'is-jumping' : 'is-looking', clicks % 2 ? 2200 : 800);
  });


  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && !document.hidden;
    walker.getAnimations().forEach((a) => (visible ? a.play() : a.pause()));
  }).observe(stage);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
  });

  // Entra depois de a logo estar "impressa" (~3 s após o banner ficar pronto).
  const start = () => {
    window.setTimeout(() => {
      walker.classList.add('is-on');
      if (!busy) void routine();
    }, 3000);
  };
  if (stage.classList.contains('is-ready')) start();
  else new MutationObserver((_, obs) => stage.classList.contains('is-ready') && (obs.disconnect(), start())).observe(stage, { attributes: true });
}

export {};
