import crypto from 'crypto';

interface PayloadOnboardingState {
  onboardingToken: string;
  clienteId: string;
  rede: 'instagram' | 'threads' | 'tiktok';
  exp: number; // timestamp ms
}

const SEGREDO_HMAC = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXTAUTH_SECRET || 'segredo-padrao-onboarding-gensbot';

/** Gera uma string codificada e assinada com HMAC para o state do OAuth */
export function criarStateOnboarding(
  onboardingToken: string,
  clienteId: string,
  rede: 'instagram' | 'threads' | 'tiktok',
  validadeMinutos: number = 60
): string {
  const payload: PayloadOnboardingState = {
    onboardingToken,
    clienteId,
    rede,
    exp: Date.now() + validadeMinutos * 60 * 1000,
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', SEGREDO_HMAC).update(payloadStr).digest('base64url');
  return `onb_${payloadStr}.${hmac}`;
}

/** Valida e extrai os dados do state do OAuth */
export function verificarStateOnboarding(stateRaw: string | null | undefined): {
  valido: boolean;
  onboardingToken?: string;
  clienteId?: string;
  rede?: 'instagram' | 'threads' | 'tiktok';
} {
  if (!stateRaw || !stateRaw.startsWith('onb_')) {
    return { valido: false };
  }

  try {
    const semPrefixo = stateRaw.slice(4);
    const [payloadStr, hmacRecebido] = semPrefixo.split('.');
    if (!payloadStr || !hmacRecebido) return { valido: false };

    const hmacEsperado = crypto
      .createHmac('sha256', SEGREDO_HMAC)
      .update(payloadStr)
      .digest('base64url');

    if (hmacRecebido !== hmacEsperado) {
      return { valido: false };
    }

    const payload: PayloadOnboardingState = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString('utf8')
    );

    if (Date.now() > payload.exp) {
      return { valido: false };
    }

    return {
      valido: true,
      onboardingToken: payload.onboardingToken,
      clienteId: payload.clienteId,
      rede: payload.rede,
    };
  } catch {
    return { valido: false };
  }
}
