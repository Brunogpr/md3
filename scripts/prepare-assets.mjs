// Gera os derivados da identidade visual a partir dos ficheiros originais em /assets-originais.
// Apenas recorta, separa em camadas, redimensiona e remove o fundo branco — nunca redesenha a logo.
// Uso: npm run assets
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const ORIGINALS = 'assets-originais';
const LOGO = `${ORIGINALS}/moldea-es-logo-dragao-original.jpg`;
const DRAGON = `${ORIGINALS}/dragao.png`;
const PRODUCT = `${ORIGINALS}/conjunto-natal-original.jpeg`;
const BRAND = 'src/assets/brand';
const BANNER = `${BRAND}/banner`;
const WHITE = [255, 255, 255];

await mkdir(BANNER, { recursive: true });
await mkdir('public/seed', { recursive: true });

const logo = await sharp(LOGO).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = logo.info;

/**
 * "Color to alpha": cada píxel perde só a parte da cor que vem do fundo branco, por isso
 * desenho, cores e sombras suaves mantêm-se e a logo assenta em qualquer fundo.
 * `keep(x, y)` decide que zonas da tela pertencem à camada.
 */
function toAlpha(keep = () => true) {
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const o = (y * W + x) * 4;
      if (!keep(x, y)) continue;
      let alpha = 0;
      for (let c = 0; c < 3; c++) alpha = Math.max(alpha, (WHITE[c] - logo.data[i + c]) / WHITE[c]);
      if (alpha < 0.04) alpha = 0; // ruído JPEG junto ao branco
      for (let c = 0; c < 3; c++) {
        out[o + c] = alpha === 0 ? 0 : Math.round(Math.min(255, Math.max(0, (logo.data[i + c] - 255) / alpha + 255)));
      }
      out[o + 3] = Math.round(alpha * 255);
    }
  }
  return out;
}

const raw = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 4 } });
async function save(buf, file, crop) {
  let img = raw(buf);
  if (crop) img = sharp(await img.png().toBuffer()).extract(crop);
  await img.png({ compressionLevel: 9 }).toFile(file);
}

// ---- Zonas da logo (medidas no ficheiro original 1254x1254) ----
const NOZZLE_BOTTOM = 292; // fim do bico da impressora; o filamento pertence ao M
const M_BOTTOM = 884; // base do M / topo de "MOLDEA"
const WORDMARK_BOTTOM = 1158; // fim de "MOLDEA.es" e da barra
const M_RIGHT = 913; // à direita disto, na faixa do M, só existe o dragão

// ---- Logo completa (com o dragão original), para rodapé, "Sobre" e pré-carregamento ----
const full = toAlpha();
const fullCrop = { left: 40, top: 0, width: 1175, height: 1225 };
await save(full, `${BRAND}/logo-moldea.png`, fullCrop);

// ---- Cabeçalho: "MOLDEA.es" + barra (legível em tamanho pequeno) ----
const wordmarkCrop = { left: 60, top: M_BOTTOM - 4, width: 1150, height: WORDMARK_BOTTOM + 1 - (M_BOTTOM - 4) };
const wordmark = toAlpha((x, y) => y >= M_BOTTOM - 4 && y <= WORDMARK_BOTTOM);
await save(wordmark, `${BRAND}/logo-wordmark.png`, wordmarkCrop);

// ---- Camadas do banner (todas na tela inteira, para se sobreporem com precisão) ----
// Bico + calhas; a cabeça do dragão (à direita, abaixo das calhas) fica de fora.
await save(toAlpha((x, y) => y < NOZZLE_BOTTOM && (y < 150 ? x < 990 : x < 800)), `${BANNER}/bico.png`);
// À direita, o M é azul e o dragão é laranja/rosa/branco: aí só se mantêm os tons azuis.
// Acima do ombro do M (y < 400, x >= 760) há apenas o dragão (inclui a íris azul do olho).
const isBlue = (x, y) => {
  const i = (y * W + x) * 3;
  return logo.data[i + 2] - logo.data[i] > 25;
};
const mLayer = toAlpha((x, y) => {
  if (y < NOZZLE_BOTTOM || y >= M_BOTTOM || x > M_RIGHT) return false;
  if (x < 660) return true;
  if (x < 712 && y < 405) return true; // filamento (à esquerda dos dedos)
  if (x >= 760 && y < 400) return false;
  return isBlue(x, y);
});
await save(rebuildUnderHand(mLayer), `${BANNER}/letra-m.png`);
await save(wordmark, `${BANNER}/wordmark.png`);
const tagline = toAlpha((x, y) => y > WORDMARK_BOTTOM);
await save(tagline, `${BANNER}/slogan.png`);

/**
 * Na logo, o dragão tapa o topo da perna direita do M (um "telhado" com vértice em ~812,417):
 * os dedos tapam a aresta esquerda, o pescoço tapa a aresta direita e a outra mão a borda direita.
 * Sem o dragão por cima, essas zonas são reconstruídas copiando o perfil do bisel de uma coluna
 * limpa da mesma aresta (x=655), com a espessura corrigida pelo ângulo de cada troço.
 * Medidas tiradas do original: a aresta desce a ~-0,92 até (676,460) e depois a ~-0,32 até ao vértice.
 */
function rebuildUnderHand(rgba) {
  const out = Buffer.from(rgba);
  const PEAK = { x: 812, y: 417 };
  const KNEE = { x: 676, y: 460 }; // onde a aresta passa a subir mais suave
  const STEEP = -0.92;
  const ROOF_LEFT = (PEAK.y - KNEE.y) / (PEAK.x - KNEE.x);
  const ROOF_RIGHT = 0.78;
  const REF_X = 655;
  const idx = (x, y) => (Math.round(y) * W + x) * 4;
  const firstOpaque = (x, from, to) => {
    for (let y = from; y < to; y++) if (out[idx(x, y) + 3] > 200) return y;
    return to;
  };
  const REF_TOP = firstOpaque(REF_X, 450, 560); // topo real na coluna de referência
  // Espessura vertical de um bisel perpendicular varia com 1/cos(ângulo): ajusta-se a distância.
  const angleScale = (slope) => Math.cos(Math.atan(Math.abs(slope))) / Math.cos(Math.atan(Math.abs(STEEP)));
  const sample = (x, y, d, slope, force) => {
    const o = idx(x, y);
    if (!force && out[o + 3] >= 250) return;
    const s = idx(REF_X, REF_TOP + Math.round(d * angleScale(slope)));
    for (let c = 0; c < 4; c++) out[o + c] = out[s + c];
  };
  const clearAbove = (x, edge) => {
    for (let y = Math.floor(edge) - 14; y < edge - 2; y++) out[idx(x, y) + 3] = 0;
  };

  // 1) Aresta esquerda, debaixo dos dedos (reescreve tudo até ao fundo dos dedos + sombra).
  for (let x = 668; x <= PEAK.x; x++) {
    const steep = x < KNEE.x;
    const edge = steep ? KNEE.y + (x - KNEE.x) * STEEP : KNEE.y + (x - KNEE.x) * ROOF_LEFT;
    const bottom = 502 + ((x - KNEE.x) * (446 - 502)) / (PEAK.x - KNEE.x);
    clearAbove(x, edge);
    for (let d = -2; edge + d <= bottom; d++) sample(x, edge + d, d, steep ? STEEP : ROOF_LEFT, true);
  }

  // 2) Aresta direita, debaixo do pescoço: reescreve a faixa junto à aresta e completa o resto.
  for (let x = PEAK.x + 1; x <= M_RIGHT - 8; x++) {
    const edge = PEAK.y + (x - PEAK.x) * ROOF_RIGHT;
    clearAbove(x, edge);
    let solid = 0;
    for (let d = -2; d < 150 && solid < 8; d++) {
      solid = out[idx(x, edge + d) + 3] >= 250 && d > 6 ? solid + 1 : 0;
      sample(x, edge + d, d, ROOF_RIGHT, d < 28);
    }
  }

  // 3) Borda vertical direita: repõe o perfil de uma linha limpa onde a mão a tapava.
  const REF_Y = 560;
  const rowEnd = (y) => {
    for (let x = M_RIGHT; x > 600; x--) if (out[idx(x, y) + 3] > 200) return x;
    return 0;
  };
  const refEnd = rowEnd(REF_Y);
  for (let y = 540; y < 830; y++) {
    const end = rowEnd(y);
    const gap = refEnd - end;
    if (gap <= 0 || gap >= 45) continue;
    for (let x = end - 4; x <= refEnd + 2; x++) {
      const o = idx(x, y);
      const s = idx(x, REF_Y);
      for (let c = 0; c < 4; c++) out[o + c] = out[s + c];
    }
  }
  return out;
}

// ---- Dragão separado (enviado à parte) ----
if (existsSync(DRAGON)) {
  await sharp(DRAGON).ensureAlpha().trim().png({ compressionLevel: 9 }).toFile(`${BANNER}/dragao.png`);
  console.log('Dragão preparado.');
} else {
  console.warn(`Aviso: ${DRAGON} não encontrado — o banner usa a logo completa, sem animação do dragão.`);
}

// ---- Ícones: M + dragão, num quadrado branco ----
const mark = await sharp(LOGO).extract({ left: 262, top: 170, width: 950, height: 720 }).toBuffer();
const icon = await sharp({ create: { width: 1000, height: 1000, channels: 3, background: '#ffffff' } })
  .composite([{ input: mark, gravity: 'center' }])
  .png()
  .toBuffer();
await sharp(icon).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(icon).resize(180, 180).png().toFile('public/apple-touch-icon.png');
await sharp(icon).resize(48, 48).png().toFile('public/favicon.png');

// ---- Fotografia do primeiro produto (usada pela semente da base de dados) ----
await sharp(PRODUCT).resize({ width: 1200 }).webp({ quality: 84 }).toFile('public/seed/conjunto-natal.webp');

// ---- Imagem para partilha social (1200x630) ----
const ogLogo = await raw(full).png().toBuffer().then((b) => sharp(b).extract(fullCrop).resize({ height: 560 }).toBuffer());
const ogProduct = await sharp(PRODUCT)
  .extract({ left: 40, top: 520, width: 984, height: 880 })
  .resize({ width: 560, height: 500, fit: 'cover' })
  .composite([{ input: Buffer.from('<svg width="560" height="500"><rect width="560" height="500" rx="36"/></svg>'), blend: 'dest-in' }])
  .png()
  .toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#ffffff' } })
  .composite([
    { input: ogLogo, left: 40, top: 35 },
    { input: ogProduct, left: 610, top: 65 },
  ])
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile('public/og-image.jpg');

console.log('Assets gerados com sucesso.');
