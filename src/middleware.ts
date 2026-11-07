import { defineMiddleware } from 'astro:middleware';
import { getSessionAdmin } from './server/auth';

const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/');
const PUBLIC_ADMIN = new Set(['/admin/login', '/admin/login/']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  let response: Response;

  if (isAdminPath(pathname) && !context.isPrerendered) {
    const admin = await getSessionAdmin(context.cookies);
    context.locals.admin = admin ?? undefined;
    response =
      !admin && !PUBLIC_ADMIN.has(pathname)
        ? context.redirect(`/admin/login?next=${encodeURIComponent(pathname)}`, 303)
        : await next();
  } else {
    response = await next();
  }

  // Cabeçalhos de segurança básicos (o site não usa iframes nem scripts de terceiros).
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  if (isAdminPath(pathname)) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
});
