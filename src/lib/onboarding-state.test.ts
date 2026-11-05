import { describe, it, expect } from 'vitest';
import { criarStateOnboarding, verificarStateOnboarding } from './onboarding-state';

describe('Assinatura e Validação do State de Onboarding OAuth', () => {
  it('cria e valida state assinado com sucesso', () => {
    const state = criarStateOnboarding('token-123', 'cli-456', 'instagram');
    expect(state.startsWith('onb_')).toBe(true);

    const verificado = verificarStateOnboarding(state);
    expect(verificado.valido).toBe(true);
    expect(verificado.onboardingToken).toBe('token-123');
    expect(verificado.clienteId).toBe('cli-456');
    expect(verificado.rede).toBe('instagram');
  });

  it('rejeita state adulterado', () => {
    const state = criarStateOnboarding('token-123', 'cli-456', 'threads');
    const partes = state.split('.');
    const adulterado = `${partes[0]}.assinaturainvalida`;

    const verificado = verificarStateOnboarding(adulterado);
    expect(verificado.valido).toBe(false);
  });

  it('rejeita state expirado', () => {
    // Validade negativa (-1 minuto)
    const stateExpirado = criarStateOnboarding('token-123', 'cli-456', 'tiktok', -1);
    const verificado = verificarStateOnboarding(stateExpirado);
    expect(verificado.valido).toBe(false);
  });

  it('retorna invalido para states legados normais', () => {
    expect(verificarStateOnboarding('cliente_123').valido).toBe(false);
    expect(verificarStateOnboarding(null).valido).toBe(false);
  });
});
