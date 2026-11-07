// Encomendas: criadas como "pending" antes do pagamento e confirmadas pelo webhook do Stripe
// (ou pela página de sucesso, como reforço). A confirmação é idempotente.
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { getDb } from './db/client';
import { orders, products, type OrderStatus, type ShippingAddress } from './db/schema';
import type { CartTotals } from '../lib/cart';
import type { CheckoutSessionInfo } from './payments';

export type OrderRow = typeof orders.$inferSelect;

export const ADMIN_STATUSES: OrderStatus[] = ['paid', 'shipped', 'completed', 'canceled'];

export async function createPendingOrder(totals: CartTotals, locale: string): Promise<string> {
  const id = randomUUID();
  await getDb()
    .insert(orders)
    .values({
      id,
      status: 'pending',
      items: totals.lines.map(({ productId, slug, name, unitPriceCents, quantity }) => ({
        productId,
        slug,
        name,
        unitPriceCents,
        quantity,
      })),
      subtotalCents: totals.subtotalCents,
      shippingCents: totals.shippingCents,
      totalCents: totals.totalCents,
      locale,
    });
  return id;
}

export async function attachSession(orderId: string, sessionId: string): Promise<void> {
  await getDb().update(orders).set({ stripeSessionId: sessionId, updatedAt: new Date() }).where(eq(orders.id, orderId));
}

export async function deleteOrder(orderId: string): Promise<void> {
  await getDb().delete(orders).where(and(eq(orders.id, orderId), eq(orders.status, 'pending')));
}

/**
 * Marca a encomenda como paga com os dados do cliente recolhidos pela Stripe e desconta o stock
 * uma única vez. Devolve a encomenda atualizada (ou null se não existir).
 */
export async function fulfilOrder(session: CheckoutSessionInfo): Promise<OrderRow | null> {
  if (session.paymentStatus !== 'paid' || !session.orderId) return null;
  const db = getDb();
  const order = await db.query.orders.findFirst({ where: eq(orders.id, session.orderId) });
  if (!order) return null;
  // Só avança de pending/expired/failed; não recua uma encomenda já enviada ou concluída.
  if (order.status === 'pending' || order.status === 'expired' || order.status === 'failed') {
    const address: ShippingAddress | null = session.address
      ? {
          line1: session.address.line1,
          line2: session.address.line2,
          postalCode: session.address.postal_code,
          city: session.address.city,
          state: session.address.state,
          country: session.address.country,
        }
      : null;
    await db
      .update(orders)
      .set({
        status: 'paid',
        stripeSessionId: session.id,
        stripePaymentIntent: session.paymentIntent,
        email: session.email,
        customerName: session.name,
        phone: session.phone,
        shippingAddress: address,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
  }
  // Desconto de stock protegido por flag: o UPDATE só passa se ainda não foi aplicado.
  const claimed = await db
    .update(orders)
    .set({ stockApplied: true })
    .where(and(eq(orders.id, order.id), eq(orders.stockApplied, false)))
    .returning({ id: orders.id });
  if (claimed.length > 0) {
    for (const item of order.items) {
      await db
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(and(eq(products.id, item.productId), isNotNull(products.stock)));
    }
  }
  return (await db.query.orders.findFirst({ where: eq(orders.id, order.id) })) ?? null;
}

export async function markSession(sessionId: string, status: 'expired' | 'failed'): Promise<void> {
  await getDb()
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(orders.stripeSessionId, sessionId), eq(orders.status, 'pending')));
}

export async function getOrderBySession(sessionId: string): Promise<OrderRow | null> {
  return (await getDb().query.orders.findFirst({ where: eq(orders.stripeSessionId, sessionId) })) ?? null;
}

// ---------------- Painel ----------------

export async function listOrders(includePending = false): Promise<OrderRow[]> {
  const statuses: OrderStatus[] = includePending
    ? ['pending', 'paid', 'shipped', 'completed', 'expired', 'failed', 'canceled']
    : ['paid', 'shipped', 'completed', 'canceled'];
  return getDb().select().from(orders).where(inArray(orders.status, statuses)).orderBy(desc(orders.createdAt)).limit(500);
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  return (await getDb().query.orders.findFirst({ where: eq(orders.id, id) })) ?? null;
}

export async function updateOrderStatus(id: string, status: OrderStatus, notes: string): Promise<void> {
  if (!ADMIN_STATUSES.includes(status)) throw new Error('Estado inválido');
  await getDb()
    .update(orders)
    .set({ status, notes: notes.slice(0, 2000), updatedAt: new Date() })
    .where(and(eq(orders.id, id), inArray(orders.status, ADMIN_STATUSES)));
}
