import { describe, expect, it } from 'vitest';
import { DESCRIPTION_MAX, DESCRIPTION_MIN, hasErrors, validateQuote, type QuoteFormData } from '../../src/lib/quote-validation';

const valid: QuoteFormData = {
  name: 'Ana López',
  email: 'ana@example.es',
  phone: '',
  product: 'conjunto-decorativo-natal',
  requestType: 'catalogo',
  description: 'Gostaria de saber as cores disponíveis para este conjunto.',
  contactPreference: 'email',
  consent: true,
  website: '',
};

describe('validateQuote', () => {
  it('aceita um pedido válido', () => {
    expect(hasErrors(validateQuote(valid))).toBe(false);
  });

  it('exige os campos obrigatórios', () => {
    const errors = validateQuote({
      ...valid,
      name: '  ',
      email: '',
      product: '',
      requestType: '',
      description: '',
      contactPreference: '',
      consent: false,
    });
    expect(errors).toMatchObject({
      name: { code: 'required' },
      email: { code: 'required' },
      product: { code: 'required' },
      requestType: { code: 'required' },
      description: { code: 'required' },
      contactPreference: { code: 'required' },
      consent: { code: 'consentRequired' },
    });
    expect(errors.phone).toBeUndefined();
  });

  it.each(['ana', 'ana@', 'ana@dominio', 'ana @dominio.es'])('rejeita o e-mail inválido %s', (email) => {
    expect(validateQuote({ ...valid, email }).email?.code).toBe('emailInvalid');
  });

  it('valida o formato do telefone opcional', () => {
    expect(validateQuote({ ...valid, phone: '+34 600 123 456' }).phone).toBeUndefined();
    expect(validateQuote({ ...valid, phone: 'abc' }).phone?.code).toBe('phoneInvalid');
    expect(validateQuote({ ...valid, phone: '12' }).phone?.code).toBe('phoneInvalid');
  });

  it('exige telefone quando a preferência de contacto é telefone', () => {
    expect(validateQuote({ ...valid, contactPreference: 'telefone' }).phone?.code).toBe('phoneRequiredForPreference');
    expect(validateQuote({ ...valid, contactPreference: 'telefone', phone: '600123456' }).phone).toBeUndefined();
  });

  it('limita o tamanho da descrição', () => {
    expect(validateQuote({ ...valid, description: 'curto' }).description).toEqual({
      code: 'descriptionTooShort',
      params: { min: DESCRIPTION_MIN },
    });
    expect(validateQuote({ ...valid, description: 'a'.repeat(DESCRIPTION_MAX + 1) }).description?.code).toBe(
      'descriptionTooLong',
    );
  });

  it('rejeita tipos de pedido desconhecidos', () => {
    expect(validateQuote({ ...valid, requestType: 'hack' }).requestType?.code).toBe('required');
  });
});
