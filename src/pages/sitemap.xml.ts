// Sitemap dinâmico: página inicial e produtos ativos de cada idioma publicado.
import type { APIRoute } from 'astro';
import { homePath, productPath, productsPath, publishedLocales } from '../i18n';
import { listPublicProducts } from '../server/products';

export const prerender = false;

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export const GET: APIRoute = async ({ site, url }) => {
  const base = site ?? url;
  const paths: string[] = [];
  for (const locale of publishedLocales) {
    paths.push(homePath(locale), productsPath(locale));
    for (const p of await listPublicProducts(locale)) paths.push(productPath(locale, p.slug));
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((p) => `  <url><loc>${escape(new URL(p, base).href)}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
};
