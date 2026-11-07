// Carrinho no navegador (preferência deste visitante, guardada em localStorage).
// No pagamento só se enviam ids e quantidades; preços e stock são revalidados no servidor.
import { interpolate } from '../i18n/interpolate';
import { formatPrice, MAX_QTY_PER_ITEM, shippingFor, type CartProblem } from '../lib/cart';

interface StoredLine {
  productId: number;
  slug: string;
  name: string;
  priceCents: number;
  stock: number | null;
  image: string | null;
  href: string;
  quantity: number;
}

interface Config {
  locale: string;
  intl: string;
  shippingCents: number;
  freeShippingFromCents: number | null;
  labels: {
    remove: string;
    increase: string;
    decrease: string;
    quantity: string;
    freeShipping: string;
    added: string;
    itemsCount: string;
    itemsCountOne: string;
    checkout: string;
    checkingOut: string;
    errors: { storeClosed: string; changed: string; generic: string };
  };
}

const KEY = 'moldea-cart-v1';
const dialog = document.querySelector<HTMLDialogElement>('[data-cart]');

export function readCart(): StoredLine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((l) => Number.isInteger(l?.productId) && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

function writeCart(lines: StoredLine[]) {
  try {
    // Carrinho vazio não deixa nada guardado no navegador.
    if (lines.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Sem armazenamento: o carrinho dura só enquanto a página estiver aberta.
  }
}

if (dialog) {
  const config: Config = JSON.parse(dialog.querySelector('[data-cart-config]')?.textContent ?? '{}');
  const L = config.labels;
  const fmt = (cents: number) => formatPrice(cents, config.intl);
  let lines = readCart();

  const $ = <T extends HTMLElement>(sel: string) => dialog.querySelector<T>(sel)!;
  const list = $('[data-cart-lines]');
  const empty = $('[data-cart-empty]');
  const footer = $('[data-cart-footer]');
  const error = $('[data-cart-error]');
  const checkoutBtn = $<HTMLButtonElement>('[data-cart-checkout]');
  const checkoutLabel = $('[data-cart-checkout-label]');
  const summary = $('[data-cart-summary]');
  const badge = document.querySelector<HTMLElement>('[data-cart-count]');
  const announce = document.querySelector<HTMLElement>('[data-cart-announce]');

  const maxFor = (l: StoredLine) => Math.min(MAX_QTY_PER_ITEM, l.stock ?? MAX_QTY_PER_ITEM);
  const count = () => lines.reduce((n, l) => n + l.quantity, 0);
  const countLabel = (n: number) => (n === 1 ? L.itemsCountOne : interpolate(L.itemsCount, { count: n }));

  const iconButton = (label: string, symbol: string, onClick: () => void, disabled = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.textContent = symbol;
    b.disabled = disabled;
    b.addEventListener('click', onClick);
    return b;
  };

  const render = () => {
    writeCart(lines);
    const n = count();
    if (badge) {
      badge.hidden = n === 0;
      badge.textContent = String(n);
    }
    summary.textContent = n ? countLabel(n) : '';
    empty.hidden = n > 0;
    footer.hidden = n === 0;

    list.replaceChildren(
      ...lines.map((line) => {
        const li = document.createElement('li');
        const img = document.createElement('img');
        img.src = line.image ?? '/icon-512.png';
        img.alt = '';
        img.width = 72;
        img.height = 72;
        img.loading = 'lazy';

        const info = document.createElement('div');
        const name = document.createElement('a');
        name.className = 'cart-line__name';
        name.href = line.href;
        name.textContent = line.name;
        const price = document.createElement('div');
        price.className = 'cart-line__price';
        price.textContent = fmt(line.priceCents);
        const qty = document.createElement('div');
        qty.className = 'qty';
        qty.setAttribute('role', 'group');
        qty.setAttribute('aria-label', `${L.quantity}: ${line.name}`);
        const out = document.createElement('output');
        out.textContent = String(line.quantity);
        qty.append(
          iconButton(L.decrease, '−', () => setQty(line.productId, line.quantity - 1), line.quantity <= 1),
          out,
          iconButton(L.increase, '+', () => setQty(line.productId, line.quantity + 1), line.quantity >= maxFor(line)),
        );
        info.append(name, price, qty);

        const end = document.createElement('div');
        end.className = 'cart-line__end';
        const total = document.createElement('span');
        total.textContent = fmt(line.priceCents * line.quantity);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'cart-line__remove';
        remove.textContent = L.remove;
        remove.setAttribute('aria-label', `${L.remove}: ${line.name}`);
        remove.addEventListener('click', () => setQty(line.productId, 0));
        end.append(total, remove);

        li.append(img, info, end);
        return li;
      }),
    );

    const subtotal = lines.reduce((s, l) => s + l.priceCents * l.quantity, 0);
    const shipping = shippingFor(subtotal, config);
    $('[data-cart-subtotal]').textContent = fmt(subtotal);
    $('[data-cart-shipping]').textContent = shipping === 0 ? L.freeShipping : fmt(shipping);
    $('[data-cart-total]').textContent = fmt(subtotal + shipping);
  };

  const setQty = (productId: number, quantity: number) => {
    lines = lines
      .map((l) => (l.productId === productId ? { ...l, quantity: Math.min(quantity, maxFor(l)) } : l))
      .filter((l) => l.quantity > 0);
    error.hidden = true;
    render();
  };

  const open = () => {
    if (!dialog.open) dialog.showModal();
  };

  // Adicionar ao carrinho (botões em cartões e páginas de produto).
  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-add-to-cart]');
    if (!button) return;
    const item = JSON.parse(button.dataset.addToCart ?? '{}') as Omit<StoredLine, 'quantity'>;
    const existing = lines.find((l) => l.productId === item.productId);
    if (existing) {
      // Atualiza nome/preço/stock mostrados com os dados mais recentes da página.
      Object.assign(existing, item, { quantity: Math.min(existing.quantity + 1, maxFor({ ...existing, ...item })) });
    } else {
      lines.push({ ...item, quantity: 1 });
    }
    render();
    badge?.classList.remove('is-bumping');
    void badge?.offsetWidth;
    badge?.classList.add('is-bumping');
    if (announce) announce.textContent = interpolate(L.added, { product: item.name });
    open();
  });

  document.querySelectorAll('[data-cart-open]').forEach((el) => el.addEventListener('click', open));
  dialog.querySelectorAll('[data-cart-close]').forEach((el) => el.addEventListener('click', () => dialog.close()));
  // Clique fora do painel fecha.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  // Atualiza o carrinho se for alterado noutro separador.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      lines = readCart();
      render();
    }
  });

  const applyProblems = (problems: CartProblem[]) => {
    for (const p of problems) {
      if (p.code === 'unavailable' || p.code === 'no-price') lines = lines.filter((l) => l.productId !== p.productId);
      if (p.code === 'insufficient-stock') {
        lines = lines
          .map((l) => (l.productId === p.productId ? { ...l, stock: p.available, quantity: Math.min(l.quantity, p.available) } : l))
          .filter((l) => l.quantity > 0);
      }
    }
  };

  let busy = false;
  checkoutBtn.addEventListener('click', async () => {
    if (busy || lines.length === 0) return;
    busy = true;
    checkoutBtn.disabled = true;
    checkoutLabel.textContent = L.checkingOut;
    error.hidden = true;
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: config.locale, items: lines.map(({ productId, quantity }) => ({ productId, quantity })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return; // mantém o botão bloqueado enquanto sai para a Stripe
      }
      if (res.status === 409 && Array.isArray(data.problems)) {
        applyProblems(data.problems);
        render();
        error.textContent = L.errors.changed;
      } else {
        error.textContent = res.status === 503 ? L.errors.storeClosed : L.errors.generic;
      }
    } catch {
      error.textContent = L.errors.generic;
    }
    error.hidden = false;
    busy = false;
    checkoutBtn.disabled = false;
    checkoutLabel.textContent = L.checkout;
  });

  // Ex.: link "Ver carrinho" da página de pagamento cancelado.
  if (window.location.hash === '#carrinho') open();

  render();
}
