import pt, { type Dictionary } from './pt';
import es from './es';
import en from './en';
import { localeSettings, type Locale } from './config';

export * from './config';
export * from './routes';
export { interpolate } from './interpolate';
export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { pt, es, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(localeSettings[locale].intl).format(value);
}

/** Preparado para quando houver preços confirmados (não usado no catálogo atual). */
export function formatCurrency(locale: Locale, value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(localeSettings[locale].intl, { style: 'currency', currency }).format(value);
}

export function formatDate(locale: Locale, date: Date): string {
  return new Intl.DateTimeFormat(localeSettings[locale].intl, { dateStyle: 'long' }).format(date);
}
