import { defineConfig, devices } from '@playwright/test';

// Usa o Microsoft Edge instalado no sistema (evita o download de navegadores do Playwright).
// Noutros ambientes: PW_CHANNEL=chrome npm run test:e2e
const channel = process.env.PW_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4321',
    channel,
    // Testes funcionais sem animações (o ecrã de carregamento e as entradas ficam desligados).
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel } },
  ],
  webServer: {
    // Base de dados própria (data/e2e.db, recriada a cada execução), pagamentos simulados e
    // build em dist-e2e/ (nunca em dist/).
    command: 'node scripts/e2e-setup.ts && npx astro build --outDir dist-e2e && npx astro preview --outDir dist-e2e --port 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: false,
    timeout: 240_000,
    env: { DATABASE_URL: 'file:data/e2e.db', PAYMENTS_FAKE: 'true' },
  },
});
