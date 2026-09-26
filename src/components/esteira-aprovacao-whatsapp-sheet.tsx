'use client';

import React from 'react';
import { Send, MessageSquare, ExternalLink, Image as ImageIcon, AlertCircle, Copy, X, UploadCloud, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { gerarLinkWhatsAppAprovacao, gerarMensagemAprovacao, type ConteudoItem, type ArquivoConteudo } from '@/lib/conteudo';

export interface AprovacaoWhatsappSheetProps {
  open: boolean;
  onClose: () => void;
  item: ConteudoItem | null;
  setItem: (item: ConteudoItem | null) => void;
  setItems: React.Dispatch<React.SetStateAction<ConteudoItem[]>>;
  telefone: string;
  setTelefone: (v: string) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  onUploadArquivos: (files: FileList | File[]) => Promise<ArquivoConteudo[]>;
  onCopiarLink: (token: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

/** Envio da demanda para aprovação do cliente pelo WhatsApp. */
export function AprovacaoWhatsappSheet({
  open,
  onClose,
  item: itemParaAprovacao,
  setItem: setItemParaAprovacao,
  setItems,
  telefone: telefoneAprovacaoCustom,
  setTelefone: setTelefoneAprovacaoCustom,
  uploading: uploadingAprovacao,
  setUploading: setUploadingAprovacao,
  onUploadArquivos: handleUploadArquivos,
  onCopiarLink: handleCopiarLinkAprovacao,
  showToast,
}: AprovacaoWhatsappSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      aria-label="Enviar para Aprovação"
    >
      {itemParaAprovacao && (
        <div className="flex flex-col max-h-[85vh] sm:max-h-[88vh] max-w-lg w-full">
          {/* Header Fixo */}
          <div className="p-5 sm:p-6 border-b border-border shrink-0 flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Send className="w-3 h-3 text-brand-text" />
                Aprovação de Conteúdo
              </span>
              <h3 className="text-xl font-bold font-display text-foreground tracking-tight mt-1">
                Enviar no WhatsApp
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {itemParaAprovacao.cliente?.nome || 'Cliente'} · {itemParaAprovacao.titulo || 'Publicação'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onClose()}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conteúdo Rolável */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {/* 1. Verificação de Mídias */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" />
                  <span>Mídias Anexadas à Demanda</span>
                </label>
                <span className="text-xs font-mono text-muted-foreground">
                  {(itemParaAprovacao.arquivos || []).length} {itemParaAprovacao.tipo === 'reel' ? 'vídeo' : 'slide(s)'}
                </span>
              </div>

              {(itemParaAprovacao.arquivos || []).length === 0 ? (
                <div className="p-4 rounded-2xl bg-warning-soft border border-warning-ring flex flex-col gap-3 text-xs">
                  <div className="flex items-start gap-2.5 text-warning">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Nenhuma foto ou vídeo anexado ainda!</p>
                      <p className="text-xs mt-0.5 text-muted-foreground">
                        O cliente precisa visualizar a arte ou vídeo para aprovar. Anexe os arquivos agora:
                      </p>
                    </div>
                  </div>

                  {/* Dropzone rápido dentro do modal de aprovação */}
                  <div className="relative border-2 border-dashed border-warning-ring rounded-xl p-4 text-center bg-card hover:bg-accent/40 cursor-pointer flex flex-col items-center justify-center gap-1.5">
                    <input
                      type="file"
                      multiple={itemParaAprovacao.tipo !== 'reel'}
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                      disabled={uploadingAprovacao}
                      onChange={async (e) => {
                        if (!e.target.files?.length) return;
                        setUploadingAprovacao(true);
                        try {
                          const novos = await handleUploadArquivos(e.target.files);
                          const atualizados = [...(itemParaAprovacao.arquivos || []), ...novos];
                          await fetch(`/api/conteudo/${itemParaAprovacao.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ arquivos: atualizados }),
                          });
                          setItemParaAprovacao({ ...itemParaAprovacao, arquivos: atualizados });
                          setItems((prev) =>
                            prev.map((i) => (i.id === itemParaAprovacao.id ? { ...i, arquivos: atualizados } : i))
                          );
                          showToast(`${novos.length} mídia(s) anexada(s) à demanda!`, 'success');
                        } catch (err: any) {
                          showToast(err.message || 'Erro ao anexar arquivos.', 'error');
                        } finally {
                          setUploadingAprovacao(false);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                    />
                    <UploadCloud className="w-5 h-5 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      {uploadingAprovacao ? 'Enviando arquivos...' : 'Clique para selecionar fotos ou vídeo'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      JPG, PNG ou MP4 da postagem
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-accent/30 border border-border space-y-3">
                  {/* Miniaturas das Mídias */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {itemParaAprovacao.arquivos.map((arq, idx) => (
                      <div
                        key={arq.id || idx}
                        className="relative w-14 h-16 rounded-xl overflow-hidden border border-border shrink-0 shadow-2xs"
                      >
                        {arq.tipo === 'video' ? (
                          <video src={arq.url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={arq.url} alt="" className="w-full h-full object-cover" />
                        )}
                        <span className="absolute bottom-0.5 left-0.5 text-[11px] bg-black/80 text-white font-mono px-1 rounded">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Card de Simulação de Prévia Visual do Link no WhatsApp */}
                  <div className="p-2.5 rounded-xl bg-card border border-border flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-11 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-border">
                        {itemParaAprovacao.arquivos[0]?.tipo === 'video' ? (
                          <video src={itemParaAprovacao.arquivos[0]?.url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={itemParaAprovacao.arquivos[0]?.url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-foreground truncate">
                            {itemParaAprovacao.titulo || 'Publicação'}
                          </span>
                          <span className="text-xs font-mono font-bold bg-lime text-lime-foreground px-2 py-0.5 rounded">
                            {itemParaAprovacao.tipo === 'reel'
                              ? '9:16 Reels'
                              : itemParaAprovacao.tipo === 'story'
                              ? '9:16 Story'
                              : itemParaAprovacao.arquivos.length > 1
                              ? `4:5 Carrossel (${itemParaAprovacao.arquivos.length})`
                              : '4:5 Feed'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          Prévia renderizada sem barras pretas no link do cliente.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {itemParaAprovacao.arquivos[0]?.url && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = itemParaAprovacao.arquivos[0].url;
                            a.download = `previa-${itemParaAprovacao.titulo || 'post'}.jpg`;
                            a.target = '_blank';
                            a.click();
                            showToast('Download da imagem iniciado!', 'success');
                          }}
                          className="text-xs h-7 px-2"
                          title="Baixar capa para anexar direto no WhatsApp se desejar"
                        >
                          Baixar Capa
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          window.open(`/aprovacao/${itemParaAprovacao.token_aprovacao}`, '_blank');
                        }}
                        className="text-xs h-7 px-2 text-primary"
                        title="Abrir como o cliente visualiza"
                      >
                        Ver no Link
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Destinatário no WhatsApp */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span>Destinatário no WhatsApp</span>
              </label>

              {/* Contatos cadastrados no cliente */}
              {(itemParaAprovacao.cliente?.contatos || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {itemParaAprovacao.cliente?.contatos?.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setTelefoneAprovacaoCustom(c.telefone || '')}
                      className={`text-xs px-2.5 py-1 rounded-xl border flex items-center gap-1.5 cursor-pointer transition-ui ${
                        telefoneAprovacaoCustom === (c.telefone || '')
                          ? 'bg-foreground text-background border-foreground font-bold'
                          : 'bg-card text-muted-foreground hover:text-foreground border-border'
                      }`}
                    >
                      <span>{c.nome}</span>
                      {c.e_grupo_whatsapp && (
                        <span className="text-xs bg-brand-soft text-brand-text px-1.5 py-0.5 rounded font-semibold">
                          Grupo
                        </span>
                      )}
                      {c.telefone && <span className="font-mono text-xs opacity-80">({c.telefone})</span>}
                    </button>
                  ))}
                </div>
              )}

              <Input
                placeholder="Número de WhatsApp com DDD (ex: 11987654321)"
                value={telefoneAprovacaoCustom}
                onChange={(e) => setTelefoneAprovacaoCustom(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            {/* 3. Prévia da Mensagem */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>Mensagem Formatada para Envio</span>
              </label>
              <div className="p-3.5 rounded-2xl bg-accent/40 border border-border text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {gerarMensagemAprovacao({
                  nomeCliente: itemParaAprovacao.cliente?.nome || 'Cliente',
                  tituloPost: itemParaAprovacao.titulo || 'Publicação',
                  token: itemParaAprovacao.token_aprovacao,
                }).texto}
              </div>
            </div>
          </div>

          {/* Footer Fixo com Botão WhatsApp Web Imune a Bloqueadores de Popup */}
          <div className="p-4 sm:p-5 border-t border-border shrink-0 bg-card sticky bottom-0 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleCopiarLinkAprovacao(itemParaAprovacao.token_aprovacao);
                }}
                className="text-xs flex-1 sm:flex-none"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copiar Link
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const { texto } = gerarMensagemAprovacao({
                    nomeCliente: itemParaAprovacao.cliente?.nome || 'Cliente',
                    tituloPost: itemParaAprovacao.titulo || 'Publicação',
                    token: itemParaAprovacao.token_aprovacao,
                  });
                  navigator.clipboard.writeText(texto);
                  showToast('Mensagem formatada copiada para o WhatsApp!', 'success');
                }}
                className="text-xs flex-1 sm:flex-none"
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Copiar Texto
              </Button>
            </div>

            {/* Link direto no WhatsApp Web (Abre em nova aba diretamente sem bloqueio do navegador) */}
            <a
              href={gerarLinkWhatsAppAprovacao({
                telefone: telefoneAprovacaoCustom || null,
                nomeCliente: itemParaAprovacao.cliente?.nome || 'Cliente',
                tituloPost: itemParaAprovacao.titulo || 'Publicação',
                token: itemParaAprovacao.token_aprovacao,
                preferWeb: true,
              })}
              target="_blank"
              rel="noopener noreferrer"
              onClick={async () => {
                if (itemParaAprovacao.status !== 'revisao_cliente') {
                  try {
                    await fetch(`/api/conteudo/${itemParaAprovacao.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'revisao_cliente' }),
                    });
                    setItems((prev) =>
                      prev.map((i) =>
                        i.id === itemParaAprovacao.id ? { ...i, status: 'revisao_cliente' } : i
                      )
                    );
                  } catch {
                    // silencioso
                  }
                }
                showToast('WhatsApp Web aberto com sucesso!', 'success');
                onClose();
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-lime hover:bg-lime/90 text-lime-foreground font-bold text-xs shadow-2xs transition-ui cursor-pointer active:scale-[0.98]"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Abrir WhatsApp Web</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </div>
      )}
    </Sheet>
  );
}
