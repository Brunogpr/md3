import { expect, test, type Page } from '@playwright/test';

// Nenhum teste abre o WhatsApp de verdade: window.open é substituído para registar os URLs.
// mode 'opened' simula uma aba aberta; 'blocked' simula o bloqueio de pop-ups.
async function stubWindowOpen(page: Page, mode: 'opened' | 'blocked' = 'opened') {
  await page.addInitScript((m) => {
    const calls: string[] = [];
    (window as unknown as { __openCalls: string[] }).__openCalls = calls;
    window.open = ((url?: string | URL) => {
      calls.push(String(url));
      return m === 'opened' ? ({ opener: window } as unknown as Window) : null;
    }) as typeof window.open;
  }, mode);
}

const openCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __openCalls: string[] }).__openCalls);

const textOf = (url: string) => new URL(url).searchParams.get('text') ?? '';

async function fillValid(page: Page) {
  await page.fill('#q-name', 'Ana López');
  await page.fill('#q-email', 'ana@example.es');
  await page.selectOption('#q-product', 'conjunto-decorativo-natal');
  await page.selectOption('#q-type', 'informacoes');
  await page.fill('#q-description', 'Gostaria de saber que cores e dimensões estão disponíveis — obrigado!');
  await page.check('#q-consent');
}

const status = (page: Page) => page.locator('[data-status]');
const FALSE_SUCCESS = /recebid|enviado com sucesso|foi enviado/i;

test.describe('Formulário de orçamento (WhatsApp)', () => {
  test('mostra erros claros, foca o primeiro campo inválido e não abre o WhatsApp', async ({ page }) => {
    await stubWindowOpen(page);
    await page.goto('/#orcamento');
    await page.locator('[data-submit]').click();

    await expect(page.locator('#q-name')).toBeFocused();
    await expect(page.locator('#q-name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#q-name-error')).toHaveText('Este campo é obrigatório.');
    await expect(page.locator('#q-consent-error')).toBeVisible();
    await expect(status(page)).toContainText('Reveja os campos assinalados.');

    await page.fill('#q-email', 'ana@');
    await page.locator('#q-email').blur();
    await expect(page.locator('#q-email-error')).toContainText('e-mail válido');

    // Telefone torna-se obrigatório com preferência por telefone.
    await page.getByLabel('Telefone', { exact: true }).last().check();
    await expect(page.locator('#q-phone-error')).toContainText('telefone');
    expect(await openCalls(page)).toEqual([]);
  });

  test('abre wa.me/34742095084 com a mensagem completa e codificada', async ({ page }) => {
    await stubWindowOpen(page);
    await page.goto('/#orcamento');
    await fillValid(page);
    await page.locator('[data-submit]').click();

    const calls = await openCalls(page);
    expect(calls).toHaveLength(1);
    const url = calls[0];
    expect(url.startsWith('https://wa.me/34742095084?text=')).toBe(true);
    expect(url).not.toMatch(/\s/);
    const text = textOf(url);
    expect(text.startsWith('Olá! Gostaria de solicitar um orçamento à Moldea.')).toBe(true);
    expect(text).toContain('Nome: Ana López');
    expect(text).toContain('E-mail: ana@example.es');
    expect(text).toContain('Produto: Conjunto decorativo de Natal');
    expect(text).toContain('Tipo de pedido: Informações sobre cores, dimensões ou personalização');
    expect(text).toContain('Descrição: Gostaria de saber que cores e dimensões estão disponíveis — obrigado!');
    expect(text).toMatch(/Página: http:\/\/localhost:4321\/produtos\/conjunto-decorativo-natal\/$/m);
    expect(text).not.toContain('Telefone:'); // campo opcional vazio omitido

    // Informa que falta confirmar no WhatsApp, sem fingir que o pedido chegou.
    await expect(status(page)).toContainText('o pedido só chega à Moldea depois de o enviar');
    await expect(status(page)).not.toContainText(FALSE_SUCCESS);
    await expect(status(page).locator('[data-whatsapp-continue]')).toHaveAttribute('href', url);
    await expect(page.locator('#q-name')).toHaveValue('Ana López'); // dados mantidos
  });

  test('inclui o telefone quando é preenchido', async ({ page }) => {
    await stubWindowOpen(page);
    await page.goto('/#orcamento');
    await fillValid(page);
    await page.fill('#q-phone', '+34 600 123 456');
    await page.locator('[data-submit]').click();
    expect(textOf((await openCalls(page))[0])).toContain('Telefone: +34 600 123 456');
  });

  test('com a nova aba bloqueada mostra um link visível para continuar', async ({ page }) => {
    await stubWindowOpen(page, 'blocked');
    await page.goto('/#orcamento');
    await fillValid(page);
    await page.locator('[data-submit]').click();

    await expect(status(page)).toHaveAttribute('data-tone', 'warning');
    await expect(status(page)).toContainText('não abriu o WhatsApp automaticamente');
    await expect(status(page)).not.toContainText(FALSE_SUCCESS);
    const link = status(page).getByRole('link', { name: 'Abrir conversa no WhatsApp' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /^https:\/\/wa\.me\/34742095084\?text=/);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener');
  });

  test('cliques repetidos e o mesmo pedido não abrem várias conversas', async ({ page }) => {
    await stubWindowOpen(page);
    await page.goto('/#orcamento');
    await fillValid(page);
    const submit = page.locator('[data-submit]');
    await submit.click();
    await submit.click({ force: true }); // durante o bloqueio temporário
    expect(await openCalls(page)).toHaveLength(1);

    await expect(submit).toBeEnabled({ timeout: 5000 });
    await submit.click();
    await expect(status(page)).toContainText('Já preparámos esta mensagem');
    expect(await openCalls(page)).toHaveLength(1);

    // Um pedido diferente abre uma nova conversa.
    await page.fill('#q-description', 'Outro pedido, agora para um presente personalizado.');
    await submit.click();
    expect(await openCalls(page)).toHaveLength(2);
  });

  test('a partir da página de detalhes, o produto vai pré-preenchido na mensagem', async ({ page }) => {
    await stubWindowOpen(page);
    await page.goto('/produtos/conjunto-decorativo-natal/');
    await page.locator('.product__actions').getByRole('link', { name: 'Solicitar orçamento' }).click();
    await expect(page.locator('#q-product')).toHaveValue('conjunto-decorativo-natal');
    await expect(page.locator('#q-type')).toHaveValue('catalogo');

    await page.fill('#q-name', 'João');
    await page.fill('#q-email', 'joao@example.pt');
    await page.fill('#q-description', 'Preço para duas unidades, por favor.');
    await page.check('#q-consent');
    await page.locator('[data-submit]').click();
    const text = textOf((await openCalls(page))[0]);
    expect(text).toContain('Produto: Conjunto decorativo de Natal');
    expect(text).toContain('Tipo de pedido: Orçamento de um produto do catálogo');
  });

  test('"Solicitar orçamento" num cartão pré-preenche o produto', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-product-card]', { hasText: 'Conjunto decorativo de Natal' });
    await card.getByRole('link', { name: 'Solicitar orçamento' }).click();
    await expect(page.locator('#q-product')).toHaveValue('conjunto-decorativo-natal');
    await expect(page.locator('#q-type')).toHaveValue('catalogo');
    await expect(page.locator('#q-name')).toBeFocused();
    await expect(page).toHaveURL(/produto=conjunto-decorativo-natal/);
  });

  test('"Consultar este produto" pré-preenche pedido de informações', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Consultar este produto' }).click();
    await expect(page.locator('#q-product')).toHaveValue('conjunto-decorativo-natal');
    await expect(page.locator('#q-type')).toHaveValue('informacoes');
  });

  test('pré-preenchimento por URL ignora produtos inexistentes', async ({ page }) => {
    await page.goto('/?produto=nao-existe&tipo=personalizado#orcamento');
    await expect(page.locator('#q-product')).toHaveValue('');
    await expect(page.locator('#q-type')).toHaveValue('personalizado');
  });

  test('é utilizável só com teclado', async ({ page, isMobile }) => {
    test.skip(isMobile, 'teclado físico');
    await stubWindowOpen(page);
    await page.goto('/#orcamento');
    await page.locator('#q-name').focus();
    await page.keyboard.type('Ana');
    await page.keyboard.press('Tab');
    await page.keyboard.type('ana@example.es');
    await page.keyboard.press('Tab');
    await expect(page.locator('#q-phone')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#q-product')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#q-type')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#q-description')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('input[name="contactPreference"]:checked')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#q-consent')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.locator('#q-consent')).toBeChecked();
    // Com política de privacidade configurada, o link dela vem antes do botão.
    await page.keyboard.press('Tab');
    const privacy = page.locator('.consent a');
    if (await privacy.count()) {
      await expect(privacy).toBeFocused();
      await page.keyboard.press('Tab');
    }
    await expect(page.locator('[data-submit]')).toBeFocused();
  });

  test('o formulário não guarda dados no navegador nem os envia para outros servidores', async ({ page }) => {
    await stubWindowOpen(page);
    const outgoing: string[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET' || !req.url().startsWith('http://localhost:4321')) outgoing.push(req.url());
    });
    await page.goto('/#orcamento');
    await fillValid(page);
    await page.locator('[data-submit]').click();
    await expect(status(page)).toBeVisible();
    expect(outgoing).toEqual([]);
    // Nada do formulário fica guardado (o carrinho vazio também não grava nada).
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(stored).not.toContain('Ana');
    expect(stored).not.toContain('example.es');
    expect(await page.evaluate(() => localStorage.getItem('moldea-cart-v1'))).toBeNull();
  });
});

test.describe('Outros pontos de contacto', () => {
  test('página de produto tem link de WhatsApp com o nome e o URL do produto', async ({ page }) => {
    await page.goto('/produtos/conjunto-decorativo-natal/');
    const link = page.locator('[data-product-whatsapp]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    const href = (await link.getAttribute('href'))!;
    expect(href.startsWith('https://wa.me/34742095084?text=')).toBe(true);
    const text = textOf(href);
    expect(text).toContain('"Conjunto decorativo de Natal"');
    expect(text).toContain('https://m3d.trustec.com.br/produtos/conjunto-decorativo-natal/');
  });

  test('contactos do formulário e do rodapé usam o número comercial', async ({ page }) => {
    await page.goto('/');
    for (const scope of ['.quote__contact', '.site-footer']) {
      await expect(page.locator(`${scope} a[href^="tel:"]`)).toHaveAttribute('href', 'tel:+34742095084');
      const wa = page.locator(`${scope} a[href*="wa.me"]`);
      await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/34742095084\?text=/);
    }
    // O número não aparece com nenhum outro formato num link.
    const hrefs = await page.locator('a[href*="wa.me"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    hrefs.forEach((h) => expect(h).toMatch(/^https:\/\/wa\.me\/34742095084(\?|$)/));
  });
});
