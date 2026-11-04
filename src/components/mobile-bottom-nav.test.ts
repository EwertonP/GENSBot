import { describe, it, expect } from 'vitest';
import { atalhosDaBarra } from './mobile-bottom-nav';
import { ABAS, abasDoMembro } from './nav-config';

describe('atalhosDaBarra', () => {
  it('master vê os 4 atalhos preferidos, na ordem', () => {
    expect(atalhosDaBarra(ABAS)).toEqual(['dashboard', 'esteira', 'calendario_geral', 'publish']);
  });

  it('membro com escopo só recebe atalhos de telas que pode ver', () => {
    const visiveis = abasDoMembro('membro');
    const r = atalhosDaBarra(visiveis);
    expect(r.length).toBeLessThanOrEqual(4);
    for (const a of r) expect(visiveis).toContain(a);
    expect(r).not.toContain('dashboard');
  });

  it('portal do cliente (poucas telas) completa só com o que existe', () => {
    const r = atalhosDaBarra(abasDoMembro('cliente'));
    expect(r).toEqual(['contacts']);
  });

  it('sem nenhuma tela conhecida devolve vazio', () => {
    expect(atalhosDaBarra([])).toEqual([]);
  });
});
