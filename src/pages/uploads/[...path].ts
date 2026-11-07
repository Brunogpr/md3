// Serve as fotografias dos produtos (Netlify Blobs quando publicado; pasta local em desenvolvimento).
import type { APIRoute } from 'astro';
import { readUpload } from '../../server/storage';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const file = params.path ? await readUpload(params.path) : null;
  if (!file) return new Response('Não encontrado', { status: 404 });
  return new Response(file, {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
