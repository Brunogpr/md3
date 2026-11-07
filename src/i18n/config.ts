export const locales = ['pt', 'es', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt';

export type Localized<T = string> = Record<Locale, T>;

interface LocaleSettings {
  /** Valor do atributo lang do <html>. */
  htmlLang: string;
  /** Formato og:locale. */
  ogLocale: string;
  /** Locale usado pelas APIs Intl (números, datas, moeda). */
  intl: string;
  /** Prefixo de URL ('' para o idioma por omissão). */
  pathPrefix: string;
  /** Segmento localizado da página de produto. */
  productSegment: string;
  /** Rótulo curto do seletor de idioma. */
  label: string;
  /** Só idiomas publicados geram páginas, entram no sitemap/hreflang e no seletor de idioma. */
  published: boolean;
}

export const localeSettings: Record<Locale, LocaleSettings> = {
  pt: {
    htmlLang: 'pt',
    ogLocale: 'pt_PT',
    intl: 'pt-PT',
    pathPrefix: '',
    productSegment: 'produtos',
    label: 'PT',
    published: true,
  },
  es: {
    htmlLang: 'es-ES',
    ogLocale: 'es_ES',
    intl: 'es-ES',
    pathPrefix: '/es',
    productSegment: 'productos',
    label: 'ES',
    published: true,
  },
  en: {
    htmlLang: 'en',
    ogLocale: 'en_GB',
    intl: 'en-GB',
    pathPrefix: '/en',
    productSegment: 'products',
    label: 'EN',
    published: true,
  },
};

export const publishedLocales = locales.filter((l) => localeSettings[l].published);

export function isPublished(locale: Locale): boolean {
  return localeSettings[locale].published;
}
