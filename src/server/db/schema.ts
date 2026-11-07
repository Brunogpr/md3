// Esquema da base de dados (SQLite/libSQL — ficheiro local em desenvolvimento, Turso em produção).
// Depois de alterar este ficheiro: `npm run db:generate` (cria a migração) e `npm run db:migrate`.
import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
};

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    namePt: text('name_pt').notNull(),
    nameEs: text('name_es').notNull().default(''),
    nameEn: text('name_en').notNull().default(''),
    shortPt: text('short_pt').notNull().default(''),
    shortEs: text('short_es').notNull().default(''),
    shortEn: text('short_en').notNull().default(''),
    descriptionPt: text('description_pt').notNull().default(''),
    descriptionEs: text('description_es').notNull().default(''),
    descriptionEn: text('description_en').notNull().default(''),
    /** Lista JSON de ids de src/data/categories.ts. */
    categories: text('categories', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    /** Preço com IVA, em cêntimos. null = "preço sob consulta" (sem compra online). */
    priceCents: integer('price_cents'),
    /** null = stock não controlado. */
    stock: integer('stock'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** Mostrado na página inicial (máximo 4, escolhidos no painel). */
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('products_slug_unique').on(t.slug)],
);

export const productImages = sqliteTable(
  'product_images',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    thumbUrl: text('thumb_url').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    altPt: text('alt_pt').notNull().default(''),
    altEs: text('alt_es').notNull().default(''),
    altEn: text('alt_en').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('product_images_product_idx').on(t.productId)],
);

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'expired' | 'failed' | 'canceled';

export interface OrderItem {
  productId: number;
  slug: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export interface ShippingAddress {
  line1?: string | null;
  line2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    status: text('status').$type<OrderStatus>().notNull().default('pending'),
    stripeSessionId: text('stripe_session_id'),
    stripePaymentIntent: text('stripe_payment_intent'),
    email: text('email'),
    customerName: text('customer_name'),
    phone: text('phone'),
    shippingAddress: text('shipping_address', { mode: 'json' }).$type<ShippingAddress | null>(),
    items: text('items', { mode: 'json' }).$type<OrderItem[]>().notNull(),
    subtotalCents: integer('subtotal_cents').notNull(),
    shippingCents: integer('shipping_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull(),
    currency: text('currency').notNull().default('eur'),
    locale: text('locale').notNull().default('pt'),
    /** Já descontou stock? Evita descontar duas vezes se o webhook repetir. */
    stockApplied: integer('stock_applied', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes').notNull().default(''),
    paidAt: integer('paid_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (t) => [uniqueIndex('orders_session_unique').on(t.stripeSessionId), index('orders_status_idx').on(t.status)],
);

export const admins = sqliteTable(
  'admins',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [uniqueIndex('admins_email_unique').on(t.email)],
);

export const sessions = sqliteTable('sessions', {
  /** SHA-256 do token do cookie (o token em claro nunca é guardado). */
  id: text('id').primaryKey(),
  adminId: integer('admin_id')
    .notNull()
    .references(() => admins.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: integer('window_start', { mode: 'timestamp' }).notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});

export const productsRelations = relations(products, ({ many }) => ({
  images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));
