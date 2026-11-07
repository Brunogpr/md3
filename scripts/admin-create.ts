// Cria (ou redefine a palavra-passe de) um utilizador do painel /admin.
// Uso: npm run admin:create -- email@dominio.com "palavra-passe-com-10-ou-mais-caracteres"
import { createClient } from '@libsql/client';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../src/server/password.ts';
import { loadEnv } from './env.ts';

const [email, password] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
  console.error('Uso: npm run admin:create -- email@dominio.com "palavra-passe"');
  process.exit(1);
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`A palavra-passe tem de ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  process.exit(1);
}

const { url, authToken } = loadEnv();
const client = createClient({ url, authToken });
const hash = await hashPassword(password);
await client.execute({
  sql: `INSERT INTO admins (email, password_hash) VALUES (?, ?)
        ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash`,
  args: [email.toLowerCase(), hash],
});
// Termina sessões antigas deste utilizador (ex.: depois de trocar a palavra-passe).
await client.execute({
  sql: 'DELETE FROM sessions WHERE admin_id = (SELECT id FROM admins WHERE email = ?)',
  args: [email.toLowerCase()],
});
client.close();
console.log(`Utilizador de administração pronto: ${email.toLowerCase()}`);
