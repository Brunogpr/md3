// Regras do carrinho, partilhadas entre navegador e servidor. Sem dependências do DOM nem da BD.

export const MAX_QTY_PER_ITEM = 20;
export const MAX_CART_LINES = 30;

export interface CartLine {
  productId: number;
  quantity: number;
}

export interface PricedProduct {
  id: number;
  slug: string;
  name: string;
  priceCents: number | null;
  stock: number | null;
  active: boolean;
}

export type CartProblem =
  | { code: 'empty' }
  | { code: 'unavailable'; productId: number }
  | { code: 'no-price'; productId: number }
  | { code: 'insufficient-stock'; productId: number; available: number };

export interface PricedLine {
  productId: number;
  slug: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface CartTotals {
  lines: PricedLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

/** Normaliza o que vem do navegador: ids inteiros, quantidades 1..20, linhas repetidas somadas. */
export function sanitizeCart(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  const merged = new Map<number, number>();
  for (const raw of input.slice(0, MAX_CART_LINES)) {
    const id = Number((raw as CartLine)?.productId);
    const qty = Math.floor(Number((raw as CartLine)?.quantity));
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(qty) || qty <= 0) continue;
    merged.set(id, Math.min(MAX_QTY_PER_ITEM, (merged.get(id) ?? 0) + qty));
  }
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

export interface ShippingRules {
  shippingCents: number;
  freeShippingFromCents: number | null;
}

export function shippingFor(subtotalCents: number, rules: ShippingRules): number {
  if (rules.freeShippingFromCents !== null && subtotalCents >= rules.freeShippingFromCents) return 0;
  return Math.max(0, rules.shippingCents);
}

/** Valida o carrinho contra os produtos atuais e calcula os totais com os preços da base de dados. */
export function priceCart(
  lines: CartLine[],
  catalog: PricedProduct[],
  rules: ShippingRules,
): { ok: true; totals: CartTotals } | { ok: false; problems: CartProblem[] } {
  if (lines.length === 0) return { ok: false, problems: [{ code: 'empty' }] };
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const problems: CartProblem[] = [];
  const priced: PricedLine[] = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product || !product.active) {
      problems.push({ code: 'unavailable', productId: line.productId });
      continue;
    }
    if (product.priceCents === null) {
      problems.push({ code: 'no-price', productId: line.productId });
      continue;
    }
    if (product.stock !== null && product.stock < line.quantity) {
      problems.push({ code: 'insufficient-stock', productId: line.productId, available: Math.max(0, product.stock) });
      continue;
    }
    priced.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity: line.quantity,
      lineTotalCents: product.priceCents * line.quantity,
    });
  }
  if (problems.length > 0) return { ok: false, problems };
  const subtotalCents = priced.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const shippingCents = shippingFor(subtotalCents, rules);
  return { ok: true, totals: { lines: priced, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents } };
}

/** "12,50 €" / "1.234,00 €" conforme o idioma. */
export function formatPrice(cents: number, intlLocale: string, currency = 'EUR'): string {
  return new Intl.NumberFormat(intlLocale, { style: 'currency', currency }).format(cents / 100);
}

/** "12,50" ou "12.50" → 1250. null se inválido. Aceita até 2 casas decimais. */
export function parsePriceInput(value: string): number | null {
  const clean = value.trim().replace(/\s|€/g, '');
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
