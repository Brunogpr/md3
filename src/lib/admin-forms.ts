// Validação dos formulários do painel (sem dependências da base de dados).
import { categories } from '../data/categories';
import { parsePriceInput } from './cart';

export interface ProductFormValues {
  slug: string;
  namePt: string;
  nameEs: string;
  nameEn: string;
  shortPt: string;
  shortEs: string;
  shortEn: string;
  descriptionPt: string;
  descriptionEs: string;
  descriptionEn: string;
  categories: string[];
  priceCents: number | null;
  stock: number | null;
  active: boolean;
  featured: boolean;
  sortOrder: number;
}

export type FormErrors = Partial<Record<string, string>>;

/** "Conjunto de Natal!" → "conjunto-de-natal" */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const text = (fd: FormData, key: string, max: number) => String(fd.get(key) ?? '').trim().slice(0, max);

export function parseProductForm(fd: FormData): { values: ProductFormValues; errors: FormErrors } {
  const errors: FormErrors = {};
  const namePt = text(fd, 'namePt', 120);
  const slugInput = text(fd, 'slug', 80);
  const slug = slugify(slugInput || namePt);
  const priceRaw = text(fd, 'price', 20);
  const stockRaw = text(fd, 'stock', 10);
  const sortRaw = text(fd, 'sortOrder', 6);
  const validIds = new Set(categories.map((c) => c.id as string));
  const chosen = fd.getAll('categories').map(String).filter((c) => validIds.has(c));

  if (namePt.length < 2) errors.namePt = 'Indique o nome do produto (português).';
  if (!slug) errors.slug = 'O endereço (slug) só pode ter letras, números e hífenes.';

  let priceCents: number | null = null;
  if (priceRaw) {
    priceCents = parsePriceInput(priceRaw);
    if (priceCents === null || priceCents <= 0) errors.price = 'Preço inválido. Use, por exemplo, 24,90.';
    else if (priceCents < 50) errors.price = 'O preço mínimo aceite pela Stripe é 0,50 €.';
  }

  let stock: number | null = null;
  if (stockRaw) {
    stock = Number(stockRaw);
    if (!Number.isInteger(stock) || stock < 0 || stock > 99999) {
      errors.stock = 'O stock tem de ser um número inteiro (0 ou mais), ou ficar vazio.';
      stock = null;
    }
  }

  const sortOrder = sortRaw ? Number(sortRaw) : 0;
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 9999) errors.sortOrder = 'Ordem inválida.';

  return {
    values: {
      slug,
      namePt,
      nameEs: text(fd, 'nameEs', 120),
      nameEn: text(fd, 'nameEn', 120),
      shortPt: text(fd, 'shortPt', 240),
      shortEs: text(fd, 'shortEs', 240),
      shortEn: text(fd, 'shortEn', 240),
      descriptionPt: text(fd, 'descriptionPt', 4000),
      descriptionEs: text(fd, 'descriptionEs', 4000),
      descriptionEn: text(fd, 'descriptionEn', 4000),
      categories: chosen,
      priceCents,
      stock,
      active: fd.get('active') === 'on',
      featured: fd.get('featured') === 'on',
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
    },
    errors,
  };
}

/** Valores para preencher o formulário (preço em formato "24,90"). */
export function priceToInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

export interface SettingsFormValues {
  storeEnabled: boolean;
  shippingCents: number;
  freeShippingFromCents: number | null;
  shippingCountries: string[];
  legal: { legalNoticeUrl: string; privacyUrl: string; termsUrl: string; cookiesUrl: string };
}

const isUrl = (v: string) => /^https:\/\/[^\s]+$/.test(v) || /^\/[\w\-/.#?=&%]*$/.test(v);

export function parseSettingsForm(fd: FormData): { values: SettingsFormValues; errors: FormErrors } {
  const errors: FormErrors = {};
  const shippingRaw = text(fd, 'shipping', 20);
  const freeRaw = text(fd, 'freeShippingFrom', 20);
  const shippingCents = shippingRaw ? parsePriceInput(shippingRaw) : 0;
  const freeShippingFromCents = freeRaw ? parsePriceInput(freeRaw) : null;
  if (shippingCents === null) errors.shipping = 'Valor de portes inválido.';
  if (freeRaw && freeShippingFromCents === null) errors.freeShippingFrom = 'Valor inválido.';

  const countries = text(fd, 'shippingCountries', 200)
    .toUpperCase()
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (countries.length === 0 || countries.some((c) => !/^[A-Z]{2}$/.test(c))) {
    errors.shippingCountries = 'Indique códigos de país com 2 letras, separados por vírgulas (ex.: ES, PT).';
  }

  const legal = {
    legalNoticeUrl: text(fd, 'legalNoticeUrl', 500),
    privacyUrl: text(fd, 'privacyUrl', 500),
    termsUrl: text(fd, 'termsUrl', 500),
    cookiesUrl: text(fd, 'cookiesUrl', 500),
  };
  for (const [key, value] of Object.entries(legal)) {
    if (value && !isUrl(value)) errors[key] = 'Use um endereço https://… ou um caminho que comece por /.';
  }

  return {
    values: {
      storeEnabled: fd.get('storeEnabled') === 'on',
      shippingCents: shippingCents ?? 0,
      freeShippingFromCents,
      shippingCountries: [...new Set(countries)],
      legal,
    },
    errors,
  };
}
