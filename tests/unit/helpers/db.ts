// Base de dados temporária (ficheiro SQLite novo por teste) com as migrações reais.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createDatabase, setDbForTests, type Database } from '../../../src/server/db/client';

export async function useTestDatabase(): Promise<{ db: Database; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'moldea-test-'));
  const { db, client } = createDatabase(`file:${join(dir, 'test.db').replace(/\\/g, '/')}`);
  await migrate(db, { migrationsFolder: 'drizzle' });
  setDbForTests(db);
  return {
    db,
    cleanup: () => {
      setDbForTests(undefined);
      client.close();
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      } catch {
        // Windows: o ficheiro SQLite pode continuar bloqueado por instantes; é uma pasta temporária.
      }
    },
  };
}
