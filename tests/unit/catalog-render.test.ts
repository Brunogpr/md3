import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import ProductCatalog from '../../src/components/ProductCatalog.astro';
import type { PublicProduct } from '../../src/server/products';
import pt from '../../src/i18n/pt';

const product = (over: Partial<PublicProduct> = {}): PublicProduct => ({
  id: 1,
  slug: 'conjunto-decorativo-natal',
  name: 'Conjunto decorativo de Natal',
  short: 'Árvore, rena e figura.',
  description: '',
  categories: ['decoracao', 'presentes'],
  priceCents: null,
  stock: null,
  featured: true,
  images: [{ url: '/seed/a.webp', thumbUrl: '/seed/a.webp', width: 1200, height: 1800, alt: 'Foto' }],
  ...over,
});

async function render(products: PublicProduct[], selling: boolean, variant: 'home' | 'page' = 'home') {
  const container = await AstroContainer.create();
  return container.renderToString(ProductCatalog, { props: { locale: 'pt', products, selling, variant } });
}

describe('ProductCatalog', () => {
  it('mostra o estado vazio quando não há produtos', async () => {
    const html = await render([], false);
    expect(html).toContain(pt.catalog.emptyAll);
    expect(html).not.toContain('data-product-card');
  });

  it('produto sem preço: "sob consulta" e pedido de orçamento, sem carrinho', async () => {
    const html = await render([product()], true);
    expect(html).toContain(pt.store.priceOnRequest);
    expect(html).toContain('href="/?produto=conjunto-decorativo-natal&amp;tipo=catalogo#orcamento"');
    expect(html).not.toContain('data-add-to-cart');
  });

  it('produto com preço e stock: mostra preço com IVA e "Adicionar ao carrinho" quando a loja vende', async () => {
    const html = await render([product({ id: 7, slug: 'vaso', name: 'Vaso', priceCents: 2490, stock: 3 })], true);
    expect(html).toMatch(/24,90\s€/);
    expect(html).toContain(pt.store.vatIncluded);
    expect(html).toContain('data-add-to-cart');
    expect(html).toContain('Últimas 3 unidades');
  });

  it('loja fechada: mostra o preço mas não permite comprar', async () => {
    const html = await render([product({ priceCents: 2490, stock: 3 })], false);
    expect(html).toMatch(/24,90\s€/);
    expect(html).not.toContain('data-add-to-cart');
  });

  it('esgotado: selo e sem botão de compra', async () => {
    const html = await render([product({ priceCents: 2490, stock: 0 })], true);
    expect(html).toContain(pt.store.soldOut);
    expect(html).not.toContain('data-add-to-cart');
  });

  it('página de produtos: título h1 e filtros; página inicial: link "Ver todos" sem filtros', async () => {
    const two = [product(), product({ id: 2, slug: 'b', categories: ['casa-escritorio'] })];
    const page = await render(two, false, 'page');
    expect(page).toContain('data-catalog-filters');
    expect(page).toMatch(/<h1[^>]*>Todos os produtos/);
    const home = await render(two, false);
    expect(home).not.toContain('data-catalog-filters');
    expect(home).toContain('href="/produtos/"');
    expect(home).toContain(pt.catalog.viewAll);
  });
});
