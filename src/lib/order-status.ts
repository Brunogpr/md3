import type { OrderStatus } from '../server/db/schema';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pagamento por concluir',
  paid: 'Paga — por enviar',
  shipped: 'Enviada',
  completed: 'Concluída',
  expired: 'Expirada (não paga)',
  failed: 'Pagamento falhou',
  canceled: 'Cancelada',
};

export function statusTone(status: OrderStatus): string {
  if (status === 'paid') return 'tag--warn';
  if (status === 'shipped' || status === 'completed') return 'tag--ok';
  return 'tag--off';
}
