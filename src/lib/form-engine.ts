import type { FormField } from '@/types/form';

/**
 * Valida a resposta de um campo do formulário de acordo com seu tipo e regras de obrigatoriedade.
 */
export function validateFieldAnswer(
  field: FormField,
  answer: any
): { valid: boolean; error?: string } {
  // Telas de boas-vindas e agradecimento não exigem resposta
  if (field.tipo === 'welcome' || field.tipo === 'thank_you') {
    return { valid: true };
  }

  const isEmpty =
    answer === undefined ||
    answer === null ||
    (typeof answer === 'string' && answer.trim() === '') ||
    (Array.isArray(answer) && answer.length === 0);

  if (field.obrigatorio && isEmpty) {
    return { valid: false, error: 'Por favor, preencha este campo para continuar.' };
  }

  // Se não for obrigatório e estiver vazio, é válido
  if (isEmpty) {
    return { valid: true };
  }

  // Validação específica por tipo
  if (field.tipo === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(answer).trim())) {
      return { valid: false, error: 'Por favor, insira um e-mail válido.' };
    }
  }

  if (field.tipo === 'whatsapp') {
    const digitsOnly = String(answer).replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 13) {
      return { valid: false, error: 'Informe um número de WhatsApp válido com DDD (ex: 11 99999-9999).' };
    }
  }

  if (field.tipo === 'terms') {
    if (answer !== true) {
      return { valid: false, error: 'Você precisa aceitar os termos para continuar.' };
    }
  }

  return { valid: true };
}

/**
 * Aplica máscara de telefone / WhatsApp brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
export function formatWhatsAppMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';

  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Calcula o próximo índice de campo a ser exibido, considerando regras de pulo (branching).
 */
export function getNextFieldIndex(
  currentIndex: number,
  fields: FormField[],
  answers: Record<string, any>
): number {
  if (currentIndex >= fields.length - 1) {
    return fields.length - 1;
  }

  const currentField = fields[currentIndex];
  if (!currentField) return currentIndex + 1;

  const currentAnswer = answers[currentField.id];

  // 1. Verifica pulo baseado na opção de múltipla escolha
  if (currentField.tipo === 'choice' && currentField.opcoes && currentAnswer) {
    const selectedOption = currentField.opcoes.find((opt) => opt.id === currentAnswer || opt.label === currentAnswer);
    if (selectedOption?.pular_para) {
      const targetIndex = fields.findIndex((f) => f.id === selectedOption.pular_para);
      if (targetIndex !== -1) {
        return targetIndex;
      }
    }
  }

  // 2. Verifica regras de lógica condicional (logica_pulo)
  if (currentField.logica_pulo && Array.isArray(currentField.logica_pulo)) {
    for (const rule of currentField.logica_pulo) {
      let match = false;
      const strAnswer = String(currentAnswer || '').trim().toLowerCase();
      const strRuleVal = String(rule.valor || '').trim().toLowerCase();

      switch (rule.operador) {
        case 'equals':
          match = strAnswer === strRuleVal;
          break;
        case 'not_equals':
          match = strAnswer !== strRuleVal;
          break;
        case 'contains':
          match = strAnswer.includes(strRuleVal);
          break;
        case 'is_filled':
          match = strAnswer.length > 0;
          break;
      }

      if (match && rule.pular_para) {
        const targetIndex = fields.findIndex((f) => f.id === rule.pular_para);
        if (targetIndex !== -1) {
          return targetIndex;
        }
      }
    }
  }

  // Comportamento padrão: avança sequencialmente
  return currentIndex + 1;
}

/**
 * Calcula porcentagem de conclusão do formulário (0 a 100%).
 */
export function calculateProgress(currentIndex: number, totalFields: number): number {
  if (totalFields <= 1) return 100;
  const pct = Math.round((currentIndex / (totalFields - 1)) * 100);
  return Math.min(100, Math.max(0, pct));
}
