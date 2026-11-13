'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Printer,
  ExternalLink,
  Calendar,
  Layers,
  Sparkles,
  Clapperboard,
  Image as ImageIcon,
  Smartphone,
  Share2,
  X,
  Target,
  FileText,
} from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClienteAvatar } from '@/components/cliente-avatar';
import type { Cliente } from '@/lib/clientes';
import type { ConteudoItem, TipoConteudo } from '@/lib/conteudo';
import { obterLinkAprovacaoPublico } from '@/lib/conteudo';

interface PrestacaoContasModalProps {
  aberto: boolean;
  onFechar: () => void;
  cliente: Cliente;
  mesSelecionado: string; // YYYY-MM
  itensDoMes: ConteudoItem[];
  showToast: (message: string, type: 'success' | 'error') => void;
}

const ROTULO_TIPO: Record<string, string> = {
  post: 'Post Único',
  carrossel: 'Carrossel',
  reel: 'Reels',
  story: 'Story',
};

function formatarDataHora(dataIso: string | null): string {
  if (!dataIso) return 'Data não informada';
  const d = new Date(dataIso.length <= 10 ? `${dataIso}T12:00:00` : dataIso);
  if (Number.isNaN(d.getTime())) return 'Data a definir';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
}

function nomeMesAno(mesYYYYMM: string): string {
  const [ano, mes] = mesYYYYMM.split('-');
  const d = new Date(Number(ano), Number(mes) - 1, 1);
  const nome = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export function EsteiraPrestacaoContasModal({
  aberto,
  onFechar,
  cliente,
  mesSelecionado,
  itensDoMes,
  showToast,
}: PrestacaoContasModalProps) {
  const [copiando, setCopiando] = useState(false);

  const metaContratual = (cliente.posts_mes || 0) + (cliente.reels_mes || 0);
  const entregues = itensDoMes.filter(
    (it) => it.status === 'publicado' || it.status === 'agendamento' || it.status === 'revisao_agendamento' || it.status === 'pronto_publicar' || it.concluida
  );
  const publicados = itensDoMes.filter((it) => it.status === 'publicado');
  const aguardandoCliente = itensDoMes.filter((it) => it.status === 'revisao_cliente');
  const emProducao = itensDoMes.filter(
    (it) =>
      it.status === 'planejamento' ||
      it.status === 'copy' ||
      it.status === 'criacao_arte' ||
      it.status === 'revisao_arte' ||
      it.status === 'em_gravacao' ||
      it.status === 'em_edicao' ||
      it.status === 'revisao_interna' ||
      it.status === 'travado'
  );

  const percentualEntregue = metaContratual > 0 ? Math.min(100, Math.round((entregues.length / metaContratual) * 100)) : 0;
  const token = cliente.token_aprovacao_mes || cliente.id;
  const urlLinkDoMes = `${obterLinkAprovacaoPublico(token, 'mes')}?mes=${mesSelecionado}`;

  function handleCopiarTextoWhatsapp() {
    setCopiando(true);
    const mesFormatado = nomeMesAno(mesSelecionado);

    let texto = `📊 *RELATÓRIO MENSAL DE ENTREGAS — AGÊNCIA GENS*\n`;
    texto += `📅 *Período:* ${mesFormatado}\n`;
    texto += `🏢 *Cliente:* ${cliente.nome}\n`;
    if (metaContratual > 0) {
      texto += `🎯 *Meta Contratada:* ${metaContratual} postagens mensais\n`;
      texto += `✅ *Entregas Realizadas:* ${entregues.length} de ${metaContratual} (${percentualEntregue}% do escopo concluído)\n`;
    } else {
      texto += `✅ *Total de Entregas no Mês:* ${entregues.length} postagens\n`;
    }
    texto += `\n📌 *Resumo das Publicações:*\n`;

    if (entregues.length === 0) {
      texto += `_Nenhuma publicação concluída neste mês até o momento._\n`;
    } else {
      entregues.forEach((it, idx) => {
        const tipoNome = ROTULO_TIPO[it.tipo] || it.tipo;
        const dataStr = formatarDataHora(it.publicado_em || it.data_programada);
        const titulo = it.titulo ? it.titulo.replace(/\n/g, ' ') : 'Publicação sem título';
        const statusIcon = it.status === 'publicado' ? '🟢 Publicado' : '🟣 Agendado/Pronto';
        texto += `${idx + 1}. *[${tipoNome}]* ${titulo}\n   └ ${statusIcon} · ${dataStr}\n`;
      });
    }

    if (aguardandoCliente.length > 0) {
      texto += `\n⏳ *Aguardando sua aprovação:* ${aguardandoCliente.length} postagem(ns).\n`;
    }

    texto += `\n🔗 *Acesse a galeria completa e aprove as demandas no link oficial:*\n${urlLinkDoMes}\n`;
    texto += `\n_Agência GENS · Compromisso e excelência na sua presença digital._`;

    navigator.clipboard.writeText(texto);
    showToast('Relatório de entregas copiado para o WhatsApp!', 'success');
    setTimeout(() => setCopiando(false), 1500);
  }

  function handleImprimir() {
    window.print();
  }

  return (
    <Sheet open={aberto} onClose={onFechar} aria-label="Comprovante de Entregas Mensais" className="w-full max-w-2xl overflow-y-auto">
      <div className="flex flex-col gap-6 p-6">
        {/* Cabeçalho Oficial */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3.5">
            <ClienteAvatar nome={cliente.nome} cor={cliente.cor} fotoUrl={cliente.foto_url} tamanho="lg" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Agência GENS</span>
                <span className="text-xs text-muted-foreground">· Prestação de Contas</span>
              </div>
              <h2 className="text-xl font-bold text-foreground mt-0.5">{cliente.nome}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Comprovante oficial de entregas · {nomeMesAno(mesSelecionado)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Métricas e Meta do Mês */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-card border border-border flex flex-col">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Target className="size-3.5 text-primary" />
              Meta Contratada
            </span>
            <span className="text-2xl font-bold font-mono text-foreground mt-1">
              {metaContratual > 0 ? metaContratual : '—'}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">posts previstos</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col">
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Concluídos
            </span>
            <span className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {entregues.length}
            </span>
            <span className="text-[11px] text-emerald-300/80 mt-0.5">
              {publicados.length} no ar · {entregues.length - publicados.length} agendados
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-card border border-border flex flex-col">
            <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              Em Produção
            </span>
            <span className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {emProducao.length}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">na esteira interna</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-card border border-border flex flex-col">
            <span className="text-xs text-blue-400 font-medium flex items-center gap-1.5">
              <FileText className="size-3.5" />
              No Cliente
            </span>
            <span className="text-2xl font-bold font-mono text-blue-400 mt-1">
              {aguardandoCliente.length}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">para aprovação</span>
          </div>
        </div>

        {/* Barra de Progresso com Meta */}
        {metaContratual > 0 && (
          <div className="p-4 rounded-2xl bg-accent/40 border border-border flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">
                Progresso das Entregas de {nomeMesAno(mesSelecionado)}
              </span>
              <span className="font-mono font-bold text-primary">
                {entregues.length} / {metaContratual} ({percentualEntregue}%)
              </span>
            </div>
            <div className="h-2.5 w-full bg-background rounded-full overflow-hidden border border-border/60">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  percentualEntregue >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-gradient-to-r from-primary to-emerald-500'
                }`}
                style={{ width: `${percentualEntregue}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>0 postagens</span>
              {percentualEntregue >= 100 ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Meta Contratual 100% Batida! 🎯
                </span>
              ) : (
                <span>Faltam {Math.max(0, metaContratual - entregues.length)} postagem(ns) para a meta</span>
              )}
              <span>{metaContratual} postagens</span>
            </div>
          </div>
        )}

        {/* Lista Detalhada das Peças Entregues */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              Relação de Peças Concluídas ({entregues.length})
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              {nomeMesAno(mesSelecionado)}
            </span>
          </div>

          {entregues.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-card/50">
              <p className="text-sm font-medium text-foreground">Nenhuma peça entregue ainda neste mês.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Conforme as demandas forem aprovadas, agendadas ou publicadas, elas aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
              {entregues.map((item, idx) => {
                const tipoRotulo = ROTULO_TIPO[item.tipo] || item.tipo;
                const dataFormatada = formatarDataHora(item.publicado_em || item.data_programada);
                const thumb = item.arquivos && item.arquivos.length > 0 ? item.arquivos[0].url : item.cover_url;

                return (
                  <div key={item.id} className="flex items-center gap-3.5 p-3.5 hover:bg-accent/30 transition-colors">
                    <span className="text-xs font-mono font-bold text-muted-foreground w-5 text-right shrink-0">
                      #{idx + 1}
                    </span>

                    {/* Thumbnail */}
                    <div className="size-11 rounded-xl bg-accent overflow-hidden shrink-0 border border-border flex items-center justify-center">
                      {thumb ? (
                        <img src={thumb} alt="" className="size-full object-cover" />
                      ) : (
                        <ImageIcon className="size-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Dados */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-accent text-foreground border border-border shrink-0">
                          {tipoRotulo}
                        </span>
                        <span className="text-xs font-bold text-foreground truncate">
                          {item.titulo || 'Publicação sem título'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {dataFormatada}
                        </span>
                        <span>·</span>
                        <span className={item.status === 'publicado' ? 'text-emerald-400 font-medium' : 'text-blue-400 font-medium'}>
                          {item.status === 'publicado' ? 'Publicado no Feed' : 'Agendado / Pronto'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé de Ações de Prestação de Contas */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImprimir}
            className="rounded-xl text-xs h-9 font-semibold"
          >
            <Printer className="size-3.5 mr-1.5" />
            Imprimir / Salvar PDF
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(urlLinkDoMes, '_blank')}
              className="rounded-xl text-xs h-9 font-semibold"
            >
              <ExternalLink className="size-3.5 mr-1.5" />
              Ver no Link do Mês
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCopiarTextoWhatsapp}
              className="rounded-xl text-xs h-9 font-bold bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]"
            >
              <Share2 className="size-3.5 mr-1.5" />
              {copiando ? 'Copiado!' : 'Copiar para WhatsApp'}
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
