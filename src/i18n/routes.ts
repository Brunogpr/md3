import { localeSettings, type Locale } from './config';

/** URL da página inicial do idioma, com âncora opcional (ex.: 'produtos'). */
export function homePath(locale: Locale, anchor?: string): string {
  const base = localeSettings[locale].pathPrefix || '/';
  const path = base.endsWith('/') ? base : `${base}/`;
  return anchor ? `${path}#${anchor}` : path;
}

export function productPath(locale: Locale, slug: string): string {
  const { pathPrefix, productSegment } = localeSettings[locale];
  return `${pathPrefix}/${productSegment}/${slug}/`;
}

/** Link para o formulário de orçamento com o produto (e tipo de pedido) pré-preenchidos. */
export function quotePath(locale: Locale, productSlug?: string, requestType?: string): string {
  const params = new URLSearchParams();
  if (productSlug) params.set('produto', productSlug);
  if (requestType) params.set('tipo', requestType);
  const query = params.toString();
  const base = localeSettings[locale].pathPrefix || '';
  return `${base}/${query ? `?${query}` : ''}#orcamento`;
}

/** Página com todos os produtos do idioma (ex.: /produtos/, /es/productos/, /en/products/). */
export function productsPath(locale: Locale): string {
  const { pathPrefix, productSegment } = localeSettings[locale];
  return `${pathPrefix}/${productSegment}/`;
}
