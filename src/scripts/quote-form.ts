import { interpolate } from '../i18n/interpolate';
import {
  hasErrors,
  normalizeQuote,
  validateQuote,
  type QuoteErrors,
  type QuoteField,
  type QuoteFormData,
} from '../lib/quote-validation';
import {
  buildQuoteMessage,
  buildWhatsAppUrl,
  messageFingerprint,
  openWhatsApp,
  type QuoteMessageData,
  type QuoteMessageLabels,
} from '../lib/quote-service';

interface ClientData {
  locale: string;
  whatsappNumber: string | null;
  errors: Record<string, string>;
  status: Record<'opened' | 'blocked' | 'continueLink' | 'duplicate' | 'unavailable' | 'invalid', string>;
  submit: string;
  submitting: string;
  messageLabels: QuoteMessageLabels;
  requestTypes: Record<string, string>;
  contactPreferences: Record<string, string>;
  productNone: string;
  productNames: Record<string, string>;
  productPaths: Record<string, string>;
}

/** Tempo durante o qual novos cliques são ignorados depois de abrir o WhatsApp. */
const SUBMIT_LOCK_MS = 1500;

const form = document.querySelector<HTMLFormElement>('[data-quote-form]');

if (form) {
  const data: ClientData = JSON.parse(form.querySelector('[data-quote-i18n]')?.textContent ?? '{}');
  const statusBox = form.querySelector<HTMLElement>('[data-status]')!;
  const submitButton = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const submitLabel = form.querySelector<HTMLElement>('[data-submit-label]')!;
  const counter = form.querySelector<HTMLElement>('[data-counter]');
  const description = form.elements.namedItem('description') as HTMLTextAreaElement;
  const productSelect = form.elements.namedItem('product') as HTMLSelectElement;
  const typeSelect = form.elements.namedItem('requestType') as HTMLSelectElement;

  const fieldIds: Record<QuoteField, string> = {
    name: 'q-name',
    email: 'q-email',
    phone: 'q-phone',
    product: 'q-product',
    requestType: 'q-type',
    description: 'q-description',
    contactPreference: 'q-contactPreference',
    consent: 'q-consent',
  };

  let submitting = false;
  let attempted = false;
  // Só em memória (nunca guardado no navegador): evita abrir a mesma conversa duas vezes.
  let lastOpened: { fingerprint: string; url: string } | null = null;

  const read = (): QuoteFormData => {
    const fd = new FormData(form);
    const get = (key: string) => String(fd.get(key) ?? '');
    return {
      name: get('name'),
      email: get('email'),
      phone: get('phone'),
      product: get('product'),
      requestType: get('requestType'),
      description: get('description'),
      contactPreference: get('contactPreference'),
      consent: fd.get('consent') === 'on',
      website: get('website'),
    };
  };

  const showErrors = (errors: QuoteErrors, only?: QuoteField) => {
    for (const field of Object.keys(fieldIds) as QuoteField[]) {
      if (only && field !== only) continue;
      const id = fieldIds[field];
      const errorEl = document.getElementById(`${id}-error`);
      const control =
        field === 'contactPreference'
          ? form.querySelector<HTMLElement>('fieldset.field--choices')
          : document.getElementById(id);
      const error = errors[field];
      if (errorEl) {
        errorEl.hidden = !error;
        errorEl.textContent = error ? interpolate(data.errors[error.code] ?? '', error.params ?? {}) : '';
      }
      if (control) {
        if (error) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
      }
    }
  };

  const whatsappButton = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'btn btn--dark btn--small';
    link.textContent = data.status.continueLink;
    link.dataset.whatsappContinue = '';
    return link;
  };

  const setStatus = (tone: 'info' | 'error' | 'warning' | null, message = '', extra?: HTMLElement) => {
    statusBox.hidden = tone === null;
    statusBox.dataset.tone = tone ?? '';
    statusBox.replaceChildren();
    if (!tone) return;
    const text = document.createElement('p');
    text.textContent = message;
    statusBox.append(text);
    if (extra) statusBox.append(extra);
  };

  const setSubmitting = (value: boolean) => {
    submitting = value;
    submitButton.disabled = value;
    submitButton.setAttribute('aria-busy', String(value));
    submitLabel.textContent = value ? data.submitting : data.submit;
  };

  const productLabel = (slug: string) =>
    slug === 'nenhum' ? data.productNone : (data.productNames[slug] ?? slug);

  const buildMessageData = (values: QuoteFormData): QuoteMessageData => {
    const path = data.productPaths[values.product];
    return {
      name: values.name,
      email: values.email,
      phone: values.phone,
      productName: productLabel(values.product),
      requestTypeLabel: data.requestTypes[values.requestType] ?? values.requestType,
      contactPreferenceLabel: data.contactPreferences[values.contactPreference] ?? '',
      description: values.description,
      link: path ? new URL(path, window.location.origin).href : '',
    };
  };

  const updateCounter = () => {
    if (counter) counter.textContent = `${description.value.length}/${description.maxLength}`;
  };

  // Validação em tempo real só depois da primeira tentativa (ou ao sair de um campo preenchido).
  form.addEventListener('focusout', (event) => {
    const target = event.target as HTMLInputElement;
    const field = target.name as QuoteField;
    if (!(field in fieldIds) || (!attempted && !target.value)) return;
    showErrors(validateQuote(read()), field);
  });

  form.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (target === description) updateCounter();
    if (attempted) {
      const errors = validateQuote(read());
      showErrors(errors, target.name as QuoteField);
      // O telefone depende da preferência de contacto.
      if (target.name === 'contactPreference') showErrors(errors, 'phone');
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submitting) return; // proteção contra cliques repetidos

    const values = normalizeQuote(read());
    if (values.website) return; // robô: ignorado silenciosamente

    attempted = true;
    const errors = validateQuote(values);
    showErrors(errors);
    if (hasErrors(errors)) {
      setStatus('error', data.status.invalid);
      const first = (Object.keys(fieldIds) as QuoteField[]).find((f) => errors[f]);
      if (first) {
        const target =
          first === 'contactPreference'
            ? form.querySelector<HTMLInputElement>('input[name="contactPreference"]')
            : document.getElementById(fieldIds[first]);
        target?.focus();
      }
      return;
    }

    if (!data.whatsappNumber) {
      setStatus('error', data.status.unavailable);
      return;
    }

    const messageData = buildMessageData(values);
    const fingerprint = messageFingerprint(messageData);
    if (lastOpened?.fingerprint === fingerprint) {
      setStatus('warning', data.status.duplicate, whatsappButton(lastOpened.url));
      return;
    }

    const url = buildWhatsAppUrl(data.whatsappNumber, buildQuoteMessage(messageData, data.messageLabels));
    setSubmitting(true);
    const result = openWhatsApp(url);
    lastOpened = { fingerprint, url };
    // Nunca anunciamos "enviado": só o visitante pode enviar a mensagem no WhatsApp.
    if (result === 'opened') setStatus('info', data.status.opened, whatsappButton(url));
    else setStatus('warning', data.status.blocked, whatsappButton(url));
    window.setTimeout(() => setSubmitting(false), SUBMIT_LOCK_MS);
  });

  // ---- Pré-preenchimento a partir de um produto ----
  const prefill = (product: string | null, type: string | null) => {
    if (product !== null) {
      const value = product === '' ? 'nenhum' : product;
      if ([...productSelect.options].some((o) => o.value === value)) productSelect.value = value;
    }
    if (type && [...typeSelect.options].some((o) => o.value === type)) typeSelect.value = type;
  };

  const params = new URLSearchParams(window.location.search);
  if (params.has('produto') || params.has('tipo')) {
    prefill(params.get('produto'), params.get('tipo'));
  }

  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-quote-product]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    prefill(link.dataset.quoteProduct ?? '', link.dataset.quoteType ?? null);
    history.replaceState(null, '', link.href);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    form.closest('section')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    (document.getElementById('q-name') as HTMLInputElement | null)?.focus({ preventScroll: true });
  });

  updateCounter();
}
