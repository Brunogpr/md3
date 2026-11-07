// Aplica as migrações de /drizzle à base de dados de DATABASE_URL.
// Uso: npm run db:migrate   (na Netlify corre antes do build, ver netlify.toml)
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdirSync } from 'node:fs';
import { loadEnv } from './env.ts';

const { url, authToken } = loadEnv();
if (url.startsWith('file:')) mkdirSync('data', { recursive: true });

const client = createClient({ url, authToken });
await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
client.close();
console.log(`Migrações aplicadas em ${url.replace(/\/\/.*@/, '//***@')}`);
