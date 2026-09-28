'use client';

import React, { useState } from 'react';
import { ImageIcon, Maximize2, Trash2, UploadCloud } from 'lucide-react';
import { uploadMediaFile } from '@/lib/storage-upload';

/**
 * Capa do Reels: uma imagem só, separada do vídeo. Vai para `conteudo_items.cover_url`
 * e é usada na prévia do link de aprovação (WhatsApp) e no agendamento.
 */
export function CapaReelsField({
  url,
  onChange,
  onPreview,
  onErro,
}: {
  url: string | null;
  onChange: (url: string | null) => void;
  onPreview: (url: string) => void;
  onErro: (mensagem: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) {
      onErro('A capa precisa ser uma imagem (JPG, PNG ou WebP).');
      return;
    }
    setEnviando(true);
    try {
      const res = await uploadMediaFile(arquivo, 'conteudo');
      onChange(res.url);
    } catch (err) {
      onErro(err instanceof Error ? err.message : 'Erro ao enviar a capa.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="p-2.5 rounded-xl bg-accent/20 border border-border text-xs text-muted-foreground">
        Imagem de capa do Reels (9:16). Ela aparece na grade do perfil, na prévia do link de aprovação e é usada no agendamento.
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="relative w-36 aspect-[9/16] rounded-xl overflow-hidden border border-border bg-accent/30 shrink-0 grid place-items-center">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Capa do Reels" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <label className="relative border-2 border-dashed border-border hover:border-foreground/30 rounded-2xl p-4 text-center bg-accent/20 hover:bg-accent/40 cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-colors">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleArquivo}
              disabled={enviando}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
              aria-label={url ? 'Trocar capa' : 'Enviar capa'}
            />
            <UploadCloud className="w-4 h-4 text-primary" aria-hidden />
            <span className="text-xs font-bold text-foreground">
              {enviando ? 'Enviando capa…' : url ? 'Clique para trocar a capa' : 'Clique ou arraste a imagem da capa'}
            </span>
            <span className="text-xs text-muted-foreground font-mono">JPG, PNG ou WebP · ideal 1080×1920</span>
          </label>

          {url && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPreview(url)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" /> Ver em tamanho real
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remover capa
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
