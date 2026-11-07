import { describe, expect, it } from 'vitest';
import pt from '../../src/i18n/pt';
import es from '../../src/i18n/es';
import en from '../../src/i18n/en';
import {
  formatCurrency,
  homePath,
  interpolate,
  localeSettings,
  locales,
  productPath,
  productsPath,
  publishedLocales,
  quotePath,
} from '../../src/i18n';

/** Lista todos os caminhos de chave, incluindo o tamanho das listas. */
function shape(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return [`${path}[${value.length}]`, ...value.flatMap((v, i) => shape(v, `${path}[${i}]`))];
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  return [path];
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('dicionários', () => {
  it('espanhol e inglês têm exatamente a mesma estrutura do português', () => {
    expect(shape(es)).toEqual(shape(pt));
    expect(shape(en)).toEqual(shape(pt));
  });

  it('não há textos vazios', () => {
    expect(strings(pt).filter((s) => !s.trim())).toEqual([]);
    expect(strings(es).filter((s) => !s.trim())).toEqual([]);
    expect(strings(en).filter((s) => !s.trim())).toEqual([]);
  });

  it('os marcadores {x} coincidem entre idiomas', () => {
    const markers = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const ptStrings = strings(pt);
    for (const other of [strings(es), strings(en)]) {
      ptStrings.forEach((s, i) => expect(markers(other[i])).toBe(markers(s)));
    }
  });
});

describe('configuração de idiomas', () => {
  it('português, espanhol e inglês estão publicados', () => {
    expect(publishedLocales).toEqual(['pt', 'es', 'en']);
  });

  it('cada idioma tem lang HTML e prefixo próprio', () => {
    for (const l of locales) expect(localeSettings[l].htmlLang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    expect(new Set(locales.map((l) => localeSettings[l].pathPrefix)).size).toBe(locales.length);
  });
});

describe('rotas localizadas', () => {
  it('gera URLs por idioma', () => {
    expect(homePath('pt')).toBe('/');
    expect(homePath('pt', 'produtos')).toBe('/#produtos');
    expect(homePath('es')).toBe('/es/');
    expect(productPath('pt', 'abc')).toBe('/produtos/abc/');
    expect(productPath('es', 'abc')).toBe('/es/productos/abc/');
    expect(productPath('en', 'abc')).toBe('/en/products/abc/');
    expect(productsPath('pt')).toBe('/produtos/');
    expect(productsPath('es')).toBe('/es/productos/');
    expect(productsPath('en')).toBe('/en/products/');
    expect(homePath('en')).toBe('/en/');
  });

  it('gera links de orçamento com pré-preenchimento', () => {
    expect(quotePath('pt')).toBe('/#orcamento');
    expect(quotePath('pt', 'abc', 'catalogo')).toBe('/?produto=abc&tipo=catalogo#orcamento');
    expect(quotePath('es', 'abc')).toBe('/es/?produto=abc#orcamento');
  });
});

describe('formatação', () => {
  it('interpola marcadores', () => {
    expect(interpolate('© {year} M3D', { year: 2026 })).toBe('© 2026 M3D');
    expect(interpolate('{x} fica', {})).toBe('{x} fica');
  });

  it('formata moeda segundo o idioma', () => {
    expect(formatCurrency('es', 12.5)).toMatch(/12,50\s€/);
    expect(formatCurrency('pt', 1234.5)).toMatch(/1\s?234,50\s€/);
  });
});
