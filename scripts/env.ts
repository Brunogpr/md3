// Lê DATABASE_URL/DATABASE_AUTH_TOKEN do ambiente ou do ficheiro .env (para os scripts de linha de comandos).
import { existsSync, readFileSync } from 'node:fs';

export function loadEnv(): { url: string; authToken?: string } {
  if (existsSync('.env')) {
    for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
  return {
    url: process.env.DATABASE_URL || 'file:data/moldea.db',
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  };
}
