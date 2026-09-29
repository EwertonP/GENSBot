'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * ScrollShadow no estilo HeroUI: esmaece a borda da área rolável só do lado
 * onde ainda há conteúdo escondido — sinaliza "tem mais aqui" sem ocupar
 * espaço. Nas pontas (início/fim), a borda fica nítida.
 */
export interface ScrollShadowProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
}

export function ScrollShadow({ className, style, size = 32, children, ...props }: ScrollShadowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  const mask = `linear-gradient(to right, ${edges.start ? 'transparent' : '#000'} 0, #000 ${size}px, #000 calc(100% - ${size}px), ${edges.end ? 'transparent' : '#000'} 100%)`;

  return (
    <div
      ref={ref}
      onScroll={measure}
      className={cn('overflow-x-auto', className)}
      style={edges.start || edges.end ? { ...style, maskImage: mask, WebkitMaskImage: mask } : style}
      {...props}
    >
      {children}
    </div>
  );
}
