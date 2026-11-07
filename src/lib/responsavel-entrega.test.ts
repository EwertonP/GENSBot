import { describe, expect, it } from 'vitest';
import { ehTrabalho, postsDiretos, responsavelAutomatico, tipoDoPostDireto } from './responsavel-entrega';

describe('responsavelAutomatico', () => {
  it('sem responsável, quem move de etapa passa a ser o responsável', () => {
    expect(responsavelAutomatico({ responsavelAtual: null, atorId: 'joao', updates: { status: 'criacao_arte' } })).toBe('joao');
  });
  it('quem conclui, edita o conteúdo ou publica também', () => {
    for (const u of [{ concluida: true }, { legenda: 'x' }, { arquivos: [] }, { publicado_em: 'd' }, { titulo: 't' }]) {
      expect(responsavelAutomatico({ responsavelAtual: undefined, atorId: 'a', updates: u })).toBe('a');
    }
  });
  it('mexer só em ordem, etiqueta, prazo ou comentário não conta como trabalho', () => {
    for (const u of [{ ordem: 3 }, { etiquetas_ids: ['x'] }, { prazo: '2026-11-10' }, { prioridade: 'alta' }, { comentarios_revisao: [] }]) {
      expect(responsavelAutomatico({ responsavelAtual: null, atorId: 'a', updates: u })).toBeNull();
    }
  });
  it('já tem responsável: não troca', () => {
    expect(responsavelAutomatico({ responsavelAtual: 'maria', atorId: 'joao', updates: { status: 'publicado' } })).toBeNull();
  });
  it('quando a própria requisição define o responsável, respeita (inclusive "ninguém")', () => {
    expect(responsavelAutomatico({ responsavelAtual: null, atorId: 'joao', updates: { status: 'x', responsavel_id: null } })).toBeNull();
    expect(responsavelAutomatico({ responsavelAtual: null, atorId: 'joao', updates: { responsavel_id: 'maria', status: 'x' } })).toBeNull();
  });
  it('sem ator não atribui', () => {
    expect(responsavelAutomatico({ responsavelAtual: null, atorId: null, updates: { status: 'x' } })).toBeNull();
  });
  it('ehTrabalho', () => {
    expect(ehTrabalho({ status: 'a' })).toBe(true);
    expect(ehTrabalho({ ordem: 1 })).toBe(false);
    expect(ehTrabalho({})).toBe(false);
  });
});

describe('tipoDoPostDireto', () => {
  it('mapeia o tipo de mídia do Instagram', () => {
    expect(tipoDoPostDireto('IMAGE')).toBe('post');
    expect(tipoDoPostDireto('REELS')).toBe('reel');
    expect(tipoDoPostDireto('VIDEO')).toBe('reel');
    expect(tipoDoPostDireto('STORIES')).toBe('story');
    expect(tipoDoPostDireto('CAROUSEL')).toBe('carrossel');
    expect(tipoDoPostDireto(null)).toBe('post');
  });
});

describe('postsDiretos', () => {
  const base = { instagram_user_id: 'ig1', media_type: 'IMAGE', status: 'published', published_at: '2026-11-05T12:00:00Z', caption: 'Legenda do post' };
  const contas = new Map([['ig1', 'c1']]);

  it('conta o post publicado sem demanda para o responsável, com o cliente da conta', () => {
    const r = postsDiretos([{ id: 'p1', user_id: 'joao', responsavel_id: 'ewerton', ...base }], new Set(), contas);
    expect(r).toEqual([{ id: 'p1', responsavel_id: 'ewerton', cliente_id: 'c1', tipo: 'post', titulo: 'Legenda do post', publicado_em: '2026-11-05T12:00:00Z' }]);
  });
  it('sem responsável escolhido, vale quem agendou', () => {
    expect(postsDiretos([{ id: 'p1', user_id: 'joao', responsavel_id: null, ...base }], new Set(), contas)[0].responsavel_id).toBe('joao');
  });
  it('post que pertence a uma demanda não conta de novo (já conta pela demanda)', () => {
    expect(postsDiretos([{ id: 'p1', user_id: 'joao', ...base }], new Set(['p1']), contas)).toEqual([]);
  });
  it('ignora o que não foi publicado', () => {
    expect(postsDiretos([{ id: 'p1', user_id: 'j', ...base, status: 'scheduled' }, { id: 'p2', user_id: 'j', ...base, status: 'failed' }, { id: 'p3', user_id: 'j', ...base, published_at: null }], new Set(), contas)).toEqual([]);
  });
  it('conta sem cliente cadastrado fica sem cliente; legenda longa é cortada e vazia ganha título', () => {
    const r = postsDiretos(
      [
        { id: 'a', user_id: 'j', ...base, instagram_user_id: 'outra', caption: 'x'.repeat(200) },
        { id: 'b', user_id: 'j', ...base, caption: '   ' },
      ],
      new Set(),
      contas
    );
    expect(r[0].cliente_id).toBeNull();
    expect(r[0].titulo.length).toBe(70);
    expect(r[1].titulo).toBe('Post publicado direto');
  });
});
