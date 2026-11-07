// Separa as peças do dragão de assets-originais/dragao-pecas.png (fundo transparente) em PNGs
// individuais, isolando cada peça pela sua forma (componente ligado do canal alfa).
// Uso: node scripts/prepare-dragon.mjs  (também é chamado por npm run assets)
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const SRC = 'assets-originais/dragao-pecas.png';
const OUT = 'src/assets/brand/dragon';

if (!existsSync(SRC)) {
  console.warn(`Aviso: ${SRC} não encontrado — dragão articulado não gerado.`);
} else {
  await mkdir(OUT, { recursive: true });
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const label = new Int32Array(W * H).fill(-1);
  const comps = [];
  // Componentes com alfa > 8 (inclui as bordas suaves de cada peça).
  for (let start = 0; start < W * H; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] <= 8) continue;
    const id = comps.length;
    const stack = [start];
    label[start] = id;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
    while (stack.length) {
      const j = stack.pop();
      const x = j % W;
      const y = (j - x) / W;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const k of [j - 1, j + 1, j - W, j + W]) {
        if (k < 0 || k >= W * H || label[k] !== -1 || data[k * 4 + 3] <= 8) continue;
        if ((k === j - 1 && x === 0) || (k === j + 1 && x === W - 1)) continue;
        label[k] = id;
        stack.push(k);
      }
    }
    comps.push({ id, x0, y0, x1, y1, n });
  }
  const parts = comps.filter((c) => c.n > 5000);
  // Identifica as peças pela posição na folha.
  const byPos = (fn) => parts.find(fn);
  const named = {
    cabeca: byPos((c) => c.y0 < 100),
    corpo: byPos((c) => c.x0 > 500 && c.x0 < 700 && c.y0 > 300 && c.y0 < 400),
    cauda: byPos((c) => c.x0 > 1050),
    'mao-esq': byPos((c) => c.x0 < 100 && c.y0 > 500),
    'mao-dir': byPos((c) => c.x0 > 300 && c.x0 < 400 && c.y0 > 500),
    'pe-esq': byPos((c) => c.y0 > 800 && c.x0 < 700),
    'pe-dir': byPos((c) => c.y0 > 800 && c.x0 > 900),
  };
  const meta = {};
  for (const [name, c] of Object.entries(named)) {
    if (!c) throw new Error(`peça não encontrada: ${name}`);
    const w = c.x1 - c.x0 + 1;
    const h = c.y1 - c.y0 + 1;
    const out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const src = ((c.y0 + y) * W + (c.x0 + x));
        if (label[src] !== c.id) continue;
        data.copy(out, (y * w + x) * 4, src * 4, src * 4 + 4);
      }
    }
    await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(`${OUT}/${name}.png`);
    meta[name] = { x: c.x0, y: c.y0, w, h };
  }
  console.log('Peças do dragão:', JSON.stringify(meta));
}

// Corpo sem os pés desenhados: os pés soltos (pe-esq/pe-dir) encaixam por trás das coxas e
// podem levantar ao andar. Elipses medidas no corpo (514x476): [cx, cy, rx, ry].
// Apaga os pés desenhados no corpo POR INTEIRO (incluindo as bordas): a zona apagada fica atrás
// dos pés soltos e só mostra o fundo, por isso os passos nunca deixam ver restos do pé antigo.
const FEET_CUTS = [
  [95, 442, 116, 58],
  [405, 442, 126, 60],
];
/** Abaixo desta linha, fora da barriga (x entre 125 e 285), também se apaga tudo. */
const FEET_FLOOR = { y: 396, bellyFrom: 125, bellyTo: 285 };
if (existsSync(`${OUT}/corpo.png`)) {
  const body = await sharp(`${OUT}/corpo.png`).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = body.info;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const belowFloor = y >= FEET_FLOOR.y && (x < FEET_FLOOR.bellyFrom || x > FEET_FLOOR.bellyTo);
      if (belowFloor || FEET_CUTS.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1)) {
        body.data[(y * width + x) * 4 + 3] = 0;
      }
    }
  }
  await sharp(body.data, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(`${OUT}/corpo-sem-pes.png`);
  console.log('Corpo sem pés gerado.');
}

// Pés para ficarem À FRENTE do corpo: remove a abertura do encaixe (topo da peça) com uma
// transição suave, para o pé se fundir com a coxa sem se ver o "buraco".
const FOOT_FADE = { from: 22, to: 44 }; // px da peça original
for (const name of ['pe-esq', 'pe-dir']) {
  const file = `${OUT}/${name}.png`;
  if (!existsSync(file)) continue;
  const foot = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width, height } = foot.info;
  for (let y = 0; y < Math.min(height, FOOT_FADE.to); y++) {
    const k = y < FOOT_FADE.from ? 0 : (y - FOOT_FADE.from) / (FOOT_FADE.to - FOOT_FADE.from);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4 + 3;
      foot.data[i] = Math.round(foot.data[i] * k);
    }
  }
  await sharp(foot.data, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(`${OUT}/${name}-frente.png`);
}
console.log('Pés de frente gerados.');
