// Acesso aos produtos: leitura pública (só ativos) e gestão no painel.
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { getDb } from './db/client';
import { productImages, products } from './db/schema';
import type { Locale } from '../i18n/config';
import { categories, type CategoryId } from '../data/categories';

export type ProductRow = typeof products.$inferSelect;
export type ProductImageRow = typeof productImages.$inferSelect;
export type ProductWithImages = ProductRow & { images: ProductImageRow[] };

export interface PublicImage {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  alt: string;
}

/** Produto já traduzido para um idioma, pronto para os componentes. */
export interface PublicProduct {
  id: number;
  slug: string;
  name: string;
  short: string;
  description: string;
  categories: CategoryId[];
  priceCents: number | null;
  stock: number | null;
  featured: boolean;
  images: PublicImage[];
}

const validCategory = (c: string): c is CategoryId => categories.some((cat) => cat.id === c);

/** Escolhe o texto do idioma, com o português como alternativa quando falta tradução. */
const pick = (locale: Locale, pt: string, es: string, en: string) => {
  const value = { pt, es, en }[locale];
  return value.trim() ? value : pt;
};

export function toPublic(p: ProductWithImages, locale: Locale): PublicProduct {
  const name = pick(locale, p.namePt, p.nameEs, p.nameEn);
  return {
    id: p.id,
    slug: p.slug,
    name,
    short: pick(locale, p.shortPt, p.shortEs, p.shortEn),
    description: pick(locale, p.descriptionPt, p.descriptionEs, p.descriptionEn),
    categories: p.categories.filter(validCategory),
    priceCents: p.priceCents,
    stock: p.stock,
    featured: p.featured,
    images: p.images.map((img) => ({
      url: img.url,
      thumbUrl: img.thumbUrl,
      width: img.width,
      height: img.height,
      alt: pick(locale, img.altPt, img.altEs, img.altEn) || name,
    })),
  };
}

export function isAvailable(p: Pick<PublicProduct, 'priceCents' | 'stock'>): boolean {
  return p.priceCents !== null && (p.stock === null || p.stock > 0);
}

const withImages = () => ({
  images: { orderBy: [asc(productImages.sortOrder), asc(productImages.id)] },
});

export async function listPublicProducts(locale: Locale): Promise<PublicProduct[]> {
  const rows = await getDb().query.products.findMany({
    where: eq(products.active, true),
    with: withImages(),
    orderBy: [asc(products.sortOrder), desc(products.featured), desc(products.createdAt)],
  });
  return rows.map((r) => toPublic(r, locale));
}

export async function getPublicProduct(slug: string, locale: Locale): Promise<PublicProduct | null> {
  const row = await getDb().query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.active, true)),
    with: withImages(),
  });
  return row ? toPublic(row, locale) : null;
}

export async function getProductsByIds(ids: number[]): Promise<ProductRow[]> {
  if (ids.length === 0) return [];
  return getDb().select().from(products).where(inArray(products.id, ids));
}

// ---------------- Painel ----------------

export async function listAllProducts(): Promise<ProductWithImages[]> {
  return getDb().query.products.findMany({
    with: withImages(),
    orderBy: [asc(products.sortOrder), desc(products.createdAt)],
  });
}

export async function getProduct(id: number): Promise<ProductWithImages | null> {
  return (await getDb().query.products.findFirst({ where: eq(products.id, id), with: withImages() })) ?? null;
}

export type ProductInput = Omit<typeof products.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;

/** Quantos produtos estão marcados para a página inicial (excluindo, opcionalmente, um). */
export async function countHomeProducts(exceptId?: number): Promise<number> {
  const where = exceptId ? and(eq(products.featured, true), ne(products.id, exceptId)) : eq(products.featured, true);
  const [row] = await getDb().select({ n: sql<number>`count(*)` }).from(products).where(where);
  return Number(row.n);
}

export async function slugExists(slug: string, exceptId?: number): Promise<boolean> {
  const where = exceptId ? and(eq(products.slug, slug), ne(products.id, exceptId)) : eq(products.slug, slug);
  return (await getDb().select({ id: products.id }).from(products).where(where).limit(1)).length > 0;
}

export async function createProduct(input: ProductInput): Promise<number> {
  const [row] = await getDb().insert(products).values(input).returning({ id: products.id });
  return row.id;
}

export async function updateProduct(id: number, input: ProductInput): Promise<void> {
  await getDb()
    .update(products)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(products.id, id));
}

/** Apaga o produto e as linhas das imagens. Devolve os URLs para remover do armazenamento. */
export async function deleteProduct(id: number): Promise<string[]> {
  const images = await getDb().select().from(productImages).where(eq(productImages.productId, id));
  await getDb().delete(productImages).where(eq(productImages.productId, id));
  await getDb().delete(products).where(eq(products.id, id));
  return images.flatMap((i) => [i.url, i.thumbUrl]);
}

export async function addProductImage(
  productId: number,
  image: Omit<typeof productImages.$inferInsert, 'id' | 'productId' | 'sortOrder'>,
): Promise<void> {
  const [{ next }] = await getDb()
    .select({ next: sql<number>`coalesce(max(${productImages.sortOrder}), -1) + 1` })
    .from(productImages)
    .where(eq(productImages.productId, productId));
  await getDb().insert(productImages).values({ ...image, productId, sortOrder: next });
}

export async function updateImageAlt(imageId: number, productId: number, altPt: string, altEs: string, altEn: string) {
  await getDb()
    .update(productImages)
    .set({ altPt, altEs, altEn })
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)));
}

/** Remove uma imagem do produto. Devolve os URLs a apagar do armazenamento. */
export async function deleteProductImage(imageId: number, productId: number): Promise<string[]> {
  const [img] = await getDb()
    .delete(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
    .returning();
  return img ? [img.url, img.thumbUrl] : [];
}

/** Move a imagem para primeiro lugar (imagem principal). */
export async function makeCoverImage(imageId: number, productId: number): Promise<void> {
  const images = await getDb()
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder), asc(productImages.id));
  const ordered = [...images.filter((i) => i.id === imageId), ...images.filter((i) => i.id !== imageId)];
  for (const [index, img] of ordered.entries()) {
    await getDb().update(productImages).set({ sortOrder: index }).where(eq(productImages.id, img.id));
  }
}
