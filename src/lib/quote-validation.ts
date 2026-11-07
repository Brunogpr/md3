import type { Dictionary } from '../i18n/pt';

export const requestTypes = ['catalogo', 'personalizado', 'informacoes', 'outro'] as const;
export type RequestType = (typeof requestTypes)[number];

export const contactPreferences = ['email', 'telefone'] as const;
export type ContactPreference = (typeof contactPreferences)[number];

export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 2000;
export const NAME_MAX = 120;

export interface QuoteFormData {
  name: string;
  email: string;
  phone: string;
  product: string;
  requestType: string;
  description: string;
  contactPreference: string;
  consent: boolean;
  /** Campo-armadilha invisível: só robôs o preenchem. */
  website: string;
}

export type QuoteField = Exclude<keyof QuoteFormData, 'website'>;
export type QuoteErrorCode = keyof Dictionary['quote']['errors'];
export interface FieldError {
  code: QuoteErrorCode;
  params?: Record<string, number>;
}
export type QuoteErrors = Partial<Record<QuoteField, FieldError>>;

// Verificação pragmática; a confirmação real do endereço acontece quando respondemos.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9\s().-]{6,20}$/;

export function normalizeQuote(data: QuoteFormData): QuoteFormData {
  return {
    ...data,
    name: data.name.trim(),
    email: data.email.trim(),
    phone: data.phone.trim(),
    product: data.product.trim(),
    description: data.description.trim(),
  };
}

export function validateQuote(raw: QuoteFormData): QuoteErrors {
  const data = normalizeQuote(raw);
  const errors: QuoteErrors = {};

  if (!data.name) errors.name = { code: 'required' };
  else if (data.name.length < 2 || data.name.length > NAME_MAX) errors.name = { code: 'nameTooShort' };

  if (!data.email) errors.email = { code: 'required' };
  else if (!EMAIL_PATTERN.test(data.email)) errors.email = { code: 'emailInvalid' };

  const digits = data.phone.replace(/\D/g, '');
  if (data.phone && (!PHONE_PATTERN.test(data.phone) || digits.length < 6)) {
    errors.phone = { code: 'phoneInvalid' };
  } else if (!data.phone && data.contactPreference === 'telefone') {
    errors.phone = { code: 'phoneRequiredForPreference' };
  }

  if (!data.product) errors.product = { code: 'required' };

  if (!(requestTypes as readonly string[]).includes(data.requestType)) {
    errors.requestType = { code: 'required' };
  }

  if (!data.description) errors.description = { code: 'required' };
  else if (data.description.length < DESCRIPTION_MIN)
    errors.description = { code: 'descriptionTooShort', params: { min: DESCRIPTION_MIN } };
  else if (data.description.length > DESCRIPTION_MAX)
    errors.description = { code: 'descriptionTooLong', params: { max: DESCRIPTION_MAX } };

  if (!(contactPreferences as readonly string[]).includes(data.contactPreference)) {
    errors.contactPreference = { code: 'required' };
  }

  if (!data.consent) errors.consent = { code: 'consentRequired' };

  return errors;
}

export function hasErrors(errors: QuoteErrors): boolean {
  return Object.keys(errors).length > 0;
}
