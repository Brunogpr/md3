import { test, type Page } from '@playwright/test';

// Gera capturas para inspeção visual manual em screenshots/ (não compara pixels).
// Em mobile captura ecrã a ecrã: o modo fullPage do Chromium emulado duplica secções.
test.use({ reducedMotion: 'reduce' });

const pages = [
  { name: 'home', path: '/' },
  { name: 'produto', path: '/produtos/conjunto-decorativo-natal/' },
  { name: '404', path: '/nao-existe/' },
];

async function loadAllImages(page: Page) {
  for (const img of await page.locator('img:visible').all()) {
    await img.scrollIntoViewIfNeeded();
    await img.evaluate((i: HTMLImageElement) => i.decode().catch(() => undefined));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForLoadState('networkidle');
}

async function captureByScreens(page: Page, prefix: string) {
  const { height, viewport } = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
  }));
  for (let i = 0, y = 0; y < height; i++, y += viewport) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(80);
    await page.screenshot({ path: `${prefix}-${String(i).padStart(2, '0')}.png` });
  }
}

for (const { name, path } of pages) {
  test(`captura: ${name}`, async ({ page, isMobile }, testInfo) => {
    await page.goto(path);
    await loadAllImages(page);
    const prefix = `screenshots/${testInfo.project.name}-${name}`;
    if (isMobile) await captureByScreens(page, prefix);
    else await page.screenshot({ path: `${prefix}.png`, fullPage: true });
  });
}

test('captura: menu móvel aberto e ecrã de 320px', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.goto('/');
  await page.locator('[data-menu-toggle]').click();
  await page.screenshot({ path: 'screenshots/mobile-menu.png' });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await loadAllImages(page);
  await captureByScreens(page, 'screenshots/w320-home');
});

test('captura: formulário com erros', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await page.goto('/#orcamento');
  await page.locator('[data-submit]').click();
  await page.locator('#orcamento').screenshot({ path: 'screenshots/form-errors.png' });
});
