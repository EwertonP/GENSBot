import { describe, expect, it } from 'vitest';
import {
  blocosDoRoteiro,
  formatoDoPost,
  juntarRoteiro,
  limparTitulo,
  partesNegrito,
  recomporCampo,
  roteiroComoTextoPuro,
  separarRoteiro,
  separarTitulo,
  textoVisivel,
} from './roteiro-cliente';

const REELS = `## 🎙️ Fala
**Cena 1 (0 a 3s)**
"Antes de pedir ajuda."

## 🖥️ Texto na tela
- Cena 1: "Sinais discretos"

## 🎬 Produção visual
- Cena 1: close na Dra. Camila.
Geral: busto, 9:16.`;

const CARROSSEL_COM_AVISO = `⚠️ VALIDAR COM A DRA. CAMILA ANTES DE PUBLICAR: itens 1 a 4.

## 🖼️ Texto dos slides
**Capa:** "O registro."

## 🎬 Produção visual
- Slide 3: número grande.`;

describe('separarRoteiro', () => {
  it('esconde a seção de produção visual', () => {
    const r = separarRoteiro(REELS);
    expect(r.visivel).toContain('Fala');
    expect(r.visivel).toContain('Texto na tela');
    expect(r.visivel).not.toContain('Produção visual');
    expect(r.visivel).not.toContain('close na Dra.');
    expect(r.interno).toContain('## 🎬 Produção visual');
    expect(r.interno).toContain('Geral: busto');
  });

  it('esconde o aviso interno antes da primeira seção', () => {
    const r = separarRoteiro(CARROSSEL_COM_AVISO);
    expect(r.visivel.startsWith('## 🖼️ Texto dos slides')).toBe(true);
    expect(r.interno).toContain('VALIDAR COM A DRA. CAMILA');
  });

  it('texto sem seções fica todo visível', () => {
    expect(separarRoteiro('Ideia: mitos da guarda.')).toEqual({ visivel: 'Ideia: mitos da guarda.', interno: '' });
    expect(separarRoteiro(null)).toEqual({ visivel: '', interno: '' });
  });
});

describe('juntarRoteiro / recomporCampo', () => {
  it('aceitar o roteiro da cliente mantém produção e aviso', () => {
    const novo = recomporCampo('briefing', '## 🖼️ Texto dos slides\n**Capa:** "Novo."', CARROSSEL_COM_AVISO);
    expect(novo.startsWith('⚠️ VALIDAR')).toBe(true);
    expect(novo).toContain('Novo.');
    expect(novo).toContain('## 🎬 Produção visual');
    expect(novo).not.toContain('O registro.');
  });

  it('seção interna volta para o fim', () => {
    const novo = recomporCampo('briefing', '## 🎙️ Fala\nOi', REELS);
    expect(novo.indexOf('Oi')).toBeLessThan(novo.indexOf('Produção visual'));
  });

  it('sem parte interna, grava só o texto novo', () => {
    expect(juntarRoteiro('A', '')).toBe('A');
    expect(recomporCampo('briefing', 'Novo', 'Velho')).toBe('Novo');
  });

  it('título recupera o prefixo interno', () => {
    expect(recomporCampo('titulo', 'Novo título', '[Dra. Camila Lucas] [Reels] Antigo')).toBe('[Dra. Camila Lucas] [Reels] Novo título');
    expect(recomporCampo('titulo', 'Novo', 'Sem prefixo')).toBe('Novo');
    expect(recomporCampo('legenda', ' L ', 'x')).toBe('L');
  });
});

describe('título e formato', () => {
  it('limpa prefixos internos', () => {
    expect(limparTitulo('[Dra. Camila Lucas] [Carrossel] Ela não pode falar')).toBe('Ela não pode falar');
    expect(separarTitulo('[A] [B] Tema').prefixo).toBe('[A] [B] ');
    expect(limparTitulo('Sem prefixo')).toBe('Sem prefixo');
    expect(limparTitulo(null)).toBe('');
  });

  it('formato vem do tipo, da etiqueta ou dos arquivos', () => {
    expect(formatoDoPost('reel', 'x')).toBe('reels');
    expect(formatoDoPost('story', 'x')).toBe('story');
    expect(formatoDoPost('post', '[Cliente] [Carrossel] x')).toBe('carrossel');
    expect(formatoDoPost('post', 'x', 3)).toBe('carrossel');
    expect(formatoDoPost('post', 'x', 1)).toBe('post');
  });

  it('texto visível por campo', () => {
    expect(textoVisivel('titulo', '[A] Tema')).toBe('Tema');
    expect(textoVisivel('briefing', REELS)).not.toContain('Produção');
    expect(textoVisivel('legenda', ' L ')).toBe('L');
  });
});

describe('blocosDoRoteiro', () => {
  it('converte seções, subtítulos, itens e parágrafos', () => {
    const b = blocosDoRoteiro(separarRoteiro(REELS).visivel);
    expect(b[0]).toEqual({ tipo: 'secao', texto: '🎙️ Fala' });
    expect(b[1]).toEqual({ tipo: 'subtitulo', texto: 'Cena 1 (0 a 3s)' });
    expect(b[2]).toEqual({ tipo: 'paragrafo', texto: '"Antes de pedir ajuda."' });
    expect(b[3]).toEqual({ tipo: 'secao', texto: '🖥️ Texto na tela' });
    expect(b[4]).toEqual({ tipo: 'item', marcador: '•', texto: 'Cena 1: "Sinais discretos"' });
  });

  it('linha "**Capa:** texto" vira parágrafo com negrito no meio', () => {
    const b = blocosDoRoteiro('**Capa:** "O registro."');
    expect(b).toEqual([{ tipo: 'paragrafo', texto: '**Capa:** "O registro."' }]);
    expect(partesNegrito(b[0].texto)).toEqual([
      { texto: 'Capa:', negrito: true },
      { texto: ' "O registro."', negrito: false },
    ]);
  });

  it('lista numerada mantém o número', () => {
    expect(blocosDoRoteiro('1. Um\n2) Dois')).toEqual([
      { tipo: 'item', marcador: '1.', texto: 'Um' },
      { tipo: 'item', marcador: '2.', texto: 'Dois' },
    ]);
  });

  it('texto puro para copiar, sem asteriscos', () => {
    const t = roteiroComoTextoPuro('## Fala\n**Cena 1**\n"Oi" com **ênfase**');
    expect(t).not.toContain('**');
    expect(t).toContain('FALA');
    expect(t).toContain('"Oi" com ênfase');
  });
});
