import { describe, it, expect } from 'vitest';
import {
  validateFieldAnswer,
  formatWhatsAppMask,
  getNextFieldIndex,
  calculateProgress,
  isColorDark,
  getOptimalTextColor,
  ensureAccessibleTextColor,
  getContrastRatio,
} from './form-engine';
import type { FormField } from '@/types/form';

describe('Form Engine', () => {
  describe('validateFieldAnswer', () => {
    it('permite campo opcional vazio', () => {
      const field: FormField = {
        id: '1',
        form_id: 'f1',
        tipo: 'text',
        label: 'Complemento',
        obrigatorio: false,
        ordem: 0,
      };
      expect(validateFieldAnswer(field, '').valid).toBe(true);
      expect(validateFieldAnswer(field, null).valid).toBe(true);
    });

    it('rejeita campo obrigatório vazio', () => {
      const field: FormField = {
        id: '1',
        form_id: 'f1',
        tipo: 'text',
        label: 'Nome completo',
        obrigatorio: true,
        ordem: 0,
      };
      expect(validateFieldAnswer(field, '').valid).toBe(false);
      expect(validateFieldAnswer(field, '   ').valid).toBe(false);
      expect(validateFieldAnswer(field, 'Maria').valid).toBe(true);
    });

    it('valida e-mail corretamente', () => {
      const field: FormField = {
        id: '2',
        form_id: 'f1',
        tipo: 'email',
        label: 'Seu melhor e-mail',
        obrigatorio: true,
        ordem: 1,
      };
      expect(validateFieldAnswer(field, 'invalido').valid).toBe(false);
      expect(validateFieldAnswer(field, 'maria@').valid).toBe(false);
      expect(validateFieldAnswer(field, 'maria@gmail.com').valid).toBe(true);
    });

    it('valida WhatsApp com quantidade mínima de dígitos', () => {
      const field: FormField = {
        id: '3',
        form_id: 'f1',
        tipo: 'whatsapp',
        label: 'WhatsApp',
        obrigatorio: true,
        ordem: 2,
      };
      expect(validateFieldAnswer(field, '12345').valid).toBe(false);
      expect(validateFieldAnswer(field, '(11) 98765-4321').valid).toBe(true);
    });

    it('sempre considera welcome e thank_you válidos', () => {
      const welcome: FormField = {
        id: 'w',
        form_id: 'f1',
        tipo: 'welcome',
        label: 'Boas-vindas',
        obrigatorio: true,
        ordem: 0,
      };
      expect(validateFieldAnswer(welcome, null).valid).toBe(true);
    });
  });

  describe('formatWhatsAppMask', () => {
    it('formata números gradualmente conforme digitação', () => {
      expect(formatWhatsAppMask('1')).toBe('(1');
      expect(formatWhatsAppMask('11')).toBe('(11');
      expect(formatWhatsAppMask('119')).toBe('(11) 9');
      expect(formatWhatsAppMask('11987654321')).toBe('(11) 98765-4321');
    });
  });

  describe('getNextFieldIndex', () => {
    const fields: FormField[] = [
      { id: 'q1', form_id: 'f1', tipo: 'text', label: 'Nome', obrigatorio: true, ordem: 0 },
      {
        id: 'q2',
        form_id: 'f1',
        tipo: 'choice',
        label: 'Qual procedimento?',
        obrigatorio: true,
        ordem: 1,
        opcoes: [
          { id: 'opt_facial', label: 'Harmonização', pular_para: 'q4' },
          { id: 'opt_corpo', label: 'Lipoescultura' },
        ],
      },
      { id: 'q3', form_id: 'f1', tipo: 'text', label: 'Detalhes Corpo', obrigatorio: false, ordem: 2 },
      { id: 'q4', form_id: 'f1', tipo: 'text', label: 'Detalhes Rosto', obrigatorio: false, ordem: 3 },
      { id: 'q5', form_id: 'f1', tipo: 'thank_you', label: 'Obrigado!', obrigatorio: false, ordem: 4 },
    ];

    it('avança sequencialmente quando não há pulo', () => {
      expect(getNextFieldIndex(0, fields, { q1: 'João' })).toBe(1);
      expect(getNextFieldIndex(1, fields, { q2: 'opt_corpo' })).toBe(2);
    });

    it('salta para o campo alvo quando configurado na opção', () => {
      // opt_facial configurado para pular direto para q4 (índice 3)
      expect(getNextFieldIndex(1, fields, { q2: 'opt_facial' })).toBe(3);
    });
  });

  describe('calculateProgress', () => {
    it('calcula porcentagens corretamente dentro do intervalo [0, 100]', () => {
      expect(calculateProgress(0, 5)).toBe(0);
      expect(calculateProgress(2, 5)).toBe(50);
      expect(calculateProgress(4, 5)).toBe(100);
    });
  });

  describe('isColorDark and getOptimalTextColor', () => {
    it('identifica cores claras com precisão', () => {
      expect(isColorDark('#ffffff')).toBe(false);
      expect(isColorDark('#fff')).toBe(false);
      expect(isColorDark('#fafafa')).toBe(false);
      expect(isColorDark('#f4f4f5')).toBe(false);
      expect(isColorDark('#fff1f2')).toBe(false);
      expect(isColorDark('#fefce8')).toBe(false);
      expect(getOptimalTextColor('#ffffff')).toBe('#192313');
    });

    it('identifica cores escuras com precisão', () => {
      expect(isColorDark('#000000')).toBe(true);
      expect(isColorDark('#000')).toBe(true);
      expect(isColorDark('#09090b')).toBe(true);
      expect(isColorDark('#18181b')).toBe(true);
      expect(isColorDark('#052e16')).toBe(true);
      expect(getOptimalTextColor('#09090b')).toBe('#f4f4f5');
    });

    it('trata valores inválidos ou nulos sem quebrar', () => {
      expect(isColorDark(null)).toBe(false);
      expect(isColorDark(undefined)).toBe(false);
      expect(isColorDark('')).toBe(false);
      expect(isColorDark('invalid')).toBe(false);
    });

    it('previne colapso de contraste garantindo legibilidade WCAG', () => {
      // Se fundo é branco e texto veio branco (#f4f4f5), força tinta escura #192313
      expect(ensureAccessibleTextColor('#f4f4f5', '#ffffff')).toBe('#192313');
      expect(ensureAccessibleTextColor('#ffffff', '#ffffff')).toBe('#192313');

      // Se fundo é escuro e texto veio escuro (#192313), força texto claro #f4f4f5
      expect(ensureAccessibleTextColor('#192313', '#09090b')).toBe('#f4f4f5');
      expect(ensureAccessibleTextColor('#000000', '#09090b')).toBe('#f4f4f5');

      // Se já possui alto contraste, preserva a cor original
      expect(ensureAccessibleTextColor('#f4f4f5', '#09090b')).toBe('#f4f4f5');
      expect(ensureAccessibleTextColor('#192313', '#f7f8f2')).toBe('#192313');
      expect(ensureAccessibleTextColor('#291816', '#fff1f2')).toBe('#291816');
    });

    it('calcula ratio de contraste corretamente', () => {
      expect(getContrastRatio('#ffffff', '#000000')).toBeGreaterThan(20);
      expect(getContrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 1);
    });
  });
});

