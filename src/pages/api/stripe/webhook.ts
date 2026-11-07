// Webhook do Stripe: única fonte de verdade para "pago". Configurar no painel da Stripe com os eventos
// checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.async_payment_failed e checkout.session.expired.
import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { getPaymentGateway } from '../../../server/payments';
import { fulfilOrder, markSession } from '../../../server/orders';

export const prerender = false;

export async function handleStripeEvent(
  event: Stripe.Event,
  retrieve: (id: string) => ReturnType<NonNullable<ReturnType<typeof getPaymentGateway>>['retrieveSession']>,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      // Relê a sessão na Stripe (estado atual e dados de envio completos).
      const session = await retrieve(event.data.object.id);
      await fulfilOrder(session);
      break;
    }
    case 'checkout.session.async_payment_failed':
      await markSession(event.data.object.id, 'failed');
      break;
    case 'checkout.session.expired':
      await markSession(event.data.object.id, 'expired');
      break;
    default:
      break;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const gateway = getPaymentGateway();
  if (!gateway) return new Response('Pagamentos não configurados', { status: 503 });
  const body = await request.text(); // corpo em bruto: necessário para verificar a assinatura
  let event: Stripe.Event;
  try {
    event = gateway.parseWebhook(body, request.headers.get('stripe-signature'));
  } catch (error) {
    console.warn('[stripe] webhook rejeitado:', (error as Error).message);
    return new Response('Assinatura inválida', { status: 400 });
  }
  try {
    await handleStripeEvent(event, (id) => gateway.retrieveSession(id));
  } catch (error) {
    console.error('[stripe] erro ao processar', event.type, error);
    return new Response('Erro', { status: 500 }); // a Stripe volta a tentar
  }
  return new Response('ok');
};
