// Dados comuns às páginas públicas: produtos do idioma, configurações e se é possível comprar.
import type { Locale } from '../i18n/config';
import { listPublicProducts, type PublicProduct } from './products';
import { canSell, getStoreSettings, type StoreSettings } from './settings';
import { getPaymentGateway } from './payments';

/** Número de produtos mostrados na página inicial. */
export const HOME_PRODUCTS = 4;

export interface Storefront {
  /** Todos os produtos publicados (página de produtos). */
  products: PublicProduct[];
  /** Escolhidos no painel para a página inicial (máx. 4); sem escolha, os 4 primeiros. */
  homeProducts: PublicProduct[];
  featured: PublicProduct | undefined;
  settings: StoreSettings;
  /** Loja ativa + Stripe configurado + documentos legais: mostra carrinho e "Adicionar". */
  selling: boolean;
}

export async function loadStorefront(locale: Locale): Promise<Storefront> {
  const [products, settings] = await Promise.all([listPublicProducts(locale), getStoreSettings()]);
  const chosen = products.filter((p) => p.featured);
  const homeProducts = (chosen.length > 0 ? chosen : products).slice(0, HOME_PRODUCTS);
  return {
    products,
    homeProducts,
    featured: homeProducts[0],
    settings,
    selling: canSell(settings, getPaymentGateway() !== null),
  };
}
