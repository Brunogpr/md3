// @ts-check
import { defineConfig, envField } from 'astro/config';
import { loadEnv } from 'vite';
import netlify from '@astrojs/netlify';
import node from '@astrojs/node';

const { PUBLIC_SITE_URL } = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

// A URL pública define canonical, Open Graph e sitemap.
const site = PUBLIC_SITE_URL ? PUBLIC_SITE_URL.replace(/\/$/, '') : undefined;

// Na Netlify (variável NETLIFY definida pelo próprio build) usa o adaptador da Netlify;
// localmente e nos testes usa o servidor Node, que suporta `astro preview`.
const deployTarget = process.env.NETLIFY ? 'netlify' : 'local';
const adapter = deployTarget === 'netlify' ? netlify() : node({ mode: 'standalone' });

export default defineConfig({
  site,
  adapter,
  trailingSlash: 'ignore',
  // Formulários do painel: o Astro rejeita POSTs vindos de outra origem (proteção CSRF).
  security: { checkOrigin: true },
  // Variáveis do servidor: segredos lidos em tempo de execução, nunca enviados ao navegador.
  env: {
    schema: {
      DATABASE_URL: envField.string({ context: 'server', access: 'secret', default: 'file:data/moldea.db' }),
      DATABASE_AUTH_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      STRIPE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      STRIPE_WEBHOOK_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Só para testes automáticos: simula o Stripe. Recusado quando publicado na Netlify.
      PAYMENTS_FAKE: envField.boolean({ context: 'server', access: 'secret', default: false }),
    },
  },
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
  vite: {
    // Onde o build vai correr ('netlify' ou 'local'): escolhe o armazenamento das fotos e ativa as
    // proteções de produção (sem base de dados em ficheiro, sem pagamentos simulados).
    define: { __DEPLOY_TARGET__: JSON.stringify(deployTarget) },
    ssr: { external: ['sharp'] },
  },
});
