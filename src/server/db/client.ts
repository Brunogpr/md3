import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { DATABASE_AUTH_TOKEN, DATABASE_URL } from 'astro:env/server';
import * as schema from './schema';

export type Database = LibSQLDatabase<typeof schema>;

/** Liga à base de dados indicada (ficheiro local, memória ou Turso). */
export function createDatabase(url: string, authToken?: string): { db: Database; client: Client } {
  const client = createClient({ url, authToken: authToken || undefined });
  return { db: drizzle(client, { schema }), client };
}

let instance: Database | undefined;

/**
 * Base de dados da aplicação. DATABASE_URL: `file:data/moldea.db` (local) ou `libsql://…turso.io`
 * com DATABASE_AUTH_TOKEN (produção).
 */
export function getDb(): Database {
  if (!instance) {
    if (__DEPLOY_TARGET__ === 'netlify' && DATABASE_URL.startsWith('file:')) {
      throw new Error('DATABASE_URL tem de apontar para a base de dados Turso em produção.');
    }
    instance = createDatabase(DATABASE_URL, DATABASE_AUTH_TOKEN).db;
  }
  return instance;
}

/** Só para testes: substitui a base de dados usada pela aplicação. */
export function setDbForTests(db: Database | undefined): void {
  instance = db;
}
