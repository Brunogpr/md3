// Configurações da loja, editáveis no painel (/admin/configuracoes).
import { eq } from 'drizzle-orm';
import { getDb } from './db/client';
import { settings } from './db/schema';

export interface LegalLinks {
  legalNoticeUrl: string;
  privacyUrl: string;
  termsUrl: string;
  cookiesUrl: string;
}

export interface StoreSettings {
  /** Compras online ativas. Só pode ser ligado com os documentos legais obrigatórios preenchidos. */
  storeEnabled: boolean;
  /** Portes fixos por encomenda, em cêntimos (0 = grátis). */
  shippingCents: number;
  /** Portes grátis a partir deste subtotal (cêntimos). null = nunca. */
  freeShippingFromCents: number | null;
  /** Códigos ISO de países para onde se envia. */
  shippingCountries: string[];
  legal: LegalLinks;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeEnabled: false,
  shippingCents: 0,
  freeShippingFromCents: null,
  shippingCountries: ['ES'],
  legal: { legalNoticeUrl: '', privacyUrl: '', termsUrl: '', cookiesUrl: '' },
};

/** Documentos exigidos em Espanha para vender online (LSSI-CE, RGPD e condições de venda/desistência). */
export const REQUIRED_LEGAL: (keyof LegalLinks)[] = ['legalNoticeUrl', 'privacyUrl', 'termsUrl'];

export function missingLegal(s: StoreSettings): (keyof LegalLinks)[] {
  return REQUIRED_LEGAL.filter((k) => !s.legal[k]);
}

const KEY = 'store';

export async function getStoreSettings(): Promise<StoreSettings> {
  const row = await getDb().query.settings.findFirst({ where: eq(settings.key, KEY) });
  const stored = (row?.value ?? {}) as Partial<StoreSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    legal: { ...DEFAULT_SETTINGS.legal, ...(stored.legal ?? {}) },
  };
}

export async function saveStoreSettings(value: StoreSettings): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ key: KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** A loja só aceita pagamentos se estiver ativa, com Stripe configurado e documentos legais. */
export function canSell(s: StoreSettings, paymentsConfigured: boolean): boolean {
  return s.storeEnabled && paymentsConfigured && missingLegal(s).length === 0;
}
