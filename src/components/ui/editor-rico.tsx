'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent, useEditorState, type Editor } from '@tiptap/react';
import { Extension, InputRule } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { htmlVazio } from '@/lib/editor-rico';

/** "--" + espaço no começo da linha vira uma linha divisória (como no Orkestrya). */
const LinhaDivisoria = Extension.create({
  name: 'linhaDivisoria',
  addInputRules() {
    return [
      new InputRule({
        find: /^--\s$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).setHorizontalRule().run();
        },
      }),
    ];
  },
});

interface EditorRicoProps {
  /** HTML inicial. O editor é não controlado: o pai troca a `key` para recarregar. */
  valorInicial: string;
  onChange: (html: string, texto: string) => void;
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
  minHeight?: string;
}

/**
 * Editor de texto rico (Tiptap) no estilo do Orkestrya: desfazer/refazer,
 * tamanho do texto (parágrafo, H2, H3), negrito, itálico, sublinhado, tachado,
 * destaque, listas, citação e divisória (digitar `--` + espaço cria a linha).
 */
export function EditorRico({ valorInicial, onChange, placeholder, 'aria-label': ariaLabel, className, minHeight = '10rem' }: EditorRicoProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Highlight,
      LinhaDivisoria,
      Placeholder.configure({ placeholder: placeholder ?? 'Escreva aqui…' }),
    ],
    content: valorInicial,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel ?? 'Editor de texto',
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'editor-rico-conteudo outline-none px-4 py-3 text-sm leading-relaxed text-foreground',
        style: `min-height:${minHeight}`,
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(htmlVazio(e.getHTML()) ? '' : e.getHTML(), e.getText({ blockSeparator: '\n' }));
    },
  });

  useEffect(() => () => editor?.destroy(), [editor]);

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-input bg-card shadow-2xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25', className)}>
      {editor && <BarraEditor editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function BarraEditor({ editor }: { editor: Editor }) {
  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      negrito: e.isActive('bold'),
      italico: e.isActive('italic'),
      sublinhado: e.isActive('underline'),
      tachado: e.isActive('strike'),
      destaque: e.isActive('highlight'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      lista: e.isActive('bulletList'),
      numerada: e.isActive('orderedList'),
      citacao: e.isActive('blockquote'),
      podeDesfazer: e.can().undo(),
      podeRefazer: e.can().redo(),
    }),
  });
  const cmd = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Formatação do texto" className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1.5">
      <Botao rotulo="Desfazer" onClick={() => cmd().undo().run()} desabilitado={!estado.podeDesfazer}><Undo2 /></Botao>
      <Botao rotulo="Refazer" onClick={() => cmd().redo().run()} desabilitado={!estado.podeRefazer}><Redo2 /></Botao>
      <Separador />
      <Botao rotulo="Texto normal" ativo={!estado.h2 && !estado.h3} onClick={() => cmd().setParagraph().run()}><Pilcrow /></Botao>
      <Botao rotulo="Título grande" ativo={estado.h2} onClick={() => cmd().toggleHeading({ level: 2 }).run()}><Heading2 /></Botao>
      <Botao rotulo="Título médio" ativo={estado.h3} onClick={() => cmd().toggleHeading({ level: 3 }).run()}><Heading3 /></Botao>
      <Separador />
      <Botao rotulo="Negrito" ativo={estado.negrito} onClick={() => cmd().toggleBold().run()}><Bold /></Botao>
      <Botao rotulo="Itálico" ativo={estado.italico} onClick={() => cmd().toggleItalic().run()}><Italic /></Botao>
      <Botao rotulo="Sublinhado" ativo={estado.sublinhado} onClick={() => cmd().toggleUnderline().run()}><UnderlineIcon /></Botao>
      <Botao rotulo="Tachado" ativo={estado.tachado} onClick={() => cmd().toggleStrike().run()}><Strikethrough /></Botao>
      <Botao rotulo="Destacar" ativo={estado.destaque} onClick={() => cmd().toggleHighlight().run()}><Highlighter /></Botao>
      <Separador />
      <Botao rotulo="Lista com marcadores" ativo={estado.lista} onClick={() => cmd().toggleBulletList().run()}><List /></Botao>
      <Botao rotulo="Lista numerada" ativo={estado.numerada} onClick={() => cmd().toggleOrderedList().run()}><ListOrdered /></Botao>
      <Botao rotulo="Citação" ativo={estado.citacao} onClick={() => cmd().toggleBlockquote().run()}><Quote /></Botao>
      <Botao rotulo="Linha divisória" onClick={() => cmd().setHorizontalRule().run()}><Minus /></Botao>
      <Separador />
      <Botao rotulo="Limpar formatação" onClick={() => cmd().unsetAllMarks().clearNodes().run()}><RemoveFormatting /></Botao>
    </div>
  );
}

function Separador() {
  return <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />;
}

function Botao({
  rotulo,
  ativo,
  desabilitado,
  onClick,
  children,
}: {
  rotulo: string;
  ativo?: boolean;
  desabilitado?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={ativo}
      disabled={desabilitado}
      // Evita tirar o foco (e a seleção) do texto ao clicar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'grid size-8 pointer-coarse:size-10 place-items-center rounded-lg text-muted-foreground transition-colors cursor-pointer [&_svg]:size-4',
        'hover:bg-accent hover:text-foreground disabled:opacity-35 disabled:pointer-events-none',
        ativo && 'bg-primary/15 text-brand-text'
      )}
    >
      {children}
    </button>
  );
}
