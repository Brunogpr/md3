// Pagamentos com Stripe Checkout (página de pagamento alojada pela Stripe: os dados do cartão
// nunca passam por este site). Um "gateway" falso existe só para testes automáticos.
import Stripe from 'stripe';
import { PAYMENTS_FAKE, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from 'astro:env/server';
import type { PricedLine } from '../lib/cart';
import type { Locale } from '../i18n/config';

export interface CheckoutRequest {
  orderId: string;
  lines: PricedLine[];
  shippingCents: number;
  shippingCountries: string[];
  locale: Locale;
  successUrl: string;
  cancelUrl: string;
  imageUrls: Record<number, string | undefined>;
}

export interface CheckoutSessionInfo {
  id: string;
  url: string | null;
  paymentStatus: Stripe.Checkout.Session.PaymentStatus;
  status: Stripe.Checkout.Session.Status | null;
  orderId: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  address: Stripe.Address | null;
  paymentIntent: string | null;
  amountTotal: number | null;
}

export interface PaymentGateway {
  readonly name: 'stripe' | 'fake';
  createCheckout(req: CheckoutRequest): Promise<{ id: string; url: string }>;
  retrieveSession(id: string): Promise<CheckoutSessionInfo>;
  /** Verifica a assinatura do webhook e devolve o evento. Lança erro se for inválido. */
  parseWebhook(body: string, signature: string | null): Stripe.Event;
}

/** Linhas do Stripe a partir do carrinho já validado (preços da base de dados, IVA incluído). */
export function toStripeParams(req: CheckoutRequest): Stripe.Checkout.SessionCreateParams {
  return {
    mode: 'payment',
    locale: req.locale,
    client_reference_id: req.orderId,
    metadata: { order_id: req.orderId },
    payment_intent_data: { metadata: { order_id: req.orderId } },
    line_items: req.lines.map((l) => ({
      quantity: l.quantity,
      price_data: {
        currency: 'eur',
        unit_amount: l.unitPriceCents,
        product_data: {
          name: l.name,
          metadata: { product_id: String(l.productId) },
          ...(req.imageUrls[l.productId] ? { images: [req.imageUrls[l.productId]!] } : {}),
        },
      },
    })),
    shipping_address_collection: {
      allowed_countries: req.shippingCountries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
    },
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: { pt: 'Envio', es: 'Envío', en: 'Shipping' }[req.locale],
          fixed_amount: { amount: req.shippingCents, currency: 'eur' },
        },
      },
    ],
    phone_number_collection: { enabled: true },
    // A sessão expira passada 1 hora, para que preço e stock verificados não fiquem desatualizados.
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    success_url: req.successUrl,
    cancel_url: req.cancelUrl,
  };
}

function toInfo(s: Stripe.Checkout.Session): CheckoutSessionInfo {
  return {
    id: s.id,
    url: s.url,
    paymentStatus: s.payment_status,
    status: s.status,
    orderId: s.metadata?.order_id ?? s.client_reference_id ?? null,
    email: s.customer_details?.email ?? null,
    name: s.collected_information?.shipping_details?.name ?? s.customer_details?.name ?? null,
    phone: s.customer_details?.phone ?? null,
    address: s.collected_information?.shipping_details?.address ?? s.customer_details?.address ?? null,
    paymentIntent: typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null),
    amountTotal: s.amount_total,
  };
}

export function createStripeGateway(secretKey: string, webhookSecret?: string): PaymentGateway {
  const stripe = new Stripe(secretKey);
  return {
    name: 'stripe',
    async createCheckout(req) {
      const session = await stripe.checkout.sessions.create(toStripeParams(req), {
        idempotencyKey: `checkout-${req.orderId}`,
      });
      if (!session.url) throw new Error('A Stripe não devolveu o URL de pagamento.');
      return { id: session.id, url: session.url };
    },
    async retrieveSession(id) {
      return toInfo(await stripe.checkout.sessions.retrieve(id));
    },
    parseWebhook(body, signature) {
      if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET não configurado.');
      if (!signature) throw new Error('Assinatura em falta.');
      return stripe.webhooks.constructEvent(body, signature, webhookSecret);
    },
  };
}

/** Só para testes automáticos: "paga" de imediato e redireciona para a página de sucesso. */
export function createFakeGateway(): PaymentGateway {
  const sessions = new Map<string, CheckoutSessionInfo>();
  return {
    name: 'fake',
    async createCheckout(req) {
      const id = `cs_fake_${req.orderId}`;
      sessions.set(id, {
        id,
        url: null,
        paymentStatus: 'paid',
        status: 'complete',
        orderId: req.orderId,
        email: 'cliente@teste.local',
        name: 'Cliente de Teste',
        phone: null,
        address: { line1: 'Rua de Teste 1', line2: null, postal_code: '28001', city: 'Madrid', state: null, country: 'ES' },
        paymentIntent: `pi_fake_${req.orderId}`,
        amountTotal: req.lines.reduce((s, l) => s + l.lineTotalCents, 0) + req.shippingCents,
      });
      return { id, url: req.successUrl.replace('{CHECKOUT_SESSION_ID}', id) };
    },
    async retrieveSession(id) {
      const s = sessions.get(id);
      if (!s) throw new Error('Sessão desconhecida');
      return s;
    },
    parseWebhook() {
      throw new Error('Webhooks não disponíveis no modo de teste.');
    },
  };
}

let gateway: PaymentGateway | null | undefined;

/** Gateway configurado, ou null se o Stripe ainda não tiver chaves (loja fica sem compras). */
export function getPaymentGateway(): PaymentGateway | null {
  if (gateway !== undefined) return gateway;
  if (PAYMENTS_FAKE) {
    if (__DEPLOY_TARGET__ === 'netlify') throw new Error('PAYMENTS_FAKE não é permitido no site publicado.');
    gateway = createFakeGateway();
  } else {
    gateway = STRIPE_SECRET_KEY ? createStripeGateway(STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) : null;
  }
  return gateway;
}
