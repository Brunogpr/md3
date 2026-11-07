import { expect, test, type Page } from '@playwright/test';

/** Recolhe erros de consola e pedidos falhados durante o teste. */
function trackProblems(page: Page) {
  const problems: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()}`));
  page.on('response', (res) => {
    if (res.status() >= 400) problems.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  return problems;
}

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
}

test.describe('Página inicial', () => {
  test('carrega sem erros de consola nem pedidos falhados', async ({ page }) => {
    const problems = trackProblems(page);
    await page.goto('/');
    await scrollThrough(page);
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });

  test('metadados, idioma e hierarquia de títulos', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/MOLDEA\.es/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /impressão 3D/);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText('Pequenas ideias.');
    await expect(page.locator('h1')).toContainText('Grandes possibilidades.');
    const h2s = await page.locator('main h2').allTextContents();
    expect(h2s).toEqual(
      expect.arrayContaining([
        'Descubra as nossas criações',
        'Um toque especial para os seus momentos.',
        'A sua ideia merece ganhar forma.',
        'Criamos ideias em 3D.',
        'Perguntas frequentes',
        'Vamos dar forma à sua ideia?',
      ]),
    );
  });

  test('canonical, Open Graph, robots.txt e sitemap usam https://m3d.trustec.com.br', async ({ page, request }) => {
    const site = 'https://m3d.trustec.com.br';
    await page.goto('/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${site}/`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${site}/`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${site}/og-image.jpg`);
    await page.goto('/produtos/conjunto-decorativo-natal/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${site}/produtos/conjunto-decorativo-natal/`,
    );

    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain(`Sitemap: ${site}/sitemap.xml`);
    expect(robots).toContain('Disallow: /admin');
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain(`<loc>${site}/</loc>`);
    expect(sitemap).toContain(`<loc>${site}/produtos/conjunto-decorativo-natal/</loc>`);
    expect(sitemap).toContain(`<loc>${site}/produtos/vaso-espiral/</loc>`);
    expect(sitemap).toContain(`<loc>${site}/produtos/</loc>`);
    expect(sitemap).toContain(`<loc>${site}/en/products/vaso-espiral/</loc>`);
    expect(sitemap).toContain(`<loc>${site}/es/</loc>`);
    expect(sitemap).not.toMatch(/localhost|\/admin/);
  });

  test('logo e fotografia do produto carregam com proporções corretas', async ({ page }) => {
    await page.goto('/');
    // Leva cada imagem visível (lazy) ao ecrã e espera que termine de carregar.
    // (As variantes da logo do outro tema estão ocultas.)
    for (const img of await page.locator('img:visible').all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 10_000 })
        .toBe(true);
    }
    const images = await page.locator('img:visible').evaluateAll((imgs) =>
      (imgs as HTMLImageElement[]).map((img) => ({
        src: img.currentSrc,
        alt: img.alt,
        complete: img.complete,
        natural: img.naturalWidth,
        ratioNatural: img.naturalWidth / img.naturalHeight,
        ratioRendered: img.getBoundingClientRect().width / img.getBoundingClientRect().height,
        fit: getComputedStyle(img).objectFit,
        ariaHidden: img.closest('[aria-hidden="true"]') !== null,
      })),
    );
    for (const img of images) {
      expect(img.complete && img.natural > 0, `imagem carregada: ${img.src}`).toBe(true);
      // Sem object-fit: cover, a imagem tem de manter a proporção original (sem distorção).
      if (img.fit !== 'cover') expect(Math.abs(img.ratioNatural - img.ratioRendered)).toBeLessThan(0.03);
      // Todas têm alt; as decorativas (nome ao lado ou no link) têm alt vazio.
      expect(img.alt, `alt em ${img.src}`).not.toBeNull();
    }
    await expect(page.locator('.site-header__logo')).toHaveAttribute('aria-label', /MOLDEA\.es/);
    await expect(page.locator('.featured__media img')).toHaveAttribute('alt', /.{10,}/);
    expect(images.some((i) => i.src.includes('conjunto-natal'))).toBe(true);
  });

  test('sem rolagem horizontal', async ({ page }) => {
    test.setTimeout(150_000); // 6 carregamentos de página; sob carga paralela pode demorar
    for (const width of [320, 375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `largura ${width}px`).toBeLessThanOrEqual(0);
    }
  });

  test('todos os links internos e âncoras apontam para destinos existentes', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page.locator('a[href]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
    for (const href of hrefs) {
      if (/^(mailto:|tel:|https?:)/.test(href)) continue;
      const url = new URL(href, page.url());
      if (url.hash) {
        const id = url.hash.slice(1);
        expect(await page.locator(`[id="${id}"]`).count(), `âncora ${href}`).toBe(1);
      }
      const res = await request.get(url.pathname + url.search);
      expect(res.status(), `link ${href}`).toBe(200);
    }
  });

  test('o primeiro Tab foca o link "Saltar para o conteúdo"', async ({ page, isMobile }) => {
    test.skip(isMobile, 'teclado físico');
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#conteudo$/);
  });

  test('seletor de idioma: PT, ES e EN levam à página equivalente', async ({ page, isMobile }) => {
    await page.goto('/produtos/conjunto-decorativo-natal/');
    if (isMobile) await page.locator('[data-menu-toggle]').click();
    await expect(page.locator('.lang a')).toHaveCount(2);
    await page.locator('.lang a', { hasText: 'EN' }).click();
    await expect(page).toHaveURL(/\/en\/products\/conjunto-decorativo-natal\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('link', { name: 'Request a quote' }).first()).toBeVisible();
    if (isMobile) await page.locator('[data-menu-toggle]').click();
    await page.locator('.lang a', { hasText: 'ES' }).click();
    await expect(page).toHaveURL(/\/es\/productos\/conjunto-decorativo-natal\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-ES');
    for (const path of ['/en/', '/es/', '/en/products/', '/es/productos/']) {
      expect((await page.request.get(path)).status(), path).toBe(200);
    }
  });

  test('página inicial em inglês e espanhol', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('h1')).toContainText('Small ideas.');
    await expect(page.locator('link[hreflang="es-ES"]')).toHaveAttribute('href', 'https://m3d.trustec.com.br/es/');
    await page.goto('/es/');
    await expect(page.locator('h1')).toContainText('Pequeñas ideas.');
  });
});

test.describe('Catálogo', () => {
  test('página inicial mostra no máximo 4 produtos e liga à página de produtos', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('#produtos [data-catalog-item]');
    expect(await items.count()).toBeGreaterThan(0);
    expect(await items.count()).toBeLessThanOrEqual(4);
    await expect(page.locator('[data-catalog-filters]')).toHaveCount(0);
    await page.getByRole('link', { name: 'Ver todos os produtos' }).click();
    await expect(page).toHaveURL(/\/produtos\/$/);
    await expect(page.locator('h1')).toHaveText('Todos os produtos');
    await expect(page.locator('.site-nav__link[aria-current="page"]')).toHaveText('Produtos');
  });

  test('filtra por categoria e mostra estado vazio quando aplicável', async ({ page }) => {
    await page.goto('/produtos/');
    const filters = page.locator('[data-catalog-filters]');
    await expect(filters).toBeVisible();
    const visibleCards = page.locator('[data-catalog-item]:visible');
    const total = await page.locator('[data-catalog-item]').count();
    await expect(visibleCards).toHaveCount(total);

    await filters.getByRole('button', { name: 'Casa e escritório' }).click();
    await expect(filters.getByRole('button', { name: 'Casa e escritório' })).toHaveAttribute('aria-pressed', 'true');
    // Só ficam visíveis produtos desta categoria (o teste do painel pode criar outros em paralelo).
    await expect(visibleCards.first()).toBeVisible();
    for (const cats of await visibleCards.evaluateAll((els) => els.map((e) => e.getAttribute('data-categories')))) {
      expect(cats).toContain('casa-escritorio');
    }
    expect(await visibleCards.count()).toBeLessThan(total);
    await expect(page.locator('[data-catalog-empty]')).toBeHidden();

    await filters.getByRole('button', { name: 'Decoração' }).click();
    await expect(page.locator('[data-catalog-item]:visible').first()).toContainText('Conjunto decorativo de Natal');

    await filters.getByRole('button', { name: 'Todos' }).click();
    await expect(visibleCards).toHaveCount(total);
  });

  test('"Ver detalhes" abre a página do produto', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-product-card]', { hasText: 'Conjunto decorativo de Natal' });
    await card.getByRole('link', { name: 'Ver detalhes' }).click();
    await expect(page).toHaveURL(/\/produtos\/conjunto-decorativo-natal\/$/);
    await expect(page.locator('h1')).toHaveText('Conjunto decorativo de Natal');
  });
});

test.describe('Página de produto', () => {
  test('mostra detalhes e liga ao orçamento com o produto pré-selecionado', async ({ page }) => {
    const problems = trackProblems(page);
    await page.goto('/produtos/conjunto-decorativo-natal/');
    await expect(page.locator('h1')).toHaveText('Conjunto decorativo de Natal');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await page.locator('.product__actions').getByRole('link', { name: 'Solicitar orçamento' }).click();
    await expect(page).toHaveURL(/produto=conjunto-decorativo-natal/);
    await expect(page.locator('#q-product')).toHaveValue('conjunto-decorativo-natal');
    await expect(page.locator('#q-type')).toHaveValue('catalogo');
    expect(problems).toEqual([]);
  });

  test('URL inexistente mostra a página 404', async ({ page }) => {
    const response = await page.goto('/produtos/nao-existe/');
    expect(response?.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Página não encontrada');
  });
});

test.describe('Menu móvel', () => {
  test('abre, fecha com Escape e fecha ao navegar', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'apenas em ecrãs pequenos');
    await page.goto('/');
    const toggle = page.locator('[data-menu-toggle]');
    const nav = page.locator('#site-nav');
    await expect(toggle).toBeVisible();
    await expect(nav).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav).toBeHidden();

    await toggle.click();
    await nav.getByRole('link', { name: 'Personalização' }).click();
    await expect(nav).toBeHidden();
    await expect(page).toHaveURL(/#personalizacao$/);
    await expect(page.locator('#personalizacao')).toBeInViewport();
  });
});
