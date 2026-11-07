// Cria uma sessão de pagamento Stripe a partir do carrinho. Os preços e o stock vêm sempre
// da base de dados; do navegador só se aceitam ids de produto e quantidades.
import type { APIRoute } from 'astro';
import { priceCart, sanitizeCart } from '../../lib/cart';
import { getProductsByIds } from '../../server/products';
import { getStoreSettings, canSell } from '../../server/settings';
import { getPaymentGateway } from '../../server/payments';
import { attachSession, createPendingOrder, deleteOrder } from '../../server/orders';
import { getDb } from '../../server/db/client';
import { localeSettings, publishedLocales, type Locale } from '../../i18n/config';

export const prerender = false;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request, url }) => {
  // Só aceita pedidos JSON da própria origem.
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json(403, { error: 'forbidden' });
  if (!request.headers.get('content-type')?.includes('application/json')) return json(415, { error: 'json' });

  let body: { items?: unknown; locale?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'invalid' });
  }
  const locale: Locale = publishedLocales.find((l) => l === body.locale) ?? 'pt';

  const settings = await getStoreSettings();
  const gateway = getPaymentGateway();
  if (!gateway || !canSell(settings, true)) return json(503, { error: 'store-closed' });

  const lines = sanitizeCart(body.items);
  const rows = await getProductsByIds(lines.map((l) => l.productId));
  const result = priceCart(
    lines,
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: ({ pt: r.namePt, es: r.nameEs, en: r.nameEn }[locale] || r.namePt),
      priceCents: r.priceCents,
      stock: r.stock,
      active: r.active,
    })),
    settings,
  );
  if (!result.ok) return json(409, { error: 'cart', problems: result.problems });

  // Volta para o mesmo domínio onde o cliente está a comprar (ex.: domínio novo ou pré-visualização).
  const base = url.origin;
  const prefix = localeSettings[locale].pathPrefix;
  const imageRows = await getDb().query.productImages.findMany({
    where: (img, { inArray }) => inArray(img.productId, lines.map((l) => l.productId)),
    orderBy: (img, { asc }) => [asc(img.sortOrder)],
  });
  const imageUrls: Record<number, string | undefined> = {};
  for (const img of imageRows) imageUrls[img.productId] ??= new URL(img.thumbUrl, base).href;

  const orderId = await createPendingOrder(result.totals, locale);
  try {
    const session = await gateway.createCheckout({
      orderId,
      lines: result.totals.lines,
      shippingCents: result.totals.shippingCents,
      shippingCountries: settings.shippingCountries,
      locale,
      imageUrls,
      successUrl: `${base}${prefix}/checkout/sucesso/?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}${prefix}/checkout/cancelado/`,
    });
    await attachSession(orderId, session.id);
    return json(200, { url: session.url });
  } catch (error) {
    console.error('[checkout] erro ao criar sessão Stripe', error);
    await deleteOrder(orderId);
    return json(502, { error: 'payment-provider' });
  }
};
