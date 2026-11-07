// Configuração central da marca. Só são publicados os contactos fornecidos pela empresa;
// os restantes ficam a null até haver dados reais. Ver README › "Dados a fornecer".

import { buildWhatsAppUrl } from '../lib/quote-service';

export type SocialNetwork = 'instagram' | 'facebook' | 'tiktok' | 'pinterest' | 'youtube';

export interface SiteConfig {
  brandName: string;
  /**
   * Dragão do banner: 'animado' = dragão articulado (peças de assets-originais/dragao-pecas.png,
   * src/components/DragonRig.astro) que anda, acena e salta;
   * 'imagem' = o PNG original (assets-originais/dragao.png), com movimentos no lugar.
   */
  bannerDragon: 'animado' | 'imagem';
  /** Slogan oficial, tal como aparece na logo. */
  slogan: string;
  contact: {
    /** E-mail comercial, ex.: 'ola@dominio.es'. */
    email: string | null;
    /** Telefone em formato internacional, ex.: '+34 600 000 000'. */
    phone: string | null;
    /** Número de WhatsApp em formato internacional só com dígitos, ex.: '34600000000'. */
    whatsapp: string | null;
  };
  /** URLs completos dos perfis. Só os preenchidos aparecem no rodapé. */
  social: Record<SocialNetwork, string | null>;
}

export const siteConfig: SiteConfig = {
  brandName: 'MOLDEA.es',
  bannerDragon: 'imagem',
  slogan: 'Creamos ideas en 3D',
  contact: {
    email: null,
    phone: '+34 742 09 50 84',
    whatsapp: '34742095084',
  },
  social: {
    instagram: null,
    facebook: null,
    tiktok: null,
    pinterest: null,
    youtube: null,
  },
};

export const socialLabels: Record<SocialNetwork, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
};

export const sectionIds = {
  home: 'inicio',
  products: 'produtos',
  featured: 'destaque',
  customization: 'personalizacao',
  benefits: 'vantagens',
  about: 'sobre',
  quote: 'orcamento',
} as const;

/** Link wa.me para o número comercial, com mensagem opcional. null se não houver número. */
export function whatsappLink(text?: string): string | null {
  const number = siteConfig.contact.whatsapp;
  return number ? buildWhatsAppUrl(number, text) : null;
}

/** Telefone no formato de link tel: (sem espaços). */
export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
