import { describe, it, expect } from 'vitest';
import { conteudoInicial, htmlVazio, textoParaHtml } from './editor-rico';

describe('textoParaHtml', () => {
  it('separa parágrafos e preserva quebras simples', () => {
    expect(textoParaHtml('Cena 1\nGancho\n\nCena 2')).toBe('<p>Cena 1<br>Gancho</p><p>Cena 2</p>');
  });
  it('escapa HTML do texto antigo', () => {
    expect(textoParaHtml('<b>oi</b> & "x"')).toBe('<p>&lt;b&gt;oi&lt;/b&gt; &amp; &quot;x&quot;</p>');
  });
  it('vazio devolve vazio', () => {
    expect(textoParaHtml('  \n ')).toBe('');
    expect(textoParaHtml(null)).toBe('');
  });
});

describe('conteudoInicial e htmlVazio', () => {
  it('prefere o HTML salvo', () => {
    expect(conteudoInicial('<h2>Roteiro</h2>', 'texto')).toBe('<h2>Roteiro</h2>');
    expect(conteudoInicial(null, 'texto')).toBe('<p>texto</p>');
  });
  it('reconhece o parágrafo vazio do editor', () => {
    expect(htmlVazio('<p></p>')).toBe(true);
    expect(htmlVazio('<p>oi</p>')).toBe(false);
  });
});
