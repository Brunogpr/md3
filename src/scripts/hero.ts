// Banner: arranque da animação da logo, paralaxe com o rato e partículas de filamento no fundo.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

const hero = document.querySelector<HTMLElement>('[data-hero]');
const stage = document.querySelector<HTMLElement>('[data-banner]');

// ---- Arranque: só depois de todas as camadas estarem prontas (evita animar imagens a meio) ----
if (stage) {
  const images = [...stage.querySelectorAll('img')];
  Promise.all(images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined)))).then(
    () => stage.classList.add('is-ready'),
  );
  // Rede lenta: não fica invisível mais de 2,5 s.
  window.setTimeout(() => stage.classList.add('is-ready'), 2500);
}

// ---- Clique no dragão: saltinho de alegria ----
const dragonBox = stage?.querySelector<HTMLElement>('[data-dragon]');
if (dragonBox && !reduceMotion) {
  dragonBox.addEventListener('click', () => {
    dragonBox.classList.remove('is-happy');
    void dragonBox.offsetWidth; // reinicia a animação se clicar várias vezes
    dragonBox.classList.add('is-happy');
  });
  dragonBox.addEventListener('animationend', (event) => {
    if (event.animationName.includes('dragon-happy')) dragonBox.classList.remove('is-happy');
  });
}

// ---- Paralaxe: as camadas deslocam-se ligeiramente com o cursor ----
if (hero && stage && finePointer && !reduceMotion) {
  hero.addEventListener('pointermove', (event) => {
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    stage.style.setProperty('--mx', x.toFixed(3));
    stage.style.setProperty('--my', y.toFixed(3));
  });
  hero.addEventListener('pointerleave', () => {
    stage.style.setProperty('--mx', '0');
    stage.style.setProperty('--my', '0');
  });
}

// ---- Partículas de filamento (canvas) ----
const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
if (canvas && hero && !reduceMotion) {
  const ctx = canvas.getContext('2d');
  const COLORS = ['#ffa30d', '#f57c00', '#01b1fd', '#22b8ff', '#ffd21f'];
  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    len: number;
    angle: number;
    spin: number;
    color: string;
    alpha: number;
    burst: boolean;
  }
  let particles: Particle[] = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = false;
  let frame = 0;
  const pointer = { x: -9999, y: -9999 };

  const make = (burstX?: number, burstY?: number): Particle => {
    const burst = burstX !== undefined;
    const speed = burst ? 2 + Math.random() * 3 : 0.15 + Math.random() * 0.35;
    const dir = burst ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    return {
      x: burst ? burstX! : Math.random() * width,
      y: burst ? burstY! : Math.random() * height,
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed,
      len: 6 + Math.random() * 16,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.02,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: burst ? 0.9 : 0.25 + Math.random() * 0.35,
      burst,
    };
  };

  const resize = () => {
    const rect = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const target = Math.round(Math.min(70, (width * height) / 22000));
    particles = Array.from({ length: target }, () => make());
  };

  const draw = () => {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    for (const p of particles) {
      // Afasta-se do cursor.
      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < 140 * 140) {
        const force = (1 - Math.sqrt(dist2) / 140) * 0.6;
        p.vx += (dx / Math.sqrt(dist2 || 1)) * force;
        p.vy += (dy / Math.sqrt(dist2 || 1)) * force;
      }
      p.vx *= 0.96;
      p.vy = p.vy * 0.96 - 0.012; // sobe devagar
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      if (p.burst) p.alpha *= 0.975;
      else if (p.y < -30 || p.x < -30 || p.x > width + 30) Object.assign(p, make(), { y: height + 20 });

      ctx.globalAlpha = p.alpha;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x - (Math.cos(p.angle) * p.len) / 2, p.y - (Math.sin(p.angle) * p.len) / 2);
      ctx.lineTo(p.x + (Math.cos(p.angle) * p.len) / 2, p.y + (Math.sin(p.angle) * p.len) / 2);
      ctx.stroke();
    }
    // Partículas de "rajada" desvanecem e saem da lista.
    particles = particles.filter((p) => !p.burst || p.alpha > 0.04);
    if (running) frame = requestAnimationFrame(draw);
  };

  const start = () => {
    if (running) return;
    running = true;
    frame = requestAnimationFrame(draw);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });
  hero.addEventListener('pointermove', (e) => {
    const rect = hero.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
  });
  hero.addEventListener('pointerleave', () => {
    pointer.x = pointer.y = -9999;
  });
  // Clique no fundo: pequena rajada de filamento.
  hero.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    const rect = hero.getBoundingClientRect();
    for (let i = 0; i < 14; i++) particles.push(make(e.clientX - rect.left, e.clientY - rect.top));
  });
  // Só anima enquanto o banner está visível e o separador ativo.
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
}

export {};
