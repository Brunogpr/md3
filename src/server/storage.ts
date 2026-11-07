// Armazenamento das fotografias dos produtos.
// Publicado na Netlify: Netlify Blobs (sem configuração extra). Local/testes: pasta data/uploads.
// Nos dois casos as fotos são servidas pelo próprio site em /uploads/<chave> (src/pages/uploads/[...path].ts).
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import sharp, { type Sharp } from 'sharp';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const LOCAL_UPLOAD_DIR = 'data/uploads';
const PREFIX = '/uploads/';
const BLOB_STORE = 'fotos-produtos';
const onNetlify = __DEPLOY_TARGET__ === 'netlify';

export interface StoredImage {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export class UploadError extends Error {}

async function blobStore() {
  const { getStore } = await import('@netlify/blobs');
  // "strong": a foto fica disponível logo a seguir ao envio (o painel mostra-a de imediato).
  return getStore({ name: BLOB_STORE, consistency: 'strong' });
}

async function put(key: string, body: Buffer): Promise<string> {
  if (onNetlify) {
    const store = await blobStore();
    await store.set(key, new Uint8Array(body).buffer, { metadata: { contentType: 'image/webp' } });
  } else {
    const path = join(LOCAL_UPLOAD_DIR, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }
  return PREFIX + key;
}

/**
 * Valida e otimiza uma fotografia enviada no painel: tem de ser uma imagem real (o sharp descodifica-a),
 * é rodada conforme o EXIF, os metadados (ex.: GPS) são removidos e gera-se WebP grande + miniatura.
 */
export async function storeProductImage(file: File): Promise<StoredImage> {
  if (file.size === 0) throw new UploadError('Ficheiro vazio.');
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError('A imagem não pode ter mais de 8 MB.');
  const input = Buffer.from(await file.arrayBuffer());
  let base: Sharp;
  try {
    base = sharp(input, { failOn: 'error', limitInputPixels: 50_000_000 }).rotate();
    const meta = await base.metadata();
    if (!meta.width || !meta.height) throw new Error();
  } catch {
    throw new UploadError('O ficheiro não é uma imagem válida (use JPG, PNG ou WebP).');
  }
  const large = await base.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const thumb = await base.clone().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  const id = randomUUID();
  return {
    url: await put(`produtos/${id}.webp`, large.data),
    thumbUrl: await put(`produtos/${id}-thumb.webp`, thumb),
    width: large.info.width,
    height: large.info.height,
  };
}

/** Chave segura a partir do caminho pedido (bloqueia "../" e só aceita .webp). */
function safeKey(key: string): string | null {
  const safe = normalize(key).replace(/\\/g, '/').replace(/^(\.\.(\/|$))+/, '');
  if (safe.includes('..') || !/^[\w\-/.]+\.webp$/.test(safe)) return null;
  return safe;
}

/** Apaga ficheiros que este módulo criou. URLs de outras origens (ex.: /seed/) são ignorados. */
export async function deleteStoredFiles(urls: string[]): Promise<void> {
  for (const url of urls) {
    if (!url.startsWith(PREFIX)) continue;
    const key = safeKey(url.slice(PREFIX.length));
    if (!key) continue;
    try {
      if (onNetlify) await (await blobStore()).delete(key);
      else await unlink(join(LOCAL_UPLOAD_DIR, key));
    } catch (error) {
      console.warn('[storage] não foi possível apagar', url, error);
    }
  }
}

/** Lê uma fotografia guardada (Netlify Blobs ou pasta local). */
export async function readUpload(key: string): Promise<ArrayBuffer | null> {
  const safe = safeKey(key);
  if (!safe) return null;
  try {
    if (onNetlify) {
      const data = await (await blobStore()).get(safe, { type: 'arrayBuffer' });
      return data ?? null;
    }
    const buf = await readFile(join(LOCAL_UPLOAD_DIR, safe));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}
