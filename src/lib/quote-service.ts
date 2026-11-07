// Pedidos de orçamento por WhatsApp. O site não envia nem guarda os dados: apenas monta uma
// mensagem e abre a conversa em wa.me, onde é o próprio visitante que revê e envia a mensagem.

export interface QuoteMessageData {
  name: string;
  email: string;
  phone: string;
  productName: string;
  requestTypeLabel: string;
  contactPreferenceLabel: string;
  description: string;
  /** URL do produto ou da página de origem, quando útil. */
  link: string;
}

export interface QuoteMessageLabels {
  greeting: string;
  name: string;
  email: string;
  phone: string;
  product: string;
  requestType: string;
  contactPreference: string;
  description: string;
  link: string;
  closing: string;
}

/** Monta a mensagem pré-preenchida, omitindo campos vazios. */
export function buildQuoteMessage(data: QuoteMessageData, labels: QuoteMessageLabels): string {
  const fields: [string, string][] = [
    [labels.name, data.name],
    [labels.email, data.email],
    [labels.phone, data.phone],
    [labels.product, data.productName],
    [labels.requestType, data.requestTypeLabel],
    [labels.contactPreference, data.contactPreferenceLabel],
    [labels.description, data.description],
    [labels.link, data.link],
  ];
  const lines = fields
    .map(([label, value]) => [label, value.trim()] as const)
    .filter(([, value]) => value !== '')
    .map(([label, value]) => `${label}: ${value}`);
  return [labels.greeting, '', ...lines, '', labels.closing].join('\n');
}

/** Link oficial wa.me; o texto é codificado com encodeURIComponent (acentos, espaços, quebras de linha). */
export function buildWhatsAppUrl(number: string, text?: string): string {
  if (!/^\d{8,15}$/.test(number)) {
    throw new Error(`Número de WhatsApp inválido (use apenas dígitos, com indicativo): ${number}`);
  }
  const base = `https://wa.me/${number}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * Abre a conversa numa nova aba. Devolve 'blocked' se o navegador impediu a abertura,
 * para a interface mostrar um link visível em alternativa.
 */
export function openWhatsApp(url: string, win: Pick<Window, 'open'> = window): 'opened' | 'blocked' {
  const opened = win.open(url, '_blank');
  if (!opened) return 'blocked';
  // Equivalente a rel="noopener": a página do WhatsApp não fica com acesso a esta janela.
  try {
    opened.opener = null;
  } catch {
    // Alguns navegadores não permitem alterar opener; não é crítico.
  }
  return 'opened';
}

/** Impressão digital simples para não abrir a mesma conversa duas vezes por engano. */
export function messageFingerprint(data: QuoteMessageData): string {
  return JSON.stringify([data.email.toLowerCase(), data.productName, data.requestTypeLabel, data.description]);
}
