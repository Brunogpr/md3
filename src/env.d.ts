interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
}

/** Onde o build corre: 'netlify' (publicado) ou 'local' (desenvolvimento e testes). Ver astro.config.mjs. */
declare const __DEPLOY_TARGET__: 'netlify' | 'local';

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    admin?: import('./server/auth').AdminUser;
  }
}
