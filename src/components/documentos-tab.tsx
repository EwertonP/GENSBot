'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { HeroGradientPanel, HeroKpiCard } from '@/components/ui/hero-gradient-panel';
import {
  FileText,
  FileSignature,
  FileCheck2,
  Clock,
  Plus,
  Search,
  ExternalLink,
  Copy,
  MessageCircle,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Send,
  Calendar,
  DollarSign,
  Trash2,
  Edit,
  Library,
  Eye,
  Check,
  Filter,
  RefreshCw,
  Info,
  PenTool,
  Hash,
  Loader2,
  Ban,
  History,
  Download,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EditorRico } from '@/components/ui/editor-rico';
import {
  VARIAVEIS_DISPONIVEIS,
  interpolarVariaveis,
  obterModelosPadrao,
  MODELOS_PROPOSTAS_PADRAO,
  MODELOS_CONTRATOS_PADRAO,
} from '@/lib/documentos-modelos';
import type {
  Proposta,
  Contrato,
  ModeloDocumento,
  DadosAgenciaContratada,
  StatusProposta,
  StatusContrato,
  CategoriaDocumento,
} from '@/types/documentos';

type SubAba = 'propostas' | 'contratos' | 'modelos';

// Helper para garantir links canônicos públicos seguros para compartilhamento e prévia no WhatsApp
function obterLinkPublicoCanonica(caminho: string): string {
  let base = typeof window !== 'undefined' ? window.location.origin : '';
  if (!base || base.includes('localhost') || base.includes('127.0.0.1')) {
    base =
      process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')
        ? process.env.NEXT_PUBLIC_APP_URL
        : 'https://allingens.vercel.app';
  }
  return `${base.replace(/\/$/, '')}${caminho}`;
}

export function DocumentosTab() {
  const [subAba, setSubAba] = useState<SubAba>('propostas');
  const [carregando, setCarregando] = useState(true);

  // Dados principais
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [modelos, setModelos] = useState<ModeloDocumento[]>([]);
  const [agencia, setAgencia] = useState<DadosAgenciaContratada | null>(null);
  const [agenciaCompleta, setAgenciaCompleta] = useState(true);
  const [camposFaltantes, setCamposFaltantes] = useState<string[]>([]);

  // Listas auxiliares (clientes e leads)
  const [clientes, setClientes] = useState<{ id: string; nome: string; cnpj_cpf?: string; responsavel_legal?: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; titulo: string; nome_contato: string; empresa?: string; telefone?: string }[]>([]);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatusProposta, setFiltroStatusProposta] = useState<string>('todos');
  const [filtroStatusContrato, setFiltroStatusContrato] = useState<string>('todos');
  const [filtroTipoModelo, setFiltroTipoModelo] = useState<'todos' | 'proposta' | 'contrato'>('todos');

  // Modais de Criação e Configuração
  const [modalAgenciaAberto, setModalAgenciaAberto] = useState(false);
  const [modalNovaPropostaAberto, setModalNovaPropostaAberto] = useState(false);
  const [modalNovoContratoAberto, setModalNovoContratoAberto] = useState(false);
  const [modalVisualizarModelo, setModalVisualizarModelo] = useState<ModeloDocumento | null>(null);
  const [modalCertificadoContrato, setModalCertificadoContrato] = useState<Contrato | null>(null);

  // Novos Modais do Plano de Contratos (Envio, Contra-assinatura, Auditoria e Revogação)
  const [modalEnviarContrato, setModalEnviarContrato] = useState<Contrato | null>(null);
  const [enviandoContrato, setEnviandoContrato] = useState(false);
  const [dadosEnvioContrato, setDadosEnvioContrato] = useState<{ link: string; textoWhatsapp: string; expira_em: string } | null>(null);

  const [modalContraAssinar, setModalContraAssinar] = useState<Contrato | null>(null);
  const [nomeContraAssinante, setNomeContraAssinante] = useState('');
  const [processandoContraAssinatura, setProcessandoContraAssinatura] = useState(false);

  const [modalEventosContrato, setModalEventosContrato] = useState<{ contrato: Contrato; eventos: any[]; carregando: boolean } | null>(null);
  const [modalRevogarContrato, setModalRevogarContrato] = useState<Contrato | null>(null);
  const [processandoRevogacao, setProcessandoRevogacao] = useState(false);

  // Form de Nova Proposta
  const [formProposta, setFormProposta] = useState({
    modelo_id: '',
    cliente_id: '',
    lead_id: '',
    titulo: '',
    valor_mensal: '',
    valor_setup: '',
    validade: '',
    conteudo_html: '',
  });

  // Form de Novo Contrato
  const [formContrato, setFormContrato] = useState({
    modelo_id: '',
    proposta_id: '',
    cliente_id: '',
    lead_id: '',
    titulo: '',
    valor_mensal: '',
    dia_vencimento: '10',
    data_inicio: new Date().toISOString().slice(0, 10),
    data_termino: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    renovacao_automatica: true,
    conteudo_html: '',
  });

  // Form de Dados da Agência
  const [formAgencia, setFormAgencia] = useState<DadosAgenciaContratada>({
    nome: '',
    razao_social: '',
    cnpj_cpf: '',
    endereco: '',
    cidade_estado: '',
    chave_pix: '',
    telefone_contato: '',
    email_contato: '',
    whatsapp_envio_automatico: false,
  });

  // Carregar dados iniciais
  const recarregarTudo = async () => {
    try {
      setCarregando(true);
      const [resAgencia, resPropostas, resContratos, resModelos, resClientes, resLeads] = await Promise.all([
        fetch('/api/agencia/perfil').then((r) => r.json()).catch(() => ({})),
        fetch('/api/propostas').then((r) => r.json()).catch(() => ({ propostas: [] })),
        fetch('/api/contratos').then((r) => r.json()).catch(() => ({ contratos: [] })),
        fetch('/api/documentos/modelos').then((r) => r.json()).catch(() => ({ modelos: [] })),
        fetch('/api/clientes').then((r) => r.json()).catch(() => ({ clientes: [] })),
        fetch('/api/crm/negocios').then((r) => r.json()).catch(() => ({ negocios: [] })),
      ]);

      if (resAgencia.agencia) {
        setAgencia(resAgencia.agencia);
        setFormAgencia(resAgencia.agencia);
        setAgenciaCompleta(resAgencia.completo ?? true);
        setCamposFaltantes(resAgencia.faltantes || []);
      }

      setPropostas(resPropostas.propostas || []);
      setContratos(resContratos.contratos || []);
      setModelos(resModelos.modelos || obterModelosPadrao());
      setClientes(resClientes.clientes || []);
      setLeads(resLeads.negocios || []);
    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
      toast.error('Não foi possível carregar os dados de propostas e contratos.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    recarregarTudo();
  }, []);

  // Salvar perfil da agência
  async function handleSalvarAgencia(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/agencia/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formAgencia),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar agência.');

      setAgencia(data.agencia);
      setAgenciaCompleta(data.completo);
      setCamposFaltantes(data.faltantes);
      setModalAgenciaAberto(false);
      toast.success('Dados cadastrais da agência atualizados!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
    }
  }

  // Criar proposta
  async function handleCriarProposta(e: React.FormEvent) {
    e.preventDefault();
    if (!formProposta.titulo.trim() || !formProposta.conteudo_html.trim()) {
      toast.error('Preencha o título e o conteúdo da proposta.');
      return;
    }

    try {
      const res = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo_id: formProposta.modelo_id || undefined,
          cliente_id: formProposta.cliente_id || undefined,
          lead_id: formProposta.lead_id || undefined,
          titulo: formProposta.titulo,
          valor_mensal: parseFloat(formProposta.valor_mensal.replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
          valor_setup: parseFloat(formProposta.valor_setup.replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
          validade: formProposta.validade || undefined,
          conteudo_html: formProposta.conteudo_html,
          status: 'enviada',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar proposta.');

      setPropostas((prev) => [data.proposta, ...prev]);
      setModalNovaPropostaAberto(false);
      toast.success('Proposta criada e pronta para envio!');

      const urlPublica = `${window.location.origin}/proposta/${data.proposta.token_publico}`;
      navigator.clipboard.writeText(urlPublica);
      toast.success('Link público da proposta copiado!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar proposta.');
    }
  }

  // Criar contrato (inicia como rascunho ou pronto para envio)
  async function handleCriarContrato(e: React.FormEvent) {
    e.preventDefault();
    if (!formContrato.titulo.trim() || !formContrato.conteudo_html.trim()) {
      toast.error('Preencha o título e as cláusulas do contrato.');
      return;
    }

    try {
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo_id: formContrato.modelo_id || undefined,
          proposta_id: formContrato.proposta_id || undefined,
          cliente_id: formContrato.cliente_id || undefined,
          lead_id: formContrato.lead_id || undefined,
          titulo: formContrato.titulo,
          valor_mensal: parseFloat(formContrato.valor_mensal.replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
          dia_vencimento: parseInt(formContrato.dia_vencimento, 10) || 10,
          data_inicio: formContrato.data_inicio || undefined,
          data_termino: formContrato.data_termino || undefined,
          renovacao_automatica: formContrato.renovacao_automatica,
          conteudo_html: formContrato.conteudo_html,
          status: 'rascunho',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar contrato.');

      setContratos((prev) => [data.contrato, ...prev]);
      setModalNovoContratoAberto(false);
      toast.success('Contrato criado com sucesso!');

      // Abre automaticamente o modal de envio/congelamento
      abrirModalEnvio(data.contrato);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar contrato.');
    }
  }

  // Abrir Modal de Envio e Congelar Documento
  async function abrirModalEnvio(contrato: Contrato) {
    setModalEnviarContrato(contrato);
    setDadosEnvioContrato(null);
    setEnviandoContrato(true);

    try {
      const res = await fetch(`/api/contratos/${contrato.id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canal: 'link' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao congelar e enviar contrato.');

      setDadosEnvioContrato({
        link: data.link,
        textoWhatsapp: data.textoWhatsapp,
        expira_em: data.expira_em,
      });

      // Atualiza contrato na lista local
      setContratos((prev) =>
        prev.map((c) =>
          c.id === contrato.id
            ? {
                ...c,
                status: 'aguardando_assinatura',
                hash_documento: data.hash_documento,
                expira_em: data.expira_em,
                enviado_em: new Date().toISOString(),
              }
            : c
        )
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao preparar envio do contrato.');
    } finally {
      setEnviandoContrato(false);
    }
  }

  // Contra-assinar como Agência
  async function handleConfirmarContraAssinatura() {
    if (!modalContraAssinar) return;

    try {
      setProcessandoContraAssinatura(true);
      const res = await fetch(`/api/contratos/${modalContraAssinar.id}/contra-assinar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_signatario: nomeContraAssinante.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao contra-assinar contrato.');

      toast.success('Contrato contra-assinado com sucesso!');
      toast.success('Integrações com CRM (negócio ganho) e Financeiro (receita mensal) foram ativadas!');

      setContratos((prev) =>
        prev.map((c) => (c.id === modalContraAssinar.id ? { ...c, ...data.contrato } : c))
      );
      setModalContraAssinar(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao contra-assinar.');
    } finally {
      setProcessandoContraAssinatura(false);
    }
  }

  // Abrir Histórico de Eventos / Trilha de Auditoria
  async function abrirEventosContrato(contrato: Contrato) {
    setModalEventosContrato({ contrato, eventos: [], carregando: true });
    try {
      const res = await fetch(`/api/contratos/${contrato.id}/eventos`);
      const data = await res.json();
      setModalEventosContrato({ contrato, eventos: data.eventos || [], carregando: false });
    } catch {
      setModalEventosContrato({ contrato, eventos: [], carregando: false });
      toast.error('Não foi possível carregar a trilha de auditoria.');
    }
  }

  // Revogar / Cancelar Contrato
  async function handleConfirmarRevogacao() {
    if (!modalRevogarContrato) return;
    try {
      setProcessandoRevogacao(true);
      const res = await fetch(`/api/contratos/${modalRevogarContrato.id}/revogar`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao revogar contrato.');

      setContratos((prev) =>
        prev.map((c) => (c.id === modalRevogarContrato.id ? { ...c, status: 'cancelado' } : c))
      );
      toast.success('Contrato cancelado e link público revogado.');
      setModalRevogarContrato(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao revogar contrato.');
    } finally {
      setProcessandoRevogacao(false);
    }
  }

  // Gerar Contrato a partir de Proposta
  async function gerarContratoDaProposta(propostaId: string) {
    try {
      const res = await fetch(`/api/propostas/${propostaId}/gerar-contrato`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao converter proposta em contrato.');

      toast.success('Contrato gerado a partir da proposta aprovada!');
      recarregarTudo();
      setSubAba('contratos');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar contrato.');
    }
  }

  // Excluir proposta
  async function excluirProposta(id: string) {
    if (!confirm('Deseja realmente excluir esta proposta comercial?')) return;
    try {
      const res = await fetch(`/api/propostas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Não foi possível excluir.');
      setPropostas((prev) => prev.filter((p) => p.id !== id));
      toast.success('Proposta removida.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  // Excluir contrato
  async function excluirContrato(id: string) {
    if (!confirm('Deseja realmente excluir este contrato?')) return;
    try {
      const res = await fetch(`/api/contratos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Não foi possível excluir.');
      setContratos((prev) => prev.filter((c) => c.id !== id));
      toast.success('Contrato removido.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  // Copiar link com feedback
  function copiarLink(url: string, mensagem = 'Link copiado para a área de transferência!') {
    navigator.clipboard.writeText(url);
    toast.success(mensagem);
  }

  // Selecionar Modelo para Nova Proposta
  function selecionarModeloProposta(modelo: ModeloDocumento) {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const htmlInterpolado = interpolarVariaveis(modelo.conteudo_html, {
      agencia_nome: agencia?.nome || 'Nossa Agência',
      agencia_razao_social: agencia?.razao_social || agencia?.nome || 'Nossa Agência LTDA',
      agencia_cnpj: agencia?.cnpj_cpf || '00.000.000/0001-00',
      agencia_endereco: agencia?.endereco || 'Endereço da Agência',
      agencia_cidade_estado: agencia?.cidade_estado || 'São Paulo - SP',
      agencia_email: agencia?.email_contato || 'contato@agencia.com.br',
      agencia_telefone: agencia?.telefone_contato || '(11) 99999-9999',
      agencia_pix: agencia?.chave_pix || 'Chave PIX da Agência',
      cliente_nome: '[Nome do Cliente]',
      cliente_responsavel: '[Responsável]',
      valor_mensal: 'R$ 2.500,00',
      valor_setup: 'R$ 1.000,00',
      dia_vencimento: 10,
      vigencia: '12 meses',
      validade_proposta: '15 dias',
      data_hoje: hoje,
    });

    setFormProposta((prev) => ({
      ...prev,
      modelo_id: modelo.id,
      titulo: modelo.titulo.replace('Proposta Comercial - ', ''),
      conteudo_html: htmlInterpolado,
    }));
  }

  // Selecionar Modelo para Novo Contrato
  function selecionarModeloContrato(modelo: ModeloDocumento) {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const htmlInterpolado = interpolarVariaveis(modelo.conteudo_html, {
      agencia_nome: agencia?.nome || 'Nossa Agência',
      agencia_razao_social: agencia?.razao_social || agencia?.nome || 'Nossa Agência LTDA',
      agencia_cnpj: agencia?.cnpj_cpf || '00.000.000/0001-00',
      agencia_endereco: agencia?.endereco || 'Endereço da Agência',
      agencia_cidade_estado: agencia?.cidade_estado || 'São Paulo - SP',
      agencia_email: agencia?.email_contato || 'contato@agencia.com.br',
      agencia_telefone: agencia?.telefone_contato || '(11) 99999-9999',
      agencia_pix: agencia?.chave_pix || 'Chave PIX da Agência',
      cliente_nome: '[Nome do Cliente]',
      cliente_doc: '[CNPJ ou CPF]',
      cliente_responsavel: '[Responsável]',
      cliente_endereco: '[Endereço do Cliente]',
      valor_mensal: 'R$ 2.500,00',
      dia_vencimento: 10,
      vigencia: '12 meses',
      data_inicio: new Date().toLocaleDateString('pt-BR'),
      data_termino: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      data_hoje: hoje,
    });

    setFormContrato((prev) => ({
      ...prev,
      modelo_id: modelo.id,
      titulo: modelo.titulo,
      conteudo_html: htmlInterpolado,
    }));
  }

  // Cálculos de KPIs expandidos
  const kpis = useMemo(() => {
    const ativas = propostas.filter((p) => p.status === 'enviada').length;
    const aguardandoCliente = contratos.filter((c) => c.status === 'aguardando_assinatura').length;
    const suaAssinatura = contratos.filter((c) => c.status === 'assinado_cliente').length;
    const assinados = contratos.filter((c) => c.status === 'assinado').length;
    const rascunhos = contratos.filter((c) => c.status === 'rascunho').length;

    const hoje = new Date().toISOString().slice(0, 10);
    const em30Dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const renovando = contratos.filter(
      (c) => c.status === 'assinado' && c.data_termino && c.data_termino >= hoje && c.data_termino <= em30Dias
    ).length;

    return { ativas, aguardandoCliente, suaAssinatura, assinados, rascunhos, renovando };
  }, [propostas, contratos]);

  // Filtros aplicados
  const propostasFiltradas = useMemo(() => {
    return propostas.filter((p) => {
      if (filtroStatusProposta !== 'todos' && p.status !== filtroStatusProposta) return false;
      if (busca.trim()) {
        const b = busca.toLowerCase();
        return (
          p.titulo.toLowerCase().includes(b) ||
          p.cliente?.nome.toLowerCase().includes(b) ||
          p.lead?.nome_contato.toLowerCase().includes(b)
        );
      }
      return true;
    });
  }, [propostas, filtroStatusProposta, busca]);

  const contratosFiltrados = useMemo(() => {
    return contratos.filter((c) => {
      if (filtroStatusContrato !== 'todos' && c.status !== filtroStatusContrato) return false;
      if (busca.trim()) {
        const b = busca.toLowerCase();
        return (
          c.titulo.toLowerCase().includes(b) ||
          c.cliente?.nome.toLowerCase().includes(b) ||
          c.lead?.nome_contato.toLowerCase().includes(b)
        );
      }
      return true;
    });
  }, [contratos, filtroStatusContrato, busca]);

  const modelosFiltrados = useMemo(() => {
    return modelos.filter((m) => {
      if (filtroTipoModelo !== 'todos' && m.tipo !== filtroTipoModelo) return false;
      if (busca.trim()) {
        const b = busca.toLowerCase();
        return m.titulo.toLowerCase().includes(b) || (m.descricao && m.descricao.toLowerCase().includes(b));
      }
      return true;
    });
  }, [modelos, filtroTipoModelo, busca]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Banner de Dados da Agência Incompletos */}
      {!agenciaCompleta && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block text-sm">
                Complete o cadastro da sua agência como CONTRATADA
              </span>
              <span className="opacity-90">
                Faltam estes dados para emitir propostas e contratos com validade legal:{' '}
                <strong>{camposFaltantes.join(', ')}</strong>.
              </span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setModalAgenciaAberto(true)}
            className="h-8 rounded-full text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 shrink-0"
          >
            Completar agora
          </Button>
        </div>
      )}

      {/* Banner Hero Gradient de KPIs Rápidos */}
      <HeroGradientPanel
        eyebrow="Jurídico & Fechamento"
        title="Propostas & Contratos"
        badge={`${kpis.assinados} contrato(s) assinado(s)`}
        badgeIcon={ShieldCheck}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <HeroKpiCard label="Propostas Ativas" icon={Send} iconTone="sky" value={kpis.ativas} />
          <HeroKpiCard label="Aguardando Cliente" icon={FileSignature} iconTone="amber" valueTone="warning" value={kpis.aguardandoCliente} />
          <HeroKpiCard label="Sua Assinatura" icon={PenTool} iconTone="primary" valueTone="primary" value={kpis.suaAssinatura} />
          <HeroKpiCard label="Contratos Assinados" icon={ShieldCheck} iconTone="emerald" valueTone="success" value={kpis.assinados} />
          <HeroKpiCard label="Rascunhos" icon={FileText} iconTone="violet" value={kpis.rascunhos} />
          <HeroKpiCard label="Renovam em 30d" icon={Clock} iconTone="rose" value={kpis.renovando} />
        </div>
      </HeroGradientPanel>

      {/* Navegação por SubAbas & Ações Principais */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-border pb-3 gap-3">
        <div className="flex items-center gap-1.5 bg-muted p-1 rounded-full border border-border w-fit overflow-x-auto max-w-full">
          <button
            onClick={() => setSubAba('propostas')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              subAba === 'propostas'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Propostas Comerciais ({propostas.length})
          </button>
          <button
            onClick={() => setSubAba('contratos')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              subAba === 'contratos'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Contratos Digitais ({contratos.length})
          </button>
          <button
            onClick={() => setSubAba('modelos')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              subAba === 'modelos'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Modelos ({modelos.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Campo de Busca Rápida */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título ou cliente..."
              className="w-full h-9 pl-9 pr-4 rounded-full border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalAgenciaAberto(true)}
            className="gap-2 h-9 rounded-full text-xs font-semibold border-border bg-card text-foreground hover:bg-muted"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Dados da Agência</span>
            {!agenciaCompleta && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </Button>

          {subAba === 'propostas' && (
            <Button
              onClick={() => {
                selecionarModeloProposta(modelos.find((m) => m.tipo === 'proposta') || MODELOS_PROPOSTAS_PADRAO[0] as unknown as ModeloDocumento);
                setModalNovaPropostaAberto(true);
              }}
              className="gap-1.5 h-9 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Proposta</span>
            </Button>
          )}

          {subAba === 'contratos' && (
            <Button
              onClick={() => {
                selecionarModeloContrato(modelos.find((m) => m.tipo === 'contrato') || MODELOS_CONTRATOS_PADRAO[0] as unknown as ModeloDocumento);
                setModalNovoContratoAberto(true);
              }}
              className="gap-1.5 h-9 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Contrato</span>
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUB-ABA: PROPOSTAS */}
      {/* ------------------------------------------------------------- */}
      {subAba === 'propostas' && (
        <div className="space-y-4">
          {/* Filtros de Status */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {['todos', 'enviada', 'aceita', 'recusada'].map((st) => (
              <button
                key={st}
                onClick={() => setFiltroStatusProposta(st)}
                className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer capitalize ${
                  filtroStatusProposta === st
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {st === 'todos' ? 'Todas' : st === 'enviada' ? 'Enviadas' : st === 'aceita' ? 'Aprovadas' : 'Ajustes Pedidos'}
              </button>
            ))}
          </div>

          {propostasFiltradas.length === 0 ? (
            <div className="bg-card text-card-foreground rounded-3xl p-12 text-center border border-border">
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-foreground mb-1">Nenhuma proposta encontrada</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
                {busca ? 'Nenhum resultado para os termos pesquisados.' : 'Comece gerando uma nova proposta comercial a partir dos modelos padrão.'}
              </p>
              <Button
                onClick={() => {
                  selecionarModeloProposta(modelos.find((m) => m.tipo === 'proposta') || MODELOS_PROPOSTAS_PADRAO[0] as unknown as ModeloDocumento);
                  setModalNovaPropostaAberto(true);
                }}
                className="rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
              >
                Criar Nova Proposta
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {propostasFiltradas.map((p) => {
                const linkPublico = obterLinkPublicoCanonica(`/proposta/${p.token_publico}`);
                const clienteNome = p.cliente?.nome || p.lead?.empresa || p.lead?.nome_contato || 'Cliente não vinculado';
                const telefone = p.lead?.telefone;

                return (
                  <div
                    key={p.id}
                    className="bg-card text-card-foreground rounded-3xl p-5 border border-border hover:border-border-strong shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground truncate block">
                          {clienteNome}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize shrink-0 ${
                            p.status === 'aceita'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : p.status === 'recusada'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                              : p.status === 'enviada'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {p.status === 'aceita' ? 'Aprovada' : p.status === 'recusada' ? 'Ajustes Pedidos' : p.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-foreground mb-3 leading-snug">
                        {p.titulo}
                      </h4>

                      <div className="flex items-center gap-4 text-xs mb-4 text-muted-foreground">
                        {p.valor_mensal > 0 && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Mensalidade</span>
                            <span className="font-semibold text-foreground">
                              R$ {Number(p.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {p.valor_setup > 0 && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Setup</span>
                            <span className="font-semibold text-foreground">
                              R$ {Number(p.valor_setup).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {p.validade && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Validade</span>
                            <span className="font-medium text-foreground">
                              {new Date(p.validade).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Barra de Ações Rápidas */}
                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copiarLink(linkPublico, 'Link da proposta copiado!')}
                          className="h-8 rounded-full text-[11px] font-medium px-2.5 border-border bg-card text-foreground hover:bg-muted"
                          title="Copiar Link Público"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          <span>Link</span>
                        </Button>

                        <a
                          href={linkPublico}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center h-8 px-2.5 rounded-full border border-border text-[11px] font-medium hover:bg-muted text-foreground transition-colors"
                          title="Abrir Visualização do Cliente"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {p.status === 'aceita' && !p.contrato_gerado_id && (
                          <Button
                            size="sm"
                            onClick={() => gerarContratoDaProposta(p.id)}
                            className="h-8 rounded-full text-[11px] font-semibold bg-primary text-primary-foreground hover:opacity-90"
                          >
                            <FileSignature className="w-3.5 h-3.5 mr-1" />
                            <span>Gerar Contrato</span>
                          </Button>
                        )}

                        <button
                          onClick={() => excluirProposta(p.id)}
                          className="p-1.5 rounded-full text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                          title="Excluir Proposta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-ABA: CONTRATOS */}
      {/* ------------------------------------------------------------- */}
      {subAba === 'contratos' && (
        <div className="space-y-4">
          {/* Filtros de Status (Orkestrya replica + Plano GENSBot) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'rascunho', label: 'Rascunhos' },
              { id: 'aguardando_assinatura', label: 'Aguardando Cliente' },
              { id: 'assinado_cliente', label: 'Sua Assinatura' },
              { id: 'assinado', label: 'Assinados' },
              { id: 'cancelado', label: 'Cancelados' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFiltroStatusContrato(st.id)}
                className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                  filtroStatusContrato === st.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {contratosFiltrados.length === 0 ? (
            <div className="bg-card text-card-foreground rounded-3xl p-12 text-center border border-border">
              <FileSignature className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-foreground mb-1">Nenhum contrato encontrado</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
                {busca ? 'Nenhum resultado para os termos pesquisados.' : 'Elabore contratos profissionais prontos para assinatura digital.'}
              </p>
              <Button
                onClick={() => {
                  selecionarModeloContrato(modelos.find((m) => m.tipo === 'contrato') || MODELOS_CONTRATOS_PADRAO[0] as unknown as ModeloDocumento);
                  setModalNovoContratoAberto(true);
                }}
                className="rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
              >
                Criar Novo Contrato
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contratosFiltrados.map((c) => {
                const linkAssinatura = obterLinkPublicoCanonica(`/contrato/${c.token_publico}`);
                const clienteNome = c.cliente?.nome || c.lead?.empresa || c.lead?.nome_contato || 'Cliente não vinculado';
                const telefone = c.lead?.telefone;
                const assinado = c.status === 'assinado';
                const assinadoCliente = c.status === 'assinado_cliente';
                const aguardando = c.status === 'aguardando_assinatura';
                const rascunho = c.status === 'rascunho';
                const cancelado = c.status === 'cancelado';

                return (
                  <div
                    key={c.id}
                    className="bg-card text-card-foreground rounded-3xl p-5 border border-border hover:border-border-strong shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground truncate block">
                          {clienteNome}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize shrink-0 ${
                            assinado
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : assinadoCliente
                              ? 'bg-primary/10 text-primary border border-primary/20 animate-pulse'
                              : aguardando
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                              : cancelado
                              ? 'bg-destructive/10 text-destructive border border-destructive/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {assinado
                            ? 'Assinado por Ambos'
                            : assinadoCliente
                            ? 'Sua Contra-assinatura'
                            : aguardando
                            ? 'Aguardando Cliente'
                            : cancelado
                            ? 'Cancelado'
                            : 'Rascunho'}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-foreground mb-3 leading-snug">
                        {c.titulo}
                      </h4>

                      <div className="flex items-center gap-4 text-xs mb-3 text-muted-foreground">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Fee Mensal</span>
                          <span className="font-semibold text-foreground">
                            R$ {Number(c.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {c.dia_vencimento && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Vencimento</span>
                            <span className="font-medium text-foreground">Todo dia {c.dia_vencimento}</span>
                          </div>
                        )}
                        {c.data_inicio && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Vigência</span>
                            <span className="font-medium text-foreground">
                              {new Date(c.data_inicio).toLocaleDateString('pt-BR')} até{' '}
                              {c.data_termino ? new Date(c.data_termino).toLocaleDateString('pt-BR') : 'Indeterminado'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Rastreamento de Visualização do Link */}
                      <div className="mb-3.5">
                        {c.visualizado_em ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visualizado pelo cliente em {new Date(c.visualizado_em).toLocaleDateString('pt-BR')}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground text-[11px] font-medium border border-border">
                            <Eye className="w-3.5 h-3.5 opacity-50" />
                            <span>Link não aberto pelo cliente ainda</span>
                          </span>
                        )}
                      </div>

                      {/* Notificação de Contra-assinatura Pendente */}
                      {assinadoCliente && (
                        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3 mb-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <PenTool className="w-4 h-4 text-primary shrink-0" />
                            <div className="text-xs truncate">
                              <span className="font-bold text-foreground block truncate">
                                O cliente assinou ({c.assinatura_cliente_nome})
                              </span>
                              <span className="text-muted-foreground block text-[11px] truncate">
                                Contra-assine para formalizar e ativar o Financeiro
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setNomeContraAssinante(agencia?.nome || '');
                              setModalContraAssinar(c);
                            }}
                            className="h-8 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 shrink-0"
                          >
                            Contra-assinar
                          </Button>
                        </div>
                      )}

                      {/* Certificado de assinatura resumo */}
                      {assinado && (
                        <div className="bg-emerald-500/10 rounded-xl p-2.5 border border-emerald-500/20 text-[11px] text-foreground mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="truncate">
                              Assinado por <strong>{c.assinatura_cliente_nome}</strong> & Agência
                            </span>
                          </div>
                          <button
                            onClick={() => setModalCertificadoContrato(c)}
                            className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline shrink-0 text-[10px] cursor-pointer"
                          >
                            Ver Certificado
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Barra de Ações Rápidas */}
                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copiarLink(linkAssinatura, 'Link de assinatura copiado!')}
                          className="h-8 rounded-full text-[11px] font-medium px-2.5 border-border bg-card text-foreground hover:bg-muted"
                          title="Copiar Link de Assinatura"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          <span>Link</span>
                        </Button>

                        {!assinado && !cancelado && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirModalEnvio(c)}
                            className="h-8 rounded-full text-[11px] font-medium px-2.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30"
                            title="Enviar ou Compartilhar no WhatsApp"
                          >
                            <Send className="w-3.5 h-3.5 mr-1" />
                            <span>Enviar</span>
                          </Button>
                        )}

                        <a
                          href={linkAssinatura}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center h-8 px-2.5 rounded-full border border-border text-[11px] font-medium hover:bg-muted text-foreground transition-colors"
                          title="Abrir Visualização do Cliente"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <a
                          href={`/api/contratos/${c.id}/pdf`}
                          download={`contrato-${c.numero || c.id.slice(0, 8)}.pdf`}
                          className="inline-flex items-center justify-center h-8 px-2.5 rounded-full border border-border text-[11px] font-medium hover:bg-muted text-foreground transition-colors"
                          title="Baixar PDF Oficial com Evidências"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          <span>PDF</span>
                        </a>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => abrirEventosContrato(c)}
                          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Ver Trilha de Auditoria e Eventos"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        {!assinado && !cancelado && (
                          <button
                            onClick={() => setModalRevogarContrato(c)}
                            className="p-1.5 rounded-full text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                            title="Revogar Link / Cancelar Contrato"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => excluirContrato(c.id)}
                          className="p-1.5 rounded-full text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                          title="Excluir Contrato"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUB-ABA: MODELOS */}
      {/* ------------------------------------------------------------- */}
      {subAba === 'modelos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setFiltroTipoModelo('todos')}
                className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                  filtroTipoModelo === 'todos'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Todos ({modelos.length})
              </button>
              <button
                onClick={() => setFiltroTipoModelo('proposta')}
                className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                  filtroTipoModelo === 'proposta'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Propostas ({modelos.filter((m) => m.tipo === 'proposta').length})
              </button>
              <button
                onClick={() => setFiltroTipoModelo('contrato')}
                className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                  filtroTipoModelo === 'contrato'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Contratos ({modelos.filter((m) => m.tipo === 'contrato').length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modelosFiltrados.map((m) => (
              <div
                key={m.id}
                className="bg-card text-card-foreground rounded-3xl p-5 border border-border hover:border-border-strong shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {m.tipo === 'proposta' ? 'Proposta' : 'Contrato'}
                    </span>
                    {m.padrao && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Padrão
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-foreground mb-1 leading-snug">
                    {m.titulo}
                  </h4>

                  <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
                    {m.descricao || 'Modelo pronto com cláusulas jurídicas e variáveis inteligentes.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setModalVisualizarModelo(m)}
                    className="h-8 rounded-full text-xs font-medium border-border bg-card text-foreground hover:bg-muted"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    <span>Visualizar</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => {
                      if (m.tipo === 'proposta') {
                        selecionarModeloProposta(m);
                        setModalNovaPropostaAberto(true);
                      } else {
                        selecionarModeloContrato(m);
                        setModalNovoContratoAberto(true);
                      }
                    }}
                    className="h-8 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <span>Usar Modelo</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: DADOS CADASTRAIS DA AGÊNCIA */}
      {/* ============================================================= */}
      {modalAgenciaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-border my-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Dados da Agência como CONTRATADA
                </h3>
              </div>
              <button
                onClick={() => setModalAgenciaAberto(false)}
                className="text-muted-foreground hover:text-foreground font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              Estes dados serão preenchidos automaticamente nos cabeçalhos, rodapés e cláusulas jurídicas de todas as suas propostas e contratos.
            </p>

            <form onSubmit={handleSalvarAgencia} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Nome Fantasia da Agência *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAgencia.nome}
                    onChange={(e) => setFormAgencia({ ...formAgencia, nome: e.target.value })}
                    placeholder="Ex: GENS Digital"
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Razão Social Completa *
                  </label>
                  <input
                    type="text"
                    value={formAgencia.razao_social || ''}
                    onChange={(e) => setFormAgencia({ ...formAgencia, razao_social: e.target.value })}
                    placeholder="Ex: GENS Soluções Criativas LTDA"
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    CNPJ ou CPF *
                  </label>
                  <input
                    type="text"
                    value={formAgencia.cnpj_cpf || ''}
                    onChange={(e) => setFormAgencia({ ...formAgencia, cnpj_cpf: e.target.value })}
                    placeholder="00.000.000/0001-00"
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Chave PIX para Cobrança *
                  </label>
                  <input
                    type="text"
                    value={formAgencia.chave_pix || ''}
                    onChange={(e) => setFormAgencia({ ...formAgencia, chave_pix: e.target.value })}
                    placeholder="pix@minhaagencia.com.br"
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Endereço Completo com CEP *
                </label>
                <input
                  type="text"
                  value={formAgencia.endereco || ''}
                  onChange={(e) => setFormAgencia({ ...formAgencia, endereco: e.target.value })}
                  placeholder="Av. Paulista, 1000 - Bela Vista - São Paulo/SP"
                  className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Cidade / UF para Foro *
                  </label>
                  <input
                    type="text"
                    value={formAgencia.cidade_estado || ''}
                    onChange={(e) => setFormAgencia({ ...formAgencia, cidade_estado: e.target.value })}
                    placeholder="São Paulo - SP"
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Telefone de Contato *
                  </label>
                  <input
                    type="text"
                    value={formAgencia.telefone_contato || ''}
                    onChange={(e) => setFormAgencia({ ...formAgencia, telefone_contato: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  E-mail Oficial da Agência
                </label>
                <input
                  type="email"
                  value={formAgencia.email_contato || ''}
                  onChange={(e) => setFormAgencia({ ...formAgencia, email_contato: e.target.value })}
                  placeholder="financeiro@suaagencia.com.br"
                  className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-2 border-t border-border">
                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/60 border border-border cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="checkbox"
                    checked={Boolean(formAgencia.whatsapp_envio_automatico)}
                    onChange={(e) =>
                      setFormAgencia({ ...formAgencia, whatsapp_envio_automatico: e.target.checked })
                    }
                    className="mt-1 rounded border-input text-primary focus:ring-primary h-4 w-4"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-foreground block">
                      Envio automático pelo WhatsApp
                    </span>
                    <span className="text-muted-foreground block text-[11px] leading-relaxed">
                      Quando desativado (padrão), o sistema não dispara mensagens de aprovação ou lembretes automaticamente via WhatsApp. O time copia o link ou abre o WhatsApp manualmente para enviar.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-3 flex gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalAgenciaAberto(false)}
                  className="flex-1 h-10 rounded-full text-xs font-semibold border-border bg-card text-foreground hover:bg-muted"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
                >
                  Salvar Dados
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: NOVA PROPOSTA */}
      {/* ============================================================= */}
      {modalNovaPropostaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl border border-border my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Elaborar Proposta Comercial
                </h3>
              </div>
              <button
                onClick={() => setModalNovaPropostaAberto(false)}
                className="text-muted-foreground hover:text-foreground font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarProposta} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Modelo de Proposta (11 disponíveis)
                </label>
                <select
                  value={formProposta.modelo_id}
                  onChange={(e) => {
                    const sel = modelos.find((m) => m.id === e.target.value);
                    if (sel) selecionarModeloProposta(sel);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="">Selecione um modelo...</option>
                  {modelos
                    .filter((m) => m.tipo === 'proposta')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.titulo}
                      </option>
                    ))}
                </select>
              </div>

              {/* Cliente ou Lead */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Cliente Existente
                  </label>
                  <select
                    value={formProposta.cliente_id}
                    onChange={(e) => {
                      setFormProposta({ ...formProposta, cliente_id: e.target.value, lead_id: '' });
                      const cli = clientes.find((c) => c.id === e.target.value);
                      if (cli) {
                        setFormProposta((prev) => ({
                          ...prev,
                          conteudo_html: prev.conteudo_html
                            .replace(/\[Nome do Cliente\]/g, cli.nome)
                            .replace(/\[Responsável\]/g, cli.responsavel_legal || cli.nome),
                        }));
                      }
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Nenhum (usar lead ou avulso)</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Ou Negócio do CRM (Lead)
                  </label>
                  <select
                    value={formProposta.lead_id}
                    onChange={(e) => {
                      setFormProposta({ ...formProposta, lead_id: e.target.value, cliente_id: '' });
                      const l = leads.find((lead) => lead.id === e.target.value);
                      if (l) {
                        setFormProposta((prev) => ({
                          ...prev,
                          conteudo_html: prev.conteudo_html
                            .replace(/\[Nome do Cliente\]/g, l.empresa || l.nome_contato)
                            .replace(/\[Responsável\]/g, l.nome_contato),
                        }));
                      }
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Nenhum</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.titulo} ({l.nome_contato})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Título da Proposta *
                </label>
                <input
                  type="text"
                  required
                  value={formProposta.titulo}
                  onChange={(e) => setFormProposta({ ...formProposta, titulo: e.target.value })}
                  placeholder="Ex: Gestão de Redes Sociais e Tráfego Pago"
                  className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Valor Mensal (Fee)
                  </label>
                  <input
                    type="text"
                    value={formProposta.valor_mensal}
                    onChange={(e) => setFormProposta({ ...formProposta, valor_mensal: e.target.value })}
                    placeholder="Ex: 2.500,00"
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Setup / Onboarding
                  </label>
                  <input
                    type="text"
                    value={formProposta.valor_setup}
                    onChange={(e) => setFormProposta({ ...formProposta, valor_setup: e.target.value })}
                    placeholder="Ex: 1.000,00"
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Válida até
                  </label>
                  <input
                    type="date"
                    value={formProposta.validade}
                    onChange={(e) => setFormProposta({ ...formProposta, validade: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Editor Rico do Conteúdo */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Conteúdo da Proposta (Escopo, Investimento e Condições)
                </label>
                <div className="border border-input rounded-2xl overflow-hidden bg-background">
                  <EditorRico
                    key={formProposta.modelo_id || 'editor-proposta'}
                    valorInicial={formProposta.conteudo_html}
                    onChange={(html) => setFormProposta((prev) => ({ ...prev, conteudo_html: html }))}
                    minHeight="14rem"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalNovaPropostaAberto(false)}
                  className="flex-1 h-10 rounded-full text-xs font-semibold border-border bg-card text-foreground hover:bg-muted"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
                >
                  Criar e Gerar Link
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: NOVO CONTRATO */}
      {/* ============================================================= */}
      {modalNovoContratoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl border border-border my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Elaborar Contrato de Prestação de Serviços
                </h3>
              </div>
              <button
                onClick={() => setModalNovoContratoAberto(false)}
                className="text-muted-foreground hover:text-foreground font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarContrato} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Modelo de Contrato (9 disponíveis)
                </label>
                <select
                  value={formContrato.modelo_id}
                  onChange={(e) => {
                    const sel = modelos.find((m) => m.id === e.target.value);
                    if (sel) selecionarModeloContrato(sel);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="">Selecione um modelo...</option>
                  {modelos
                    .filter((m) => m.tipo === 'contrato')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.titulo}
                      </option>
                    ))}
                </select>
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Cliente CONTRATANTE
                </label>
                <select
                  value={formContrato.cliente_id}
                  onChange={(e) => {
                    setFormContrato({ ...formContrato, cliente_id: e.target.value });
                    const cli = clientes.find((c) => c.id === e.target.value);
                    if (cli) {
                      setFormContrato((prev) => ({
                        ...prev,
                        conteudo_html: prev.conteudo_html
                          .replace(/\[Nome do Cliente\]/g, cli.nome)
                          .replace(/\[CNPJ ou CPF\]/g, cli.cnpj_cpf || 'A preencher')
                          .replace(/\[Responsável\]/g, cli.responsavel_legal || cli.nome),
                      }));
                    }
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="">Selecione o cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.cnpj_cpf ? `(${c.cnpj_cpf})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Título do Contrato *
                </label>
                <input
                  type="text"
                  required
                  value={formContrato.titulo}
                  onChange={(e) => setFormContrato({ ...formContrato, titulo: e.target.value })}
                  placeholder="Ex: Contrato de Prestação de Serviços de Marketing"
                  className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Valor Mensal (Fee)
                  </label>
                  <input
                    type="text"
                    value={formContrato.valor_mensal}
                    onChange={(e) => setFormContrato({ ...formContrato, valor_mensal: e.target.value })}
                    placeholder="Ex: 2.500,00"
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Dia do Vencimento
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formContrato.dia_vencimento}
                    onChange={(e) => setFormContrato({ ...formContrato, dia_vencimento: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={formContrato.data_inicio}
                    onChange={(e) => setFormContrato({ ...formContrato, data_inicio: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Cláusulas e Texto Jurídico do Contrato
                </label>
                <div className="border border-input rounded-2xl overflow-hidden bg-background">
                  <EditorRico
                    key={formContrato.modelo_id || 'editor-contrato'}
                    valorInicial={formContrato.conteudo_html}
                    onChange={(html) => setFormContrato((prev) => ({ ...prev, conteudo_html: html }))}
                    minHeight="14rem"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formContrato.renovacao_automatica}
                  onChange={(e) => setFormContrato({ ...formContrato, renovacao_automatica: e.target.checked })}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground">
                  Renovação automática ao término da vigência se não houver manifestação prévia.
                </span>
              </label>

              <div className="pt-3 flex gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalNovoContratoAberto(false)}
                  className="flex-1 h-10 rounded-full text-xs font-semibold border-border bg-card text-foreground hover:bg-muted"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
                >
                  Salvar Rascunho e Preparar Envio
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: ENVIAR CONTRATO (Congela HTML, Hash SHA-256 e WhatsApp) */}
      {/* ============================================================= */}
      {modalEnviarContrato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-border my-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-foreground">
                  Enviar Contrato para Assinatura
                </h3>
              </div>
              <button
                onClick={() => setModalEnviarContrato(null)}
                className="text-muted-foreground hover:text-foreground font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {enviandoContrato ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Congelando documento e gerando hash criptográfico...
                </span>
              </div>
            ) : dadosEnvioContrato ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-muted border border-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Documento</span>
                    <span className="font-bold text-foreground">{modalEnviarContrato.titulo}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Validade do Link</span>
                    <span className="font-semibold text-foreground">15 dias ({new Date(dadosEnvioContrato.expira_em).toLocaleDateString('pt-BR')})</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="warning">
                      Aguardando Assinatura do Cliente
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Mensagem Pronta para WhatsApp:
                  </label>
                  <textarea
                    readOnly
                    rows={4}
                    value={dadosEnvioContrato.textoWhatsapp}
                    className="w-full text-xs p-3 rounded-xl border border-input bg-background text-foreground resize-none font-mono"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    onClick={() => {
                      const zapUrl = `https://wa.me/?text=${encodeURIComponent(dadosEnvioContrato.textoWhatsapp)}`;
                      window.open(zapUrl, '_blank');
                    }}
                    className="w-full h-11 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar direto pelo WhatsApp</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(dadosEnvioContrato.link);
                      toast.success('Link seguro de assinatura copiado!');
                    }}
                    className="w-full h-11 rounded-full text-xs font-semibold border-border bg-card text-foreground hover:bg-muted flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copiar Link Seguro</span>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-destructive">Não foi possível preparar o envio deste contrato.</p>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: CONTRA-ASSINAR COMO AGÊNCIA */}
      {/* ============================================================= */}
      {modalContraAssinar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-border my-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Contra-assinar como Agência
                </h3>
                <p className="text-xs text-muted-foreground">
                  Finalização do ciclo jurídico do contrato
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-muted border border-border space-y-2 mb-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Contrato</span>
                <span className="font-bold text-foreground">{modalContraAssinar.titulo}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Signatário Cliente</span>
                <span className="font-semibold text-foreground">{modalContraAssinar.assinatura_cliente_nome}</span>
                <span className="text-muted-foreground block text-[10px]">
                  Documento: {modalContraAssinar.assinatura_cliente_doc}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Assinado pelo Cliente em</span>
                <span className="font-semibold text-foreground">
                  {modalContraAssinar.assinatura_cliente_data
                    ? new Date(modalContraAssinar.assinatura_cliente_data).toLocaleString('pt-BR')
                    : 'Data Registrada'}
                </span>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-foreground mb-1">
                Nome do Representante Legal da Agência *
              </label>
              <input
                type="text"
                value={nomeContraAssinante}
                onChange={(e) => setNomeContraAssinante(e.target.value)}
                placeholder="Ex: Diretor Responsável"
                className="w-full h-10 px-3 rounded-xl border border-input text-xs bg-background text-foreground focus:ring-1 focus:ring-primary"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Ao contra-assinar, o contrato torna-se 100% formalizado e ativará o negócio como "Ganho" no CRM e a receita no Financeiro.
              </span>
            </div>

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => setModalContraAssinar(null)}
                disabled={processandoContraAssinatura}
                className="flex-1 h-11 rounded-full text-xs font-semibold border-border bg-card text-foreground hover:bg-muted"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarContraAssinatura}
                disabled={processandoContraAssinatura}
                className="flex-1 h-11 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1.5"
              >
                {processandoContraAssinatura ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gravando...</span>
                  </>
                ) : (
                  <span>Contra-assinar Agora</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: HISTÓRICO DE AUDITORIA / EVENTOS DO CONTRATO */}
      {/* ============================================================= */}
      {modalEventosContrato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-border my-8 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Trilha de Auditoria Jurídica
                  </h3>
                  <span className="text-xs text-muted-foreground truncate block max-w-xs">
                    {modalEventosContrato.contrato.titulo}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setModalEventosContrato(null)}
                className="text-muted-foreground hover:text-foreground font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-4 py-2">
              {modalEventosContrato.contrato.hash_documento && (
                <div className="p-3 bg-muted rounded-2xl border border-border text-xs">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-0.5">
                    Hash SHA-256 de Integridade
                  </span>
                  <span className="font-mono text-[11px] text-foreground break-all">
                    {modalEventosContrato.contrato.hash_documento}
                  </span>
                </div>
              )}

              {modalEventosContrato.carregando ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Carregando eventos...</span>
                </div>
              ) : modalEventosContrato.eventos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Nenhum evento registrado nesta trilha até o momento.
                </p>
              ) : (
                <div className="relative border-l-2 border-border ml-3 pl-4 space-y-6 text-xs">
                  {modalEventosContrato.eventos.map((ev, i) => {
                    const tipoFormatado =
                      ev.tipo === 'criado'
                        ? 'Contrato Criado'
                        : ev.tipo === 'enviado'
                        ? 'Enviado / Congelado'
                        : ev.tipo === 'visualizado'
                        ? 'Visualizado pelo Cliente'
                        : ev.tipo === 'assinado_cliente'
                        ? 'Assinado pelo Cliente'
                        : ev.tipo === 'contra_assinado'
                        ? 'Contra-assinado pela Agência'
                        : ev.tipo === 'cancelado'
                        ? 'Cancelado / Revogado'
                        : ev.tipo;

                    return (
                      <div key={ev.id || i} className="relative group">
                        <div className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-card" />
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground text-xs">{tipoFormatado}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(ev.criado_em).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {ev.ip && (
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            IP: {ev.ip}
                          </span>
                        )}
                        {ev.dados?.signatario && (
                          <span className="text-xs text-foreground block">
                            Signatário: <strong>{ev.dados.signatario}</strong>
                          </span>
                        )}
                        {ev.dados?.motivo && (
                          <span className="text-xs text-destructive block">
                            Motivo: {ev.dados.motivo}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border shrink-0">
              <Button
                variant="outline"
                onClick={() => setModalEventosContrato(null)}
                className="w-full h-10 rounded-full text-xs font-semibold border-border bg-card text-foreground hover:bg-muted"
              >
                Fechar Trilha
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: REVOGAR / CANCELAR CONTRATO */}
      {/* ============================================================= */}
      {modalRevogarContrato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-border">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
              <Ban className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">
              Revogar link e cancelar contrato?
            </h3>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              Ao revogar, o link público de assinatura ficará imediatamente inacessível para o cliente e o status do contrato mudará para <strong>Cancelado</strong>.
            </p>

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => setModalRevogarContrato(null)}
                disabled={processandoRevogacao}
                className="flex-1 h-10 rounded-full text-xs font-semibold border-border bg-card text-foreground hover:bg-muted"
              >
                Voltar
              </Button>
              <Button
                onClick={handleConfirmarRevogacao}
                disabled={processandoRevogacao}
                className="flex-1 h-10 rounded-full text-xs font-semibold bg-destructive text-destructive-foreground hover:opacity-90"
              >
                {processandoRevogacao ? 'Revogando...' : 'Confirmar Revogação'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: VISUALIZAR MODELO */}
      {/* ============================================================= */}
      {modalVisualizarModelo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-border my-8 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground block mb-1">
                  {modalVisualizarModelo.tipo === 'proposta' ? 'Modelo de Proposta' : 'Modelo de Contrato'}
                </span>
                <h3 className="text-base font-bold text-foreground">
                  {modalVisualizarModelo.titulo}
                </h3>
              </div>
              <button
                onClick={() => setModalVisualizarModelo(null)}
                className="text-muted-foreground hover:text-foreground font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 py-2">
              <div
                className="prose dark:prose-invert prose-xs max-w-none text-foreground leading-relaxed
                  [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:text-foreground
                  [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:text-foreground
                  [&_h3]:text-xs [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-foreground
                  [&_p]:mb-2 [&_p]:text-xs [&_p]:text-foreground/80
                  [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:text-xs
                  [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:text-xs"
                dangerouslySetInnerHTML={{ __html: modalVisualizarModelo.conteudo_html }}
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalVisualizarModelo(null)}
                className="h-9 rounded-full text-xs border-border bg-card text-foreground hover:bg-muted"
              >
                Fechar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (modalVisualizarModelo.tipo === 'proposta') {
                    selecionarModeloProposta(modalVisualizarModelo);
                    setModalVisualizarModelo(null);
                    setModalNovaPropostaAberto(true);
                  } else {
                    selecionarModeloContrato(modalVisualizarModelo);
                    setModalVisualizarModelo(null);
                    setModalNovoContratoAberto(true);
                  }
                }}
                className="h-9 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
              >
                <span>Usar este Modelo</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: CERTIFICADO DE ASSINATURA */}
      {/* ============================================================= */}
      {modalCertificadoContrato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card text-card-foreground rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Certificado de Validade Jurídica
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Assinatura Eletrônica Certificada (MP 2.200-2/2001)
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-muted p-4 rounded-2xl border border-border text-xs text-foreground mb-5">
              <div>
                <span className="text-[10px] text-muted-foreground block">Contrato</span>
                <span className="font-semibold text-foreground">{modalCertificadoContrato.titulo}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Signatário CONTRATANTE (Cliente)</span>
                <span className="font-bold text-foreground">{modalCertificadoContrato.assinatura_cliente_nome}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Documento (CPF / CNPJ)</span>
                <span className="font-semibold text-foreground">{modalCertificadoContrato.assinatura_cliente_doc}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Data e Hora da Assinatura</span>
                <span className="font-semibold text-foreground">
                  {modalCertificadoContrato.assinatura_cliente_data
                    ? new Date(modalCertificadoContrato.assinatura_cliente_data).toLocaleString('pt-BR')
                    : 'Registrada'}
                </span>
              </div>
              {modalCertificadoContrato.assinatura_agencia_data && (
                <div>
                  <span className="text-[10px] text-muted-foreground block">Contra-assinatura CONTRATADA (Agência)</span>
                  <span className="font-bold text-foreground">
                    {modalCertificadoContrato.assinatura_agencia_nome || agencia?.nome} em{' '}
                    {new Date(modalCertificadoContrato.assinatura_agencia_data).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
              <div>
                <span className="text-[10px] text-muted-foreground block">Endereço IP Registrado</span>
                <span className="font-mono text-[11px] text-foreground">{modalCertificadoContrato.assinatura_cliente_ip || '127.0.0.1'}</span>
              </div>
              {modalCertificadoContrato.hash_documento && (
                <div>
                  <span className="text-[10px] text-muted-foreground block">Hash SHA-256 de Integridade</span>
                  <span className="font-mono text-[11px] text-foreground break-all">{modalCertificadoContrato.hash_documento}</span>
                </div>
              )}
            </div>

            <Button
              onClick={() => setModalCertificadoContrato(null)}
              className="w-full h-10 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
            >
              Concluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
