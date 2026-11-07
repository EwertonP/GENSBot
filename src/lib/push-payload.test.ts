import { describe, expect, it } from 'vitest';
import { imagemValida, montarCorpoPush, opcoesDaPrioridade } from './push';

describe('imagemValida', () => {
  it('só https de tamanho razoável', () => {
    expect(imagemValida('https://x.supabase.co/a.jpg')).toBe(true);
    expect(imagemValida('http://x.com/a.jpg')).toBe(false);
    expect(imagemValida('data:image/png;base64,AAA')).toBe(false);
    expect(imagemValida('https://x.com/' + 'a'.repeat(600))).toBe(false);
    expect(imagemValida(null)).toBe(false);
    expect(imagemValida('lixo')).toBe(false);
  });
});

describe('opcoesDaPrioridade', () => {
  it('urgente chega alto e vale mais; baixa chega baixa e vale menos; padrão é normal', () => {
    expect(opcoesDaPrioridade('urgente')).toEqual({ TTL: 86400, urgency: 'high' });
    expect(opcoesDaPrioridade('baixa')).toEqual({ TTL: 10800, urgency: 'low' });
    expect(opcoesDaPrioridade(undefined)).toEqual({ TTL: 43200, urgency: 'normal' });
  });
});

describe('montarCorpoPush', () => {
  it('mantém o formato antigo quando só há título e texto', () => {
    expect(JSON.parse(montarCorpoPush({ title: 'Oi', body: 'Corpo', url: '/?tab=esteira', tag: 'x' }))).toEqual({ title: 'Oi', body: 'Corpo', url: '/?tab=esteira', tag: 'x', prioridade: 'normal' });
  });

  it('leva imagem válida, até 2 botões e o número de não lidas', () => {
    const c = JSON.parse(
      montarCorpoPush({
        title: 'T',
        body: 'B',
        imagem: 'https://x.com/capa.jpg',
        prioridade: 'urgente',
        naoLidas: 3,
        acoes: [
          { id: 'aceitar', rotulo: 'Aceitar', token: 'tok1' },
          { id: 'recusar', rotulo: 'Recusar', token: 'tok2' },
          { id: 'abrir', rotulo: 'Abrir', url: '/' },
        ],
      })
    );
    expect(c.image).toBe('https://x.com/capa.jpg');
    expect(c.prioridade).toBe('urgente');
    expect(c.naoLidas).toBe(3);
    expect(c.acoes).toHaveLength(2);
    expect(c.acoes[0]).toEqual({ id: 'aceitar', rotulo: 'Aceitar', token: 'tok1' });
  });

  it('descarta imagem insegura, botão sem destino e número inválido', () => {
    const c = JSON.parse(
      montarCorpoPush({ title: 'T', body: 'B', imagem: 'http://x.com/a.jpg', naoLidas: -1, acoes: [{ id: 'a', rotulo: 'Sem destino' }] })
    );
    expect(c.image).toBeUndefined();
    expect(c.acoes).toBeUndefined();
    expect(c.naoLidas).toBeUndefined();
  });

  it('corta rótulo de botão e limita o número de não lidas', () => {
    const c = JSON.parse(montarCorpoPush({ title: 'T', body: 'B', naoLidas: 5000, acoes: [{ id: 'a', rotulo: 'R'.repeat(60), url: '/' }] }));
    expect(c.acoes[0].rotulo.length).toBe(24);
    expect(c.naoLidas).toBe(999);
  });
});
