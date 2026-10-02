'use client';

import React, { useEffect, useRef, useState } from 'react';
import type QRCodeStyling from 'qr-code-styling';
import type { Options } from 'qr-code-styling';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

// IDV da agência: módulos quase-pretos com olhos em verde-oliva. Fundo sempre
// branco — QR precisa de contraste alto pra leitura em qualquer câmera.
const GENS_QR_OPTIONS: Partial<Options> = {
  type: 'svg',
  image: '/fav-icon.png',
  margin: 8,
  qrOptions: { errorCorrectionLevel: 'H' }, // H tolera o logo cobrindo o centro
  dotsOptions: { type: 'rounded', color: '#0F0F0F' },
  cornersSquareOptions: { type: 'extra-rounded', color: '#304000' },
  cornersDotOptions: { type: 'dot', color: '#4D8300' },
  backgroundOptions: { color: '#FFFFFF' },
  imageOptions: { margin: 4, imageSize: 0.3, hideBackgroundDots: true },
};

interface QrCodeStyledProps {
  data: string;
  /** Tamanho exibido na tela, em px. */
  size?: number;
  /** Nome do arquivo baixado, sem extensão. Sem ele, os botões de download somem. */
  fileName?: string;
}

export function QrCodeStyled({ data, size = 128, fileName }: QrCodeStyledProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const dataRef = useRef(data);
  const [ready, setReady] = useState(false);

  // A lib acessa window/document no import, então só carrega no cliente.
  useEffect(() => {
    let cancelled = false;
    import('qr-code-styling').then(({ default: QRCodeStylingCtor }) => {
      if (cancelled || !containerRef.current) return;
      const qr = new QRCodeStylingCtor({ ...GENS_QR_OPTIONS, width: size, height: size, data: dataRef.current });
      containerRef.current.innerHTML = '';
      qr.append(containerRef.current);
      qrRef.current = qr;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [size]);

  useEffect(() => {
    dataRef.current = data; // lido pelo import assíncrono acima, se ainda não resolveu
    qrRef.current?.update({ data });
  }, [data]);

  const download = (extension: 'png' | 'svg') => {
    if (!fileName) return;
    import('qr-code-styling').then(({ default: QRCodeStylingCtor }) => {
      // Exporta em alta resolução, independente do tamanho na tela.
      const hiRes = new QRCodeStylingCtor({ ...GENS_QR_OPTIONS, width: 1024, height: 1024, data });
      hiRes.download({ name: fileName, extension });
    });
  };

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="p-2 bg-white rounded-xl shadow-xs border border-border">
        <div
          ref={containerRef}
          role="img"
          aria-label="QR Code do link"
          style={{ width: size, height: size }}
          className={ready ? '' : 'animate-pulse bg-accent rounded-lg'}
        />
      </div>
      {fileName && (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="text-xs" onClick={() => download('png')} disabled={!ready}>
            <Download className="w-3.5 h-3.5 mr-1" /> PNG
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => download('svg')} disabled={!ready}>
            <Download className="w-3.5 h-3.5 mr-1" /> SVG
          </Button>
        </div>
      )}
    </div>
  );
}
