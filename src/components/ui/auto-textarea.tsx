'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { fieldInputClass } from '@/lib/form-styles';

/**
 * Textarea que cresce com o conteúdo: o texto inteiro fica visível e só o
 * container de fora rola (nada de caixa com rolagem dentro de modal com
 * rolagem). `bare` tira a aparência de campo, para quando o texto deve
 * parecer texto (ex.: o título no cabeçalho do modal da demanda).
 */
const ESTILOS_COPIADOS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'tabSize',
  'whiteSpace',
  'wordBreak',
  'overflowWrap',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'borderStyle',
] as const;

/**
 * Mede a altura numa cópia invisível do campo. Encolher o próprio campo para
 * medir (height: auto) faz a barra de rolagem do modal sumir por um instante,
 * o campo fica mais largo e a medida sai menor do que o necessário.
 */
function medirAltura(el: HTMLTextAreaElement): number {
  const estilo = window.getComputedStyle(el);
  const sombra = document.createElement('textarea');
  for (const prop of ESTILOS_COPIADOS) sombra.style[prop] = estilo[prop];
  Object.assign(sombra.style, {
    boxSizing: 'border-box',
    width: `${el.offsetWidth}px`,
    height: '0px',
    minHeight: '0px',
    overflow: 'hidden',
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '-9999px',
  });
  sombra.value = el.value || el.placeholder || ' ';
  document.body.appendChild(sombra);
  const borda = parseFloat(estilo.borderTopWidth) + parseFloat(estilo.borderBottomWidth);
  const altura = sombra.scrollHeight + borda;
  sombra.remove();
  return altura;
}

export interface AutoTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  bare?: boolean;
}

export const AutoTextarea = React.forwardRef<HTMLTextAreaElement, AutoTextareaProps>(
  ({ className, bare, value, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = useCallback(
      (el: HTMLTextAreaElement | null) => {
        innerRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      },
      [ref]
    );

    const ajustarAltura = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = `${medirAltura(el)}px`;
    }, []);

    useEffect(() => {
      ajustarAltura();
    }, [value, ajustarAltura]);

    // Recalcula quando a largura muda (janela, ou a barra de rolagem do modal
    // aparecendo depois que o próprio campo cresce). Só a largura: reagir à
    // altura que nós mesmos definimos entraria em loop.
    useEffect(() => {
      const el = innerRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      let larguraAnterior = el.clientWidth;
      const observer = new ResizeObserver(() => {
        if (el.clientWidth === larguraAnterior) return;
        larguraAnterior = el.clientWidth;
        ajustarAltura();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, [ajustarAltura]);

    return (
      <textarea
        ref={setRefs}
        rows={1}
        value={value}
        {...props}
        className={cn(!bare && fieldInputClass, 'resize-none overflow-hidden', className)}
      />
    );
  }
);
AutoTextarea.displayName = 'AutoTextarea';
