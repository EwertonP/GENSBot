import type { CaptureLeadNodeConfig } from '@/types/flow';

/** Config inicial do bloco "Capturar Lead" — mesma em todo lugar que cria o bloco (canvas, formulário guiado, MCP). */
export function defaultCaptureLeadConfig(): CaptureLeadNodeConfig {
  return {
    fields: ['email', 'phone'],
    askText: {
      email: 'Me passa seu e-mail que eu já te mando o material.',
      phone: 'Anotado! E seu WhatsApp com DDD? Pode ser só os números.',
    },
    invalidText: {
      email: 'Acho que esse e-mail veio com algum erro. Confere e me manda de novo? Tipo nome@gmail.com',
      phone: 'Não consegui entender esse número. Me manda com DDD, assim: 81999998888',
    },
    maxAttempts: 3,
    skipIfKnown: true,
    timeoutMinutes: 720,
    reminderText: 'Ainda quer o material? É só me responder aqui que a gente continua.',
  };
}

export const CAPTURE_FIELD_LABELS: Record<'email' | 'phone', string> = { email: 'E-mail', phone: 'Telefone' };
