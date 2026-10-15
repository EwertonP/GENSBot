import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  criptografarSegredo,
  descriptografarSegredo,
  estaCriptografado,
  segredoDisponivel,
} from './cripto';

const SEGREDO = Buffer.alloc(32, 7).toString('base64');

beforeEach(() => {
  vi.stubEnv('AI_KEYS_SECRET', SEGREDO);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('cripto', () => {
  it('criptografa e descriptografa de volta', () => {
    const c = criptografarSegredo('sk-minha-chave');
    expect(estaCriptografado(c)).toBe(true);
    expect(c).not.toContain('sk-minha-chave');
    expect(descriptografarSegredo(c)).toBe('sk-minha-chave');
  });

  it('gera um valor diferente a cada vez (IV aleatório)', () => {
    expect(criptografarSegredo('x')).not.toBe(criptografarSegredo('x'));
  });

  it('chave antiga em texto puro passa direto até ser recriptografada', () => {
    expect(descriptografarSegredo('sk-antiga')).toBe('sk-antiga');
    expect(estaCriptografado('sk-antiga')).toBe(false);
  });

  it('valor adulterado ou segredo trocado devolve null em vez de lançar', () => {
    const c = criptografarSegredo('sk-minha-chave');
    expect(descriptografarSegredo(c.slice(0, -4) + 'AAAA')).toBeNull();

    vi.stubEnv('AI_KEYS_SECRET', Buffer.alloc(32, 9).toString('base64'));
    expect(descriptografarSegredo(c)).toBeNull();
  });

  it('sem segredo válido não grava em texto puro e não lê o que está criptografado', () => {
    const c = criptografarSegredo('sk-minha-chave');

    vi.stubEnv('AI_KEYS_SECRET', '');
    expect(segredoDisponivel()).toBe(false);
    expect(() => criptografarSegredo('x')).toThrow();
    expect(descriptografarSegredo(c)).toBeNull();

    vi.stubEnv('AI_KEYS_SECRET', Buffer.alloc(8).toString('base64'));
    expect(segredoDisponivel()).toBe(false);
  });

  it('vazio ou nulo devolve null', () => {
    expect(descriptografarSegredo(null)).toBeNull();
    expect(descriptografarSegredo('')).toBeNull();
  });
});
