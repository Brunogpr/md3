// Loja, painel e tema, contra a base de dados de testes (scripts/e2e-setup.ts) com pagamentos simulados.
import { expect, test, type Page } from '@playwright/test';
import { E2E_ADMIN } from './fixtures';

async function login(page: Page, next = '/admin') {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.fill('#email', E2E_ADMIN.email);
  await page.fill('#password', E2E_ADMIN.password);
  await page.click('button[type=submit]');
  await page.waitForURL((url) => url.pathname.startsWith(next));
}

test.describe('Painel de administração', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(({ isMobile }) => isMobile, 'fluxo de gestão testado em desktop');

  test('páginas do painel exigem sessão', async ({ page, request }) => {
    await page.goto('/admin/produtos/novo');
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fprodutos%2Fnovo/);
    const res = await request.get('/admin/pedidos', { maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(res.headers()['x-robots-tag']).toContain('noindex');
  });

  test('palavra-passe errada mostra erro genérico', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('#email', E2E_ADMIN.email);
    await page.fill('#password', 'errada-errada');
    await page.click('button[type=submit]');
    await expect(page.getByRole('alert')).toHaveText('E-mail ou palavra-passe incorretos.');
  });

  test('cria um produto com foto e preço, que aparece no site com carrinho', async ({ page }) => {
    const name = `Porta-lápis ${Date.now()}`;
    await login(page);
    await expect(page.locator('.notice--ok')).toContainText('Loja ativa');
    await page.click('text=+ Novo produto');
    await page.fill('#namePt', name);
    await page.fill('#shortPt', 'Organizador para a secretária.');
    await page.fill('#price', '12,50');
    await page.fill('#stock', '4');
    await page.check('input[name=categories][value=casa-escritorio]');
    await page.setInputFiles('#images', 'public/icon-512.png');
    await page.getByRole('button', { name: 'Criar produto' }).click();
    await expect(page.getByRole('status')).toHaveText('Alterações guardadas.');
    await expect(page.locator('.images img')).toHaveCount(1);

    // Erro de validação claro.
    await page.fill('#price', 'doze');
    await page.getByRole('button', { name: 'Guardar alterações' }).click();
    await expect(page.locator('.f__error')).toContainText('Preço inválido');

    await page.goto('/produtos/');
    const card = page.locator('[data-product-card]', { hasText: name });
    await expect(card).toContainText('12,50');
    await expect(card.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeVisible();
    const img = card.locator('img');
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    expect(await img.getAttribute('src')).toMatch(/^\/uploads\/produtos\/.+\.webp$/);
  });

  test('limita a página inicial a 4 produtos', async ({ page }) => {
    await login(page);
    // A base de testes já tem 2 na página inicial: criar mais 2 chega ao limite; o 5.º é recusado.
    for (const n of [1, 2, 3]) {
      await page.goto('/admin/produtos/novo');
      await page.fill('#namePt', `Destaque ${n} ${Date.now()}`);
      await page.fill('#sortOrder', '99'); // depois dos produtos usados pelos outros testes
      await page.check('input[name=featured]');
      await page.getByRole('button', { name: 'Criar produto' }).click();
      if (n < 3) await expect(page.getByRole('status')).toHaveText('Alterações guardadas.');
    }
    await expect(page.locator('.f__error')).toContainText('já tem 4 produtos');
    await page.goto('/');
    expect(await page.locator('#produtos [data-catalog-item]').count()).toBe(4);
  });

  test('não deixa ativar a loja sem os documentos legais', async ({ page }) => {
    await login(page, '/admin/configuracoes');
    const terms = await page.inputValue('#termsUrl');
    await page.fill('#termsUrl', '');
    await page.getByRole('button', { name: 'Guardar configurações' }).click();
    await expect(page.locator('.f__error').first()).toContainText('obrigatório');
    // Repõe (os outros testes precisam da loja ativa).
    await page.fill('#termsUrl', terms);
    await page.getByRole('button', { name: 'Guardar configurações' }).click();
    await expect(page.getByRole('status')).toHaveText('Configurações guardadas.');
  });
});

test.describe('Carrinho e pagamento', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(({ isMobile }) => isMobile, 'stock partilhado: compra testada uma vez, em desktop');

  test('compra completa: carrinho → Stripe (simulado) → confirmação → encomenda no painel', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-product-card]', { hasText: 'Vaso Espiral' });
    await card.getByRole('button', { name: 'Adicionar ao carrinho' }).click();

    const cart = page.getByRole('dialog', { name: 'Carrinho' });
    await expect(cart).toBeVisible();
    await expect(page.locator('[data-cart-count]')).toHaveText('1');
    await cart.getByRole('button', { name: 'Aumentar quantidade' }).click();
    await expect(cart.locator('output')).toHaveText('2');
    await expect(cart.locator('[data-cart-subtotal]')).toHaveText(/49,80\s€/);
    await expect(cart.locator('[data-cart-shipping]')).toHaveText(/4,95\s€/);
    await expect(cart.locator('[data-cart-total]')).toHaveText(/54,75\s€/);
    // Stock 3: não deixa passar de 3.
    await cart.getByRole('button', { name: 'Aumentar quantidade' }).click();
    await expect(cart.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled();
    await cart.getByRole('button', { name: 'Diminuir quantidade' }).click();

    await cart.getByRole('button', { name: 'Finalizar compra' }).click();
    await page.waitForURL(/\/checkout\/sucesso\/\?session_id=cs_fake_/);
    await expect(page.locator('h1')).toHaveText('Obrigado pela sua compra!');
    const ref = (await page.locator('[data-order-ref]').textContent())!.trim();
    expect(ref).toMatch(/^[0-9A-F]{8}$/);
    expect(await page.evaluate(() => localStorage.getItem('moldea-cart-v1'))).toBeNull();

    await login(page, '/admin/pedidos');
    const row = page.locator('tr', { hasText: ref });
    await expect(row).toContainText('Paga — por enviar');
    await expect(row).toContainText('54,75');
    await row.getByRole('link', { name: 'Abrir' }).click();
    await expect(page.locator('address')).toContainText('Madrid');
    await page.selectOption('#status', 'shipped');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('.tag').first()).toHaveText('Enviada');

    await page.goto('/admin');
    await expect(page.locator('tr', { hasText: 'Vaso Espiral' }).locator('td').nth(3)).toHaveText('1');
  });

  test('stock insuficiente: o servidor recusa e o carrinho é corrigido', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'moldea-cart-v1',
        JSON.stringify([
          { productId: 2, slug: 'vaso-espiral', name: 'Vaso Espiral', priceCents: 1, stock: null, image: null, href: '/produtos/vaso-espiral/', quantity: 9 },
        ]),
      );
    });
    await page.reload();
    await page.locator('[data-cart-open]').click();
    const cart = page.getByRole('dialog', { name: 'Carrinho' });
    await cart.getByRole('button', { name: 'Finalizar compra' }).click();
    await expect(cart.getByRole('alert')).toContainText('mudaram');
    // Ficou com o stock real disponível (1 depois da compra anterior).
    await expect(cart.locator('output')).toHaveText('1');
  });

  test('API de pagamento recusa pedidos de outra origem e carrinhos inválidos', async ({ request }) => {
    const foreign = await request.post('/api/checkout', {
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      data: { items: [{ productId: 2, quantity: 1 }] },
    });
    expect(foreign.status()).toBe(403);
    const noPrice = await request.post('/api/checkout', { data: { items: [{ productId: 1, quantity: 1 }] } });
    expect(noPrice.status()).toBe(409);
    expect((await noPrice.json()).problems[0].code).toBe('no-price');
    const empty = await request.post('/api/checkout', { data: { items: [] } });
    expect(empty.status()).toBe(409);
  });
});

test.describe('Segurança', () => {
  test('ficheiros locais não permitem sair da pasta de uploads', async ({ request }) => {
    expect((await request.get('/uploads/..%2F..%2Fpackage.json')).status()).toBe(404);
    expect((await request.get('/uploads/../../.env.production')).status()).toBe(404);
  });

  test('cabeçalhos de segurança', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['x-frame-options']).toBe('DENY');
  });
});
