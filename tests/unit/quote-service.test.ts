import { describe, expect, it, vi } from 'vitest';
import {
  buildQuoteMessage,
  buildWhatsAppUrl,
  messageFingerprint,
  openWhatsApp,
  type QuoteMessageData,
} from '../../src/lib/quote-service';
import { siteConfig, telLink, whatsappLink } from '../../src/config/site';
import pt from '../../src/i18n/pt';
import es from '../../src/i18n/es';

const data: QuoteMessageData = {
  name: 'Ana López',
  email: 'ana@example.es',
  phone: '',
  productName: 'Conjunto decorativo de Natal',
  requestTypeLabel: 'Informações sobre cores, dimensões ou personalização',
  contactPreferenceLabel: 'E-mail',
  description: 'Quero saber as cores disponíveis.\nÉ para o dia 20 & ação «urgente»?',
  link: 'https://m3d.trustec.com.br/produtos/conjunto-decorativo-natal/',
};

/** Extrai o texto de um link wa.me, tal como o WhatsApp o irá ler. */
const textOf = (url: string) => new URL(url).searchParams.get('text');

describe('configuração do contacto', () => {
  it('usa o número comercial oficial', () => {
    expect(siteConfig.contact.whatsapp).toBe('34742095084');
    expect(siteConfig.contact.phone).toBe('+34 742 09 50 84');
    expect(telLink(siteConfig.contact.phone!)).toBe('tel:+34742095084');
  });

  it('whatsappLink aponta para wa.me/34742095084', () => {
    expect(whatsappLink()).toBe('https://wa.me/34742095084');
    expect(whatsappLink('Olá')).toBe('https://wa.me/34742095084?text=Ol%C3%A1');
  });
});

describe('buildQuoteMessage', () => {
  it('organiza a mensagem com saudação, campos e fecho', () => {
    const message = buildQuoteMessage(data, pt.quote.message);
    expect(message).toBe(
      [
        'Olá! Gostaria de solicitar um orçamento à Moldea.',
        '',
        'Nome: Ana López',
        'E-mail: ana@example.es',
        'Produto: Conjunto decorativo de Natal',
        'Tipo de pedido: Informações sobre cores, dimensões ou personalização',
        'Preferência de contacto: E-mail',
        'Descrição: Quero saber as cores disponíveis.\nÉ para o dia 20 & ação «urgente»?',
        'Página: https://m3d.trustec.com.br/produtos/conjunto-decorativo-natal/',
        '',
        'Poderiam ajudar-me com esta solicitação?',
      ].join('\n'),
    );
  });

  it('omite campos opcionais vazios', () => {
    const message = buildQuoteMessage({ ...data, phone: '  ', link: '' }, pt.quote.message);
    expect(message).not.toContain('Telefone:');
    expect(message).not.toContain('Página:');
    expect(buildQuoteMessage({ ...data, phone: '+34 600 123 456' }, pt.quote.message)).toContain(
      'Telefone: +34 600 123 456',
    );
  });

  it('existe também em espanhol', () => {
    expect(buildQuoteMessage(data, es.quote.message)).toMatch(/^¡Hola! Me gustaría solicitar un presupuesto/);
  });
});

describe('buildWhatsAppUrl', () => {
  it('codifica acentos, espaços, quebras de linha e símbolos sem perder nada', () => {
    const message = buildQuoteMessage(data, pt.quote.message);
    const url = buildWhatsAppUrl('34742095084', message);
    expect(url.startsWith('https://wa.me/34742095084?text=')).toBe(true);
    expect(url).not.toMatch(/[\s+]/); // espaços como %20, nunca '+' nem espaços crus
    expect(url).toContain('%0A'); // quebras de linha
    expect(url).toContain('%26'); // '&' não parte a query string
    expect(textOf(url)).toBe(message);
  });

  it('recusa números com formato inválido', () => {
    expect(() => buildWhatsAppUrl('+34 742 09 50 84')).toThrow();
    expect(() => buildWhatsAppUrl('123')).toThrow();
  });
});

describe('openWhatsApp', () => {
  it('abre numa nova aba e corta a referência à janela de origem', () => {
    const tab = { opener: {} as unknown };
    const win = { open: vi.fn().mockReturnValue(tab) };
    expect(openWhatsApp('https://wa.me/34742095084', win as unknown as Window)).toBe('opened');
    expect(win.open).toHaveBeenCalledWith('https://wa.me/34742095084', '_blank');
    expect(tab.opener).toBeNull();
  });

  it('deteta quando o navegador bloqueia a nova aba', () => {
    const win = { open: vi.fn().mockReturnValue(null) };
    expect(openWhatsApp('https://wa.me/34742095084', win as unknown as Window)).toBe('blocked');
  });
});

describe('messageFingerprint', () => {
  it('ignora maiúsculas do e-mail e muda com a descrição', () => {
    expect(messageFingerprint(data)).toBe(messageFingerprint({ ...data, email: 'ANA@example.es' }));
    expect(messageFingerprint(data)).not.toBe(messageFingerprint({ ...data, description: 'Outra coisa' }));
  });
});
