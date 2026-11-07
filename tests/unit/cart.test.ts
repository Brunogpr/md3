import { describe, expect, it } from 'vitest';
import { formatPrice, parsePriceInput, priceCart, sanitizeCart, shippingFor, type PricedProduct } from '../../src/lib/cart';

const catalog: PricedProduct[] = [
  { id: 1, slug: 'a', name: 'A', priceCents: 1000, stock: null, active: true },
  { id: 2, slug: 'b', name: 'B', priceCents: 2550, stock: 2, active: true },
  { id: 3, slug: 'c', name: 'C', priceCents: null, stock: null, active: true },
  { id: 4, slug: 'd', name: 'D', priceCents: 500, stock: null, active: false },
];
const rules = { shippingCents: 495, freeShippingFromCents: 5000 };

describe('sanitizeCart', () => {
  it('aceita só ids e quantidades válidas, soma repetidos e limita a 20', () => {
    expect(
      sanitizeCart([
        { productId: 1, quantity: 2 },
        { productId: 1, quantity: 3 },
        { productId: '2', quantity: 1.7 },
        { productId: -1, quantity: 1 },
        { productId: 5, quantity: 0 },
        { productId: 6, quantity: 999 },
        'lixo',
        null,
      ]),
    ).toEqual([
      { productId: 1, quantity: 5 },
      { productId: 2, quantity: 1 },
      { productId: 6, quantity: 20 },
    ]);
    expect(sanitizeCart('nao-e-lista')).toEqual([]);
  });
});

describe('priceCart', () => {
  it('usa os preços da base de dados e soma portes', () => {
    const r = priceCart([{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }], catalog, rules);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totals.subtotalCents).toBe(4550);
    expect(r.totals.shippingCents).toBe(495);
    expect(r.totals.totalCents).toBe(5045);
    expect(r.totals.lines[0]).toMatchObject({ unitPriceCents: 1000, lineTotalCents: 2000 });
  });

  it('portes grátis a partir do limite', () => {
    expect(shippingFor(5000, rules)).toBe(0);
    expect(shippingFor(4999, rules)).toBe(495);
    expect(shippingFor(100, { shippingCents: 300, freeShippingFromCents: null })).toBe(300);
  });

  it('recusa carrinho vazio, produtos inativos/inexistentes, sem preço ou sem stock', () => {
    expect(priceCart([], catalog, rules)).toEqual({ ok: false, problems: [{ code: 'empty' }] });
    const r = priceCart(
      [
        { productId: 2, quantity: 3 },
        { productId: 3, quantity: 1 },
        { productId: 4, quantity: 1 },
        { productId: 99, quantity: 1 },
      ],
      catalog,
      rules,
    );
    expect(r).toEqual({
      ok: false,
      problems: [
        { code: 'insufficient-stock', productId: 2, available: 2 },
        { code: 'no-price', productId: 3 },
        { code: 'unavailable', productId: 4 },
        { code: 'unavailable', productId: 99 },
      ],
    });
  });
});

describe('preços', () => {
  it('interpreta valores escritos no painel', () => {
    expect(parsePriceInput('24,90')).toBe(2490);
    expect(parsePriceInput('24.9')).toBe(2490);
    expect(parsePriceInput('1.234,50 €')).toBe(123450);
    expect(parsePriceInput('10')).toBe(1000);
    expect(parsePriceInput('abc')).toBeNull();
    expect(parsePriceInput('1,234')).toBeNull();
    expect(parsePriceInput('')).toBeNull();
  });

  it('formata em euros conforme o idioma', () => {
    expect(formatPrice(2490, 'pt-PT')).toMatch(/24,90\s€/);
    expect(formatPrice(2490, 'es-ES')).toMatch(/24,90\s€/);
  });
});
