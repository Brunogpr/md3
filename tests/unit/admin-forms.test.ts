import { describe, expect, it } from 'vitest';
import { parseProductForm, parseSettingsForm, priceToInput, slugify } from '../../src/lib/admin-forms';

const form = (entries: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const item of [v].flat()) fd.append(k, item);
  return fd;
};

describe('slugify', () => {
  it('gera endereços limpos a partir do nome', () => {
    expect(slugify('Conjunto decorativo de Natal!')).toBe('conjunto-decorativo-de-natal');
    expect(slugify('  Árvore  Ç  ')).toBe('arvore-c');
    expect(slugify('***')).toBe('');
  });
});

describe('parseProductForm', () => {
  it('aceita um produto válido e converte preço/stock', () => {
    const { values, errors } = parseProductForm(
      form({ namePt: 'Vaso Espiral', price: '24,90', stock: '3', categories: ['decoracao', 'inventada'], active: 'on' }),
    );
    expect(errors).toEqual({});
    expect(values).toMatchObject({
      slug: 'vaso-espiral',
      priceCents: 2490,
      stock: 3,
      categories: ['decoracao'],
      active: true,
      featured: false,
    });
  });

  it('preço vazio = sob consulta; stock vazio = não controlado', () => {
    const { values } = parseProductForm(form({ namePt: 'Peça' }));
    expect(values.priceCents).toBeNull();
    expect(values.stock).toBeNull();
  });

  it('indica erros claros', () => {
    const { errors } = parseProductForm(form({ namePt: 'x', price: 'abc', stock: '-2' }));
    expect(errors.namePt).toBeTruthy();
    expect(errors.price).toBeTruthy();
    expect(errors.stock).toBeTruthy();
    expect(parseProductForm(form({ namePt: 'Peça', price: '0,10' })).errors.price).toMatch(/0,50/);
  });

  it('formata o preço para o campo de edição', () => {
    expect(priceToInput(2490)).toBe('24,90');
    expect(priceToInput(null)).toBe('');
  });
});

describe('parseSettingsForm', () => {
  it('valida portes, países e endereços dos documentos', () => {
    const { values, errors } = parseSettingsForm(
      form({
        storeEnabled: 'on',
        shipping: '4,95',
        freeShippingFrom: '50',
        shippingCountries: 'es, pt;ES',
        legalNoticeUrl: 'https://moldea.es/aviso-legal',
        privacyUrl: '/privacidade',
        termsUrl: 'javascript:alert(1)',
      }),
    );
    expect(values).toMatchObject({
      storeEnabled: true,
      shippingCents: 495,
      freeShippingFromCents: 5000,
      shippingCountries: ['ES', 'PT'],
    });
    expect(errors.termsUrl).toBeTruthy();
    expect(errors.legalNoticeUrl).toBeUndefined();
    expect(parseSettingsForm(form({ shippingCountries: 'Espanha' })).errors.shippingCountries).toBeTruthy();
  });
});
