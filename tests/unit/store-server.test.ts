// Testes do servidor da loja com uma base de dados SQLite temporária (migrações reais).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { useTestDatabase } from './helpers/db';
import { products as productsTable, sessions } from '../../src/server/db/schema';
import { createProduct, addProductImage, getPublicProduct, listPublicProducts, deleteProduct, makeCoverImage, getProduct } from '../../src/server/products';
import { attachSession, createPendingOrder, fulfilOrder, getOrder, markSession } from '../../src/server/orders';
import { canSell, getStoreSettings, missingLegal, saveStoreSettings, DEFAULT_SETTINGS } from '../../src/server/settings';
import { toStripeParams, type CheckoutSessionInfo } from '../../src/server/payments';
import { handleStripeEvent } from '../../src/pages/api/stripe/webhook';
import { hashPassword, verifyPassword } from '../../src/server/password';
import { attemptLogin, createSession, getSessionAdmin, destroySession } from '../../src/server/auth';
import { admins } from '../../src/server/db/schema';
import type { AstroCookies } from 'astro';

let cleanup: () => void;
let db: Awaited<ReturnType<typeof useTestDatabase>>['db'];
beforeEach(async () => {
  ({ db, cleanup } = await useTestDatabase());
});
afterEach(() => cleanup());

const baseProduct = {
  slug: 'vaso',
  namePt: 'Vaso',
  nameEs: '',
  shortPt: 'Curto',
  shortEs: 'Corto',
  descriptionPt: '',
  descriptionEs: '',
  categories: ['decoracao'],
  priceCents: 2490,
  stock: 5,
  active: true,
  featured: false,
  sortOrder: 0,
};

function paidSession(orderId: string, over: Partial<CheckoutSessionInfo> = {}): CheckoutSessionInfo {
  return {
    id: `cs_test_${orderId}`,
    url: null,
    paymentStatus: 'paid',
    status: 'complete',
    orderId,
    email: 'ana@example.es',
    name: 'Ana',
    phone: '+34600000000',
    address: { line1: 'Calle 1', line2: null, postal_code: '28001', city: 'Madrid', state: null, country: 'ES' },
    paymentIntent: 'pi_123',
    amountTotal: 5475,
    ...over,
  };
}

describe('produtos', () => {
  it('lista só ativos, traduz com alternativa em português e ordena imagens', async () => {
    const id = await createProduct(baseProduct);
    await createProduct({ ...baseProduct, slug: 'oculto', active: false });
    await addProductImage(id, { url: '/a.webp', thumbUrl: '/a-t.webp', width: 10, height: 10, altPt: 'A', altEs: '' });
    await addProductImage(id, { url: '/b.webp', thumbUrl: '/b-t.webp', width: 10, height: 10, altPt: 'B', altEs: 'B es' });

    expect((await listPublicProducts('en'))[0].short).toBe('Curto'); // sem texto EN → português
    const list = await listPublicProducts('es');
    expect(list.map((p) => p.slug)).toEqual(['vaso']);
    expect(list[0].name).toBe('Vaso'); // sem nome ES → português
    expect(list[0].short).toBe('Corto');
    // Sem texto ES usa o PT; sem nenhum, usa o nome do produto.
    expect(list[0].images.map((i) => i.alt)).toEqual(['A', 'B es']);
    expect(await getPublicProduct('oculto', 'pt')).toBeNull();

    const second = (await getProduct(id))!.images[1].id;
    await makeCoverImage(second, id);
    expect((await getProduct(id))!.images[0].url).toBe('/b.webp');
  });

  it('apagar produto devolve os ficheiros a remover', async () => {
    const id = await createProduct(baseProduct);
    await addProductImage(id, { url: '/uploads/x.webp', thumbUrl: '/uploads/x-t.webp', width: 1, height: 1, altPt: '', altEs: '' });
    expect(await deleteProduct(id)).toEqual(['/uploads/x.webp', '/uploads/x-t.webp']);
    expect(await getProduct(id)).toBeNull();
  });
});

describe('encomendas', () => {
  async function order() {
    const productId = await createProduct(baseProduct);
    const id = await createPendingOrder(
      {
        lines: [{ productId, slug: 'vaso', name: 'Vaso', unitPriceCents: 2490, quantity: 2, lineTotalCents: 4980 }],
        subtotalCents: 4980,
        shippingCents: 495,
        totalCents: 5475,
      },
      'pt',
    );
    await attachSession(id, `cs_test_${id}`);
    return { id, productId };
  }

  it('confirma o pagamento uma única vez e desconta o stock uma única vez', async () => {
    const { id, productId } = await order();
    const first = await fulfilOrder(paidSession(id));
    expect(first).toMatchObject({ status: 'paid', email: 'ana@example.es', customerName: 'Ana' });
    expect(first?.shippingAddress).toMatchObject({ city: 'Madrid', postalCode: '28001', country: 'ES' });
    await fulfilOrder(paidSession(id)); // webhook repetido + página de sucesso
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    expect(p.stock).toBe(3);
  });

  it('não confirma sessões não pagas', async () => {
    const { id } = await order();
    expect(await fulfilOrder(paidSession(id, { paymentStatus: 'unpaid' }))).toBeNull();
    expect((await getOrder(id))?.status).toBe('pending');
  });

  it('sessão expirada marca a encomenda pendente como expirada', async () => {
    const { id } = await order();
    await markSession(`cs_test_${id}`, 'expired');
    expect((await getOrder(id))?.status).toBe('expired');
  });
});

describe('webhook Stripe', () => {
  it('verifica a assinatura e trata checkout.session.completed', async () => {
    const productId = await createProduct(baseProduct);
    const id = await createPendingOrder(
      {
        lines: [{ productId, slug: 'vaso', name: 'Vaso', unitPriceCents: 2490, quantity: 1, lineTotalCents: 2490 }],
        subtotalCents: 2490,
        shippingCents: 0,
        totalCents: 2490,
      },
      'pt',
    );
    const secret = 'whsec_test_secret';
    const stripe = new Stripe('sk_test_dummy');
    const payload = JSON.stringify({
      id: 'evt_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: { id: `cs_test_${id}`, object: 'checkout.session' } },
    });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const event = stripe.webhooks.constructEvent(payload, header, secret);
    expect(() => stripe.webhooks.constructEvent(payload, header.replace(/v1=\w/, 'v1=0'), secret)).toThrow();

    const retrieve = vi.fn(async (sid: string) => paidSession(id, { id: sid }));
    await handleStripeEvent(event, retrieve);
    expect(retrieve).toHaveBeenCalledWith(`cs_test_${id}`);
    expect((await getOrder(id))?.status).toBe('paid');
  });
});

describe('parâmetros do Stripe Checkout', () => {
  it('usa preços do servidor, EUR, portes e países configurados', () => {
    const params = toStripeParams({
      orderId: 'ord-1',
      lines: [{ productId: 1, slug: 'vaso', name: 'Vaso', unitPriceCents: 2490, quantity: 2, lineTotalCents: 4980 }],
      shippingCents: 495,
      shippingCountries: ['ES', 'PT'],
      locale: 'es',
      successUrl: 'https://m3d.trustec.com.br/checkout/sucesso/?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://m3d.trustec.com.br/checkout/cancelado/',
      imageUrls: { 1: 'https://m3d.trustec.com.br/a.webp' },
    });
    expect(params.mode).toBe('payment');
    expect(params.locale).toBe('es');
    expect(params.metadata).toEqual({ order_id: 'ord-1' });
    expect(params.line_items?.[0]).toMatchObject({
      quantity: 2,
      price_data: { currency: 'eur', unit_amount: 2490, product_data: { name: 'Vaso', images: ['https://m3d.trustec.com.br/a.webp'] } },
    });
    expect(params.shipping_address_collection?.allowed_countries).toEqual(['ES', 'PT']);
    expect(params.shipping_options?.[0]).toMatchObject({ shipping_rate_data: { fixed_amount: { amount: 495, currency: 'eur' } } });
    expect(params.success_url).toContain('{CHECKOUT_SESSION_ID}');
  });
});

describe('configurações', () => {
  it('só permite vender com loja ativa, pagamentos e documentos legais', async () => {
    expect(await getStoreSettings()).toEqual(DEFAULT_SETTINGS);
    const legal = { legalNoticeUrl: '/aviso', privacyUrl: '/privacidade', termsUrl: '/condicoes', cookiesUrl: '' };
    await saveStoreSettings({ ...DEFAULT_SETTINGS, storeEnabled: true, legal });
    const s = await getStoreSettings();
    expect(missingLegal(s)).toEqual([]);
    expect(canSell(s, true)).toBe(true);
    expect(canSell(s, false)).toBe(false);
    expect(canSell({ ...s, legal: { ...legal, termsUrl: '' } }, true)).toBe(false);
  });
});

describe('autenticação do painel', () => {
  function fakeCookies() {
    const jar = new Map<string, string>();
    return {
      jar,
      cookies: {
        get: (k: string) => (jar.has(k) ? { value: jar.get(k)! } : undefined),
        set: (k: string, v: string) => void jar.set(k, v),
        delete: (k: string) => void jar.delete(k),
      } as unknown as AstroCookies,
    };
  }

  it('hash de palavra-passe verificável e diferente a cada vez', async () => {
    const a = await hashPassword('uma-palavra-passe');
    expect(a).not.toBe(await hashPassword('uma-palavra-passe'));
    expect(await verifyPassword('uma-palavra-passe', a)).toBe(true);
    expect(await verifyPassword('errada', a)).toBe(false);
    expect(await verifyPassword('x', 'formato-invalido')).toBe(false);
  });

  it('login, sessão por cookie (só o hash fica na BD) e saída', async () => {
    await db.insert(admins).values({ email: 'dono@moldea.es', passwordHash: await hashPassword('segredo-muito-bom') });
    const result = await attemptLogin('  DONO@moldea.es ', 'segredo-muito-bom');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { jar, cookies } = fakeCookies();
    await createSession(result.admin.id, cookies, true);
    const token = jar.get('moldea_admin')!;
    const [stored] = await db.select().from(sessions);
    expect(stored.id).not.toBe(token);
    expect(await getSessionAdmin(cookies)).toEqual({ id: result.admin.id, email: 'dono@moldea.es' });
    await destroySession(cookies);
    expect(await getSessionAdmin(cookies)).toBeNull();
  });

  it('bloqueia após 5 tentativas falhadas', async () => {
    await db.insert(admins).values({ email: 'dono@moldea.es', passwordHash: await hashPassword('segredo-muito-bom') });
    for (let i = 0; i < 5; i++) expect(await attemptLogin('dono@moldea.es', 'errada')).toEqual({ ok: false, reason: 'invalid' });
    expect(await attemptLogin('dono@moldea.es', 'segredo-muito-bom')).toEqual({ ok: false, reason: 'locked' });
  });
});
