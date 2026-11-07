import type { Localized } from '../i18n/config';

// Categorias propostas — não são um catálogo confirmado. Para alterar, editar esta lista:
// o filtro do catálogo e os cartões usam-na automaticamente.
export const categories = [
  { id: 'decoracao', label: { pt: 'Decoração', es: 'Decoración', en: 'Home decor' } },
  { id: 'presentes', label: { pt: 'Presentes', es: 'Regalos', en: 'Gifts' } },
  { id: 'personalizados', label: { pt: 'Personalizados', es: 'Personalizados', en: 'Personalised' } },
  { id: 'casa-escritorio', label: { pt: 'Casa e escritório', es: 'Hogar y oficina', en: 'Home & office' } },
] as const satisfies ReadonlyArray<{ id: string; label: Localized }>;

export type CategoryId = (typeof categories)[number]['id'];

export function getCategory(id: CategoryId) {
  const category = categories.find((c) => c.id === id);
  if (!category) throw new Error(`Categoria desconhecida: ${id}`);
  return category;
}
