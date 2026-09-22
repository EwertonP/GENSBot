import { describe, it, expect } from 'vitest';
import { mapNotionPageToDemand } from './notion';

describe('mapNotionPageToDemand', () => {
  it('mapeia corretamente uma página de Reels do Notion com Roteiro e Legenda', () => {
    const mockPage: any = {
      id: '39e75451-38cc-81e3-a890-de0c14ac090a',
      created_time: '2026-07-15T18:24:00.000Z',
      last_edited_time: '2026-07-15T18:24:00.000Z',
      url: 'https://notion.so/test',
      properties: {
        'Nome do projeto': {
          title: [{ plain_text: 'Post 07 - Tratamento de Olheiras Profundas (Reels)' }],
        },
        'Seleção': {
          multi_select: [{ name: 'Vídeo' }],
        },
        'Legenda': {
          rich_text: [{ plain_text: 'Legenda explicativa sobre olheiras...' }],
        },
        'Roteiro': {
          rich_text: [{ plain_text: 'Gancho (0-3s): Dormiu 8 horas?...' }],
        },
        'Status': {
          status: { name: 'Não iniciado' },
        },
      },
    };

    const mapped = mapNotionPageToDemand(mockPage);

    expect(mapped.titulo).toBe('Post 07 - Tratamento de Olheiras Profundas (Reels)');
    expect(mapped.tipo).toBe('reel');
    expect(mapped.legenda).toBe('Legenda explicativa sobre olheiras...');
    expect(mapped.briefing).toBe('Gancho (0-3s): Dormiu 8 horas?...');
    expect(mapped.status).toBe('planejamento');
  });

  it('mapeia corretamente uma página de Carrossel', () => {
    const mockPage: any = {
      id: '39e75451-38cc-812d-8140-f04b35d706ca',
      created_time: '2026-07-15T18:24:00.000Z',
      last_edited_time: '2026-07-15T18:24:00.000Z',
      url: 'https://notion.so/test-carrossel',
      properties: {
        'Nome do projeto': {
          title: [{ plain_text: 'Post 04 - Esvaziadores de Gordura (Carrossel)' }],
        },
        'Seleção': {
          multi_select: [{ name: 'Carrossel' }],
        },
        'Legenda': {
          rich_text: [{ plain_text: 'Texto da legenda do carrossel' }],
        },
        'Texto da arte': {
          rich_text: [{ plain_text: 'Slide 1: Capa\nSlide 2: Conteúdo' }],
        },
        'Status': {
          status: { name: 'Em progresso' },
        },
      },
    };

    const mapped = mapNotionPageToDemand(mockPage);

    expect(mapped.titulo).toBe('Post 04 - Esvaziadores de Gordura (Carrossel)');
    expect(mapped.tipo).toBe('post');
    expect(mapped.briefing).toBe('Slide 1: Capa\nSlide 2: Conteúdo');
    expect(mapped.status).toBe('criacao_arte');
  });

  it('desfaz quebras de linha literais \\n e combina Roteiro e Texto da arte quando ambos existirem', () => {
    const mockPage: any = {
      id: '39e75451-38cc-812d-8140-f04b35d706cb',
      created_time: '2026-07-15T18:24:00.000Z',
      last_edited_time: '2026-07-15T18:24:00.000Z',
      url: 'https://notion.so/test-carrossel-duplo',
      properties: {
        'Nome do projeto': {
          title: [{ plain_text: 'Post Carrossel Duplo' }],
        },
        'Seleção': {
          multi_select: [{ name: 'Carrossel' }],
        },
        'Legenda Completa': {
          rich_text: [{ plain_text: 'Legenda com \\nquebra de linha' }],
        },
        'Roteiro': {
          rich_text: [{ plain_text: 'Cena 1 (0-3s): Introdução \\nCena 2: Explicação' }],
        },
        'Texto da arte': {
          rich_text: [{ plain_text: 'Slide 1: Capa \\nSlide 2: Detalhes' }],
        },
      },
    };

    const mapped = mapNotionPageToDemand(mockPage);

    expect(mapped.legenda).toBe('Legenda com \nquebra de linha');
    expect(mapped.briefing).toContain('--- ROTEIRO ---\nCena 1 (0-3s): Introdução \nCena 2: Explicação');
    expect(mapped.briefing).toContain('--- TEXTO DA ARTE / SLIDES ---\nSlide 1: Capa \nSlide 2: Detalhes');
  });
});

describe('correspondeClienteEnotionDb', () => {
  it('associa corretamente clientes pelos nomes e handles sem confundir com outros clientes', async () => {
    const { correspondeClienteEnotionDb } = await import('./notion');

    // EduSaúde só deve dar match com EduSaúde
    expect(correspondeClienteEnotionDb('@edusaudepreparatorio', '📋 Criativos — EduSaúde')).toBe(true);
    expect(correspondeClienteEnotionDb('@edusaudepreparatorio', '📋 Conteúdos — Dra. Laís Leal')).toBe(false);
    expect(correspondeClienteEnotionDb('@edusaudepreparatorio', '📋 Conteúdos — NETMais+')).toBe(false);

    // Dra. Laís
    expect(correspondeClienteEnotionDb('@laisleal.dermato', '📋 Conteúdos — Dra. Laís Leal')).toBe(true);
    expect(correspondeClienteEnotionDb('@laisleal.dermato', '💅 Calendário Editorial — Dra. Laís')).toBe(true);
    expect(correspondeClienteEnotionDb('@laisleal.dermato', '📋 Criativos — EduSaúde')).toBe(false);

    // Dra. Camila Lucas
    expect(correspondeClienteEnotionDb('@camilalucas_adv', '📋 Conteúdos — Dra. Camila Lucas')).toBe(true);
    expect(correspondeClienteEnotionDb('@camilalucas_adv', '📋 Criativos — EduSaúde')).toBe(false);

    // Dr. Fellipe Bezerra
    expect(correspondeClienteEnotionDb('@drfellipbezerra', '📋 Conteúdos — Dr. Fellipe Bezerra')).toBe(true);
    expect(correspondeClienteEnotionDb('@drfellipbezerra', '📋 Conteúdos — Dra. Camila Lucas')).toBe(false);
  });
});
