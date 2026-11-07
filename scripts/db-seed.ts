// Cria o primeiro produto (conjunto de Natal, sem preço: "sob consulta") se a tabela estiver vazia.
// Uso: npm run db:seed
import { createClient } from '@libsql/client';
import { loadEnv } from './env.ts';

const { url, authToken } = loadEnv();
const client = createClient({ url, authToken });

const { rows } = await client.execute('SELECT COUNT(*) AS n FROM products');
if (Number(rows[0].n) > 0) {
  console.log('Já existem produtos — nada a fazer.');
} else {
  const product = await client.execute({
    sql: `INSERT INTO products (slug, name_pt, name_es, name_en, short_pt, short_es, short_en, description_pt, description_es, description_en, categories, featured)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) RETURNING id`,
    args: [
      'conjunto-decorativo-natal',
      'Conjunto decorativo de Natal',
      'Conjunto decorativo navideño',
      'Christmas decoration set',
      'Árvore, rena e figura com gorro de Natal reunidas numa base redonda.',
      'Árbol, reno y figura con gorro navideño reunidos sobre una base redonda.',
      'Tree, reindeer and a figure in a Santa hat, together on a round base.',
      'Composição decorativa de Natal com uma árvore verde de linhas espirais e estrela dourada, uma rena e uma figura branca com gorro vermelho, reunidas numa base redonda canelada. Uma proposta para dar um toque acolhedor a mesas, prateleiras e outros cantos da casa durante a época festiva.',
      'Composición decorativa navideña con un árbol verde de líneas en espiral y estrella dorada, un reno y una figura blanca con gorro rojo, reunidos sobre una base redonda acanalada. Una propuesta para dar un toque acogedor a mesas, estanterías y otros rincones de casa durante las fiestas.',
      'A Christmas decorative composition with a green spiral tree topped with a golden star, a reindeer and a white figure wearing a red hat, together on a round fluted base. A way to add a cosy touch to tables, shelves and other corners of the home during the festive season.',
      JSON.stringify(['decoracao', 'presentes']),
    ],
  });
  await client.execute({
    sql: `INSERT INTO product_images (product_id, url, thumb_url, width, height, alt_pt, alt_es, alt_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      product.rows[0].id,
      '/seed/conjunto-natal.webp',
      '/seed/conjunto-natal.webp',
      1200,
      1800,
      'Conjunto decorativo de Natal: árvore verde em espiral com estrela dourada, rena castanha e figura branca com gorro vermelho sobre uma base redonda, num ambiente natalício iluminado.',
      'Conjunto decorativo navideño: árbol verde en espiral con estrella dorada, reno marrón y figura blanca con gorro rojo sobre una base redonda, en un ambiente navideño iluminado.',
      'Christmas decoration set: green spiral tree with a golden star, brown reindeer and white figure in a red hat on a round base, in a softly lit Christmas setting.',
    ],
  });
  console.log('Produto inicial criado.');
}
client.close();
