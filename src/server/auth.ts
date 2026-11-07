// Sessões do painel. O cookie guarda um token aleatório; a base de dados guarda só o seu SHA-256.
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { AstroCookies } from 'astro';
import { getDb } from './db/client';
import { admins, loginAttempts, sessions } from './db/schema';
import { verifyPassword } from './password';

export const SESSION_COOKIE = 'moldea_admin';
const SESSION_DAYS = 7;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export interface AdminUser {
  id: number;
  email: string;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export async function createSession(adminId: number, cookies: AstroCookies, secure: boolean): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await getDb().insert(sessions).values({ id: sha256(token), adminId, expiresAt });
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function getSessionAdmin(cookies: AstroCookies): Promise<AdminUser | null> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({ id: admins.id, email: admins.email })
    .from(sessions)
    .innerJoin(admins, eq(admins.id, sessions.adminId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function destroySession(cookies: AstroCookies): Promise<void> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.id, sha256(token)));
  cookies.delete(SESSION_COOKIE, { path: '/' });
  // Limpeza oportunista de sessões expiradas.
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export type LoginResult = { ok: true; admin: AdminUser } | { ok: false; reason: 'invalid' | 'locked' };

/**
 * Verifica credenciais com limite de tentativas por e-mail (5 falhas em 15 minutos bloqueiam).
 * A mensagem para o utilizador é sempre a mesma, exista ou não o e-mail.
 */
export async function attemptLogin(emailRaw: string, password: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const key = `email:${email}`;
  const now = Date.now();
  const db = getDb();
  const attempt = await db.query.loginAttempts.findFirst({ where: eq(loginAttempts.key, key) });
  const inWindow = attempt && now - attempt.windowStart.getTime() < ATTEMPT_WINDOW_MS;
  if (inWindow && attempt.count >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' };

  const admin = await db.query.admins.findFirst({ where: eq(admins.email, email) });
  // Mesmo trabalho criptográfico quando o e-mail não existe, para não revelar quais existem.
  const valid = await verifyPassword(
    password,
    admin?.passwordHash ?? 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  );
  if (admin && valid) {
    await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
    return { ok: true, admin: { id: admin.id, email: admin.email } };
  }
  await db
    .insert(loginAttempts)
    .values({ key, count: 1, windowStart: new Date(now) })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: inWindow ? { count: (attempt?.count ?? 0) + 1 } : { count: 1, windowStart: new Date(now) },
    });
  return { ok: false, reason: 'invalid' };
}
