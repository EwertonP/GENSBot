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
});
