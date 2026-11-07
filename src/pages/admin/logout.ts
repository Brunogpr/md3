import type { APIRoute } from 'astro';
import { destroySession } from '../../server/auth';

export const prerender = false;

// Só por POST (formulário no painel), para que um link externo não termine a sessão.
export const POST: APIRoute = async ({ cookies, redirect }) => {
  await destroySession(cookies);
  return redirect('/admin/login', 303);
};
