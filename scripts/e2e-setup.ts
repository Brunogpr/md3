// Prepara uma base de dados limpa para os testes no navegador (DATABASE_URL=file:data/e2e.db).
// Cria: produto "sob consulta" (semente), produto à venda, administrador de teste e loja ativa.
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdirSync, rmSync } from 'node:fs';
import { hashPassword } from '../src/server/password.ts';

import { E2E_ADMIN } from '../tests/e2e/fixtures.ts';

const url = process.env.DATABASE_URL ?? 'file:data/e2e.db';
if (!url.includes('e2e')) throw new Error('Por segurança, este script só corre numa base de dados com "e2e" no nome.');
mkdirSync('data', { recursive: true });
for (const suffix of ['', '-wal', '-shm']) rmSync(url.replace('file:', '') + suffix, { force: true });

const client = createClient({ url });
await migrate(drizzle(client), { migrationsFolder: 'drizzle' });

const insertProduct = async (args: (string | number | null)[]) =>
  (
    await client.execute({
      sql: `INSERT INTO products (slug, name_pt, short_pt, description_pt, categories, price_cents, stock, featured, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args,
    })
  ).rows[0].id;

const natal = await insertProduct([
  'conjunto-decorativo-natal',
  'Conjunto decorativo de Natal',
  'Árvore, rena e figura com gorro de Natal reunidas numa base redonda.',
  'Composição decorativa de Natal.',
  JSON.stringify(['decoracao', 'presentes']),
  null,
  null,
  1,
  0,
]);
const vaso = await insertProduct([
  'vaso-espiral',
  'Vaso Espiral',
  'Vaso decorativo com linhas em espiral.',
  'Vaso de teste para os testes automáticos.',
  JSON.stringify(['casa-escritorio']),
  2490,
  3,
  1,
  1,
]);
for (const [id, alt] of [
  [natal, 'Conjunto decorativo de Natal'],
  [vaso, 'Vaso Espiral'],
] as const) {
  await client.execute({
    sql: 'INSERT INTO product_images (product_id, url, thumb_url, width, height, alt_pt) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, '/seed/conjunto-natal.webp', '/seed/conjunto-natal.webp', 1200, 1800, alt],
  });
}
await client.execute({
  sql: 'INSERT INTO admins (email, password_hash) VALUES (?, ?)',
  args: [E2E_ADMIN.email, await hashPassword(E2E_ADMIN.password)],
});
await client.execute({
  sql: 'INSERT INTO settings (key, value) VALUES (?, ?)',
  args: [
    'store',
    JSON.stringify({
      storeEnabled: true,
      shippingCents: 495,
      freeShippingFromCents: 6000,
      shippingCountries: ['ES', 'PT'],
      // Externos: as páginas legais reais ainda não existem neste projeto.
      legal: {
        legalNoticeUrl: 'https://example.com/aviso-legal',
        privacyUrl: 'https://example.com/privacidade',
        termsUrl: 'https://example.com/condicoes',
        cookiesUrl: '',
      },
    }),
  ],
});
client.close();
console.log('Base de dados de testes pronta.');
