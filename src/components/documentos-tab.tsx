'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { PageHeader } from '@/components/ui/page-header';
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

  // Modais
  const [modalAgenciaAberto, setModalAgenciaAberto] = useState(false);
  const [modalNovaPropostaAberto, setModalNovaPropostaAberto] = useState(false);
  const [modalNovoContratoAberto, setModalNovoContratoAberto] = useState(false);
  const [modalVisualizarModelo, setModalVisualizarModelo] = useState<ModeloDocumento | null>(null);
  const [modalCertificadoContrato, setModalCertificadoContrato] = useState<Contrato | null>(null);

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
      
      // Oferece copiar link na hora
      const urlPublica = `${window.location.origin}/proposta/${data.proposta.token_publico}`;
      navigator.clipboard.writeText(urlPublica);
      toast.success('Link público da proposta copiado para a área de transferência!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar proposta.');
    }
  }

  // Criar contrato
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
          status: 'aguardando_assinatura',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar contrato.');

      setContratos((prev) => [data.contrato, ...prev]);
      setModalNovoContratoAberto(false);
      toast.success('Contrato gerado com sucesso!');

      const urlPublica = `${window.location.origin}/contrato/${data.contrato.token_publico}`;
      navigator.clipboard.writeText(urlPublica);
      toast.success('Link de assinatura digital copiado!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar contrato.');
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

  // Enviar link via WhatsApp
  function enviarWhatsApp(telefone: string | null | undefined, nome: string, titulo: string, url: string, tipo: 'proposta' | 'contrato') {
    const limpo = (telefone || '').replace(/\D/g, '');
    const num = limpo.length === 10 || limpo.length === 11 ? `55${limpo}` : limpo;
    
    const texto = tipo === 'proposta'
      ? `Olá, ${nome}! Tudo bem?\n\nSegue a proposta comercial "${titulo}" elaborada pela equipe da ${agencia?.nome || 'nossa agência'}:\n${url}\n\nQualquer dúvida estamos à total disposição!`
      : `Olá, ${nome}!\n\nSeu contrato de prestação de serviços "${titulo}" já está pronto para assinatura digital com validade jurídica:\n${url}\n\nBasta clicar no link para revisar e assinar.`;

    const zapUrl = num
      ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;

    window.open(zapUrl, '_blank');
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

  // Cálculos de KPIs
  const kpis = useMemo(() => {
    const ativas = propostas.filter((p) => p.status === 'enviada').length;
    const aguardandoAssinatura = contratos.filter((c) => c.status === 'aguardando_assinatura').length;
    const assinados = contratos.filter((c) => c.status === 'assinado').length;
    
    const hoje = new Date().toISOString().slice(0, 10);
    const em30Dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const renovando = contratos.filter(
      (c) => c.status === 'assinado' && c.data_termino && c.data_termino >= hoje && c.data_termino <= em30Dias
    ).length;

    return { ativas, aguardandoAssinatura, assinados, renovando };
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
    <div className="space-y-6 pb-12">
      {/* Cabeçalho da Tela */}
      <PageHeader
        title="Propostas & Contratos"
        description="Biblioteca com 11 modelos de proposta e 9 de contrato, assinaturas eletrônicas com validade jurídica e integração direta ao Financeiro."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalAgenciaAberto(true)}
              className="gap-2 h-9 rounded-full text-xs font-semibold"
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
                className="gap-1.5 h-9 rounded-full text-xs font-semibold bg-[#192313] text-[#bada55] hover:bg-[#2a3820]"
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
                className="gap-1.5 h-9 rounded-full text-xs font-semibold bg-[#192313] text-[#bada55] hover:bg-[#2a3820]"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Contrato</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Banner de Dados da Agência Incompletos */}
      {!agenciaCompleta && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold block text-sm">
                Complete o cadastro da sua agência como CONTRATADA
              </span>
              <span className="text-amber-800/80">
                Faltam estes dados para emitir propostas e contratos com validade:{' '}
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

      {/* Banner de KPIs Rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-xs">
          <span className="text-xs text-[#192313]/60 block mb-1">Propostas Ativas</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-[#192313]">{kpis.ativas}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-xs">
          <span className="text-xs text-[#192313]/60 block mb-1">Aguardando Assinatura</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-amber-600">{kpis.aguardandoAssinatura}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileSignature className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-xs">
          <span className="text-xs text-[#192313]/60 block mb-1">Contratos Assinados</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-emerald-600">{kpis.assinados}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-xs">
          <span className="text-xs text-[#192313]/60 block mb-1">Renovam em 30 dias</span>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-[#192313]">{kpis.renovando}</span>
            <div className="w-8 h-8 rounded-xl bg-[#192313]/5 text-[#192313] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Navegação por SubAbas */}
      <div className="flex items-center justify-between border-b border-black/10 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-[#192313]/5 p-1 rounded-full">
          <button
            onClick={() => setSubAba('propostas')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              subAba === 'propostas'
                ? 'bg-[#192313] text-[#bada55] shadow-xs'
                : 'text-[#192313]/70 hover:text-[#192313]'
            }`}
          >
            Propostas Comerciais ({propostas.length})
          </button>
          <button
            onClick={() => setSubAba('contratos')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              subAba === 'contratos'
                ? 'bg-[#192313] text-[#bada55] shadow-xs'
                : 'text-[#192313]/70 hover:text-[#192313]'
            }`}
          >
            Contratos Digitais ({contratos.length})
          </button>
          <button
            onClick={() => setSubAba('modelos')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              subAba === 'modelos'
                ? 'bg-[#192313] text-[#bada55] shadow-xs'
                : 'text-[#192313]/70 hover:text-[#192313]'
            }`}
          >
            Biblioteca de Modelos (20)
          </button>
        </div>

        {/* Busca Compacta */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#192313]/40" />
          <input
            type="text"
            placeholder="Buscar por título ou cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-full border border-black/10 bg-white text-xs text-[#192313] focus:outline-none focus:ring-1 focus:ring-[#192313]"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUB-ABA: PROPOSTAS */}
      {/* ------------------------------------------------------------- */}
      {subAba === 'propostas' && (
        <div className="space-y-4">
          {/* Filtros de Status */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {['todos', 'rascunho', 'enviada', 'aceita', 'recusada'].map((st) => (
              <button
                key={st}
                onClick={() => setFiltroStatusProposta(st)}
                className={`px-3 py-1 rounded-full capitalize font-medium transition-colors shrink-0 ${
                  filtroStatusProposta === st
                    ? 'bg-[#192313] text-white'
                    : 'bg-white border border-black/10 text-[#192313]/70 hover:bg-black/5'
                }`}
              >
                {st === 'todos' ? 'Todas' : st === 'aceita' ? 'Aprovadas' : st === 'recusada' ? 'Ajustes Pedidos' : st}
              </button>
            ))}
          </div>

          {/* Lista de Propostas */}
          {propostasFiltradas.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-black/5">
              <FileText className="w-12 h-12 text-[#192313]/20 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-[#192313] mb-1">Nenhuma proposta encontrada</h3>
              <p className="text-xs text-[#192313]/60 mb-4 max-w-sm mx-auto">
                Crie sua primeira proposta comercial a partir dos 11 modelos prontos do sistema e envie com 1 clique para o cliente.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  selecionarModeloProposta(modelos.find((m) => m.tipo === 'proposta') || MODELOS_PROPOSTAS_PADRAO[0] as unknown as ModeloDocumento);
                  setModalNovaPropostaAberto(true);
                }}
                className="h-9 rounded-full text-xs font-semibold bg-[#192313] text-[#bada55]"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar Nova Proposta
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {propostasFiltradas.map((p) => {
                const linkPublico = `${typeof window !== 'undefined' ? window.location.origin : ''}/proposta/${p.token_publico}`;
                const clienteNome = p.cliente?.nome || p.lead?.empresa || p.lead?.nome_contato || 'Cliente não vinculado';
                const telefone = p.lead?.telefone;

                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-3xl p-5 border border-black/5 hover:border-black/15 shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-[#192313]/50 truncate block">
                          {clienteNome}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize shrink-0 ${
                            p.status === 'aceita'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : p.status === 'recusada'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : p.status === 'enviada'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-black/5 text-[#192313]/70'
                          }`}
                        >
                          {p.status === 'aceita' ? 'Aprovada' : p.status === 'recusada' ? 'Ajustes Pedidos' : p.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-[#192313] mb-3 leading-snug">
                        {p.titulo}
                      </h4>

                      <div className="flex items-center gap-4 text-xs mb-4 text-[#192313]/70">
                        {p.valor_mensal > 0 && (
                          <div>
                            <span className="text-[10px] text-[#192313]/40 block">Mensalidade</span>
                            <span className="font-semibold text-[#192313]">
                              R$ {Number(p.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {p.valor_setup > 0 && (
                          <div>
                            <span className="text-[10px] text-[#192313]/40 block">Setup</span>
                            <span className="font-semibold text-[#192313]">
                              R$ {Number(p.valor_setup).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {p.validade && (
                          <div>
                            <span className="text-[10px] text-[#192313]/40 block">Validade</span>
                            <span className="font-medium text-[#192313]">
                              {new Date(p.validade).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Barra de Ações Rápidas */}
                    <div className="pt-3 border-t border-black/5 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copiarLink(linkPublico, 'Link da proposta copiado!')}
                          className="h-8 rounded-full text-[11px] font-medium px-2.5"
                          title="Copiar Link Público"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          <span>Link</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => enviarWhatsApp(telefone, clienteNome, p.titulo, linkPublico, 'proposta')}
                          className="h-8 rounded-full text-[11px] font-medium px-2.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                          title="Enviar via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1" />
                          <span>WhatsApp</span>
                        </Button>

                        <a
                          href={linkPublico}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center h-8 px-2.5 rounded-full border border-black/10 text-[11px] font-medium hover:bg-black/5 text-[#192313]"
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
                            className="h-8 rounded-full text-[11px] font-semibold bg-[#192313] text-[#bada55] hover:bg-[#2a3820]"
                          >
                            <FileSignature className="w-3.5 h-3.5 mr-1" />
                            <span>Gerar Contrato</span>
                          </Button>
                        )}

                        <button
                          onClick={() => excluirProposta(p.id)}
                          className="p-1.5 rounded-full text-black/30 hover:text-rose-600 transition-colors"
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
          {/* Filtros de Status */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {['todos', 'aguardando_assinatura', 'assinado', 'cancelado'].map((st) => (
              <button
                key={st}
                onClick={() => setFiltroStatusContrato(st)}
                className={`px-3 py-1 rounded-full capitalize font-medium transition-colors shrink-0 ${
                  filtroStatusContrato === st
                    ? 'bg-[#192313] text-white'
                    : 'bg-white border border-black/10 text-[#192313]/70 hover:bg-black/5'
                }`}
              >
                {st === 'todos' ? 'Todos' : st === 'aguardando_assinatura' ? 'Aguardando Assinatura' : st}
              </button>
            ))}
          </div>

          {/* Lista de Contratos */}
          {contratosFiltrados.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-black/5">
              <FileSignature className="w-12 h-12 text-[#192313]/20 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-[#192313] mb-1">Nenhum contrato cadastrado</h3>
              <p className="text-xs text-[#192313]/60 mb-4 max-w-sm mx-auto">
                Crie contratos digitais com assinatura jurídica a partir dos nossos 9 modelos prontos ou converta propostas aprovadas.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  selecionarModeloContrato(modelos.find((m) => m.tipo === 'contrato') || MODELOS_CONTRATOS_PADRAO[0] as unknown as ModeloDocumento);
                  setModalNovoContratoAberto(true);
                }}
                className="h-9 rounded-full text-xs font-semibold bg-[#192313] text-[#bada55]"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar Novo Contrato
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contratosFiltrados.map((c) => {
                const linkAssinatura = `${typeof window !== 'undefined' ? window.location.origin : ''}/contrato/${c.token_publico}`;
                const clienteNome = c.cliente?.nome || c.lead?.empresa || c.lead?.nome_contato || 'Cliente não vinculado';
                const telefone = c.lead?.telefone;
                const assinado = c.status === 'assinado';

                return (
                  <div
                    key={c.id}
                    className="bg-white rounded-3xl p-5 border border-black/5 hover:border-black/15 shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-[#192313]/50 truncate block">
                          {clienteNome}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize shrink-0 ${
                            assinado
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {assinado ? 'Assinado Digitalmente' : 'Aguardando Assinatura'}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-[#192313] mb-3 leading-snug">
                        {c.titulo}
                      </h4>

                      <div className="flex items-center gap-4 text-xs mb-4 text-[#192313]/70">
                        <div>
                          <span className="text-[10px] text-[#192313]/40 block">Fee Mensal</span>
                          <span className="font-semibold text-[#192313]">
                            R$ {Number(c.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {c.dia_vencimento && (
                          <div>
                            <span className="text-[10px] text-[#192313]/40 block">Vencimento</span>
                            <span className="font-medium text-[#192313]">Todo dia {c.dia_vencimento}</span>
                          </div>
                        )}
                        {c.data_inicio && (
                          <div>
                            <span className="text-[10px] text-[#192313]/40 block">Vigência</span>
                            <span className="font-medium text-[#192313]">
                              {new Date(c.data_inicio).toLocaleDateString('pt-BR')} até{' '}
                              {c.data_termino ? new Date(c.data_termino).toLocaleDateString('pt-BR') : 'Indeterminado'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Certificado de assinatura resumo */}
                      {assinado && (
                        <div className="bg-emerald-50/60 rounded-xl p-2.5 border border-emerald-100 text-[11px] text-emerald-900 mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">
                              Assinado por <strong>{c.assinatura_cliente_nome}</strong>
                            </span>
                          </div>
                          <button
                            onClick={() => setModalCertificadoContrato(c)}
                            className="text-emerald-700 font-bold hover:underline shrink-0 text-[10px]"
                          >
                            Ver Certificado
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Barra de Ações Rápidas */}
                    <div className="pt-3 border-t border-black/5 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copiarLink(linkAssinatura, 'Link de assinatura copiado!')}
                          className="h-8 rounded-full text-[11px] font-medium px-2.5"
                          title="Copiar Link de Assinatura"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          <span>Link</span>
                        </Button>

                        {!assinado && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => enviarWhatsApp(telefone, clienteNome, c.titulo, linkAssinatura, 'contrato')}
                            className="h-8 rounded-full text-[11px] font-medium px-2.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                            title="Cobrar Assinatura via WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 mr-1" />
                            <span>WhatsApp</span>
                          </Button>
                        )}

                        <a
                          href={linkAssinatura}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center h-8 px-2.5 rounded-full border border-black/10 text-[11px] font-medium hover:bg-black/5 text-[#192313]"
                          title="Ver Contrato"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => excluirContrato(c.id)}
                          className="p-1.5 rounded-full text-black/30 hover:text-rose-600 transition-colors"
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
      {/* SUB-ABA: BIBLIOTECA DE MODELOS */}
      {/* ------------------------------------------------------------- */}
      {subAba === 'modelos' && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setFiltroTipoModelo('todos')}
              className={`px-3 py-1 rounded-full font-medium transition-colors shrink-0 ${
                filtroTipoModelo === 'todos'
                  ? 'bg-[#192313] text-white'
                  : 'bg-white border border-black/10 text-[#192313]/70 hover:bg-black/5'
              }`}
            >
              Todos os Modelos ({modelos.length})
            </button>
            <button
              onClick={() => setFiltroTipoModelo('proposta')}
              className={`px-3 py-1 rounded-full font-medium transition-colors shrink-0 ${
                filtroTipoModelo === 'proposta'
                  ? 'bg-[#192313] text-white'
                  : 'bg-white border border-black/10 text-[#192313]/70 hover:bg-black/5'
              }`}
            >
              Modelos de Proposta (11)
            </button>
            <button
              onClick={() => setFiltroTipoModelo('contrato')}
              className={`px-3 py-1 rounded-full font-medium transition-colors shrink-0 ${
                filtroTipoModelo === 'contrato'
                  ? 'bg-[#192313] text-white'
                  : 'bg-white border border-black/10 text-[#192313]/70 hover:bg-black/5'
              }`}
            >
              Modelos de Contrato (9)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modelosFiltrados.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-3xl p-5 border border-black/5 hover:border-black/15 shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#192313]/5 text-[#192313]/70">
                      {m.tipo === 'proposta' ? 'Proposta' : 'Contrato'}
                    </span>
                    <span className="text-[11px] text-[#192313]/40 font-mono">
                      {m.categoria.replace('_', ' ')}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-[#192313] mb-2 leading-snug">
                    {m.titulo}
                  </h4>

                  <p className="text-xs text-[#192313]/60 mb-4 line-clamp-3 leading-relaxed">
                    {m.descricao || 'Modelo estruturado com cláusulas e variáveis automáticas.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-black/5 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setModalVisualizarModelo(m)}
                    className="h-8 rounded-full text-xs font-medium px-3"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    <span>Ver Texto</span>
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
                    className="h-8 rounded-full text-xs font-semibold bg-[#192313] text-[#bada55] hover:bg-[#2a3820]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-black/10 my-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#192313]" />
                <h3 className="text-base font-bold text-[#192313]">
                  Dados da Agência como CONTRATADA
                </h3>
              </div>
              <button
                onClick={() => setModalAgenciaAberto(false)}
                className="text-black/40 hover:text-black font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#192313]/70 mb-5 leading-relaxed">
              Estes dados serão preenchidos automaticamente nos cabeçalhos, rodapés e cláusulas jurídicas de todas as suas propostas e contratos.
            </p>

            <form onSubmit={handleSalvarAgencia} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Nome Fantasia da Agência *
                  </label>
                  <input
                    type="text"
                    required
                    value={formAgencia.nome}
                    onChange={(e) => setFormAgencia({ ...formAgencia, nome: e.target.value })}
                    placeholder="Ex: GENS Digital"
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Razão Social Completa *
                  </label>
                  <input
                    type="text"
                    value={formAgencia.razao_social || ''}
                    onChange={(e) => setFormAgencia({ ...formAgencia, razao_social: e.target.value })}
                    placeholder="Ex: GENS Soluções Criativas LTDA"
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    CNPJ ou CPF *
                  </label>
                  <input
                    type="text"
                    value={formAgencia.cnpj_cpf || ''}
                    onChange={(e) => setFormAgencia({ ...formAgencia, cnpj_cpf: e.target.value })}
                    placeholder="00.000.000/0001-00"
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Chave PIX para Cobrança *
                  </label>
                  <input
                    type="text"
                    value={formAgencia.chave_pix || ''}
                    onChange={(e) => setFormAgencia({ ...formAgencia, chave_pix: e.target.value })}
                    placeholder="pix@minhaagencia.com.br"
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#192313] mb-1">
                  Endereço Completo com CEP *
                </label>
                <input
                  type="text"
                  value={formAgencia.endereco || ''}
                  onChange={(e) => setFormAgencia({ ...formAgencia, endereco: e.target.value })}
                  placeholder="Av. Paulista, 1000 - Bela Vista - São Paulo/SP"
                  className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Cidade / UF para Foro *
                  </label>
                  <input
                    type="text"
                    value={formAgencia.cidade_estado || ''}
                    onChange={(e) => setFormAgencia({ ...formAgencia, cidade_estado: e.target.value })}
                    placeholder="São Paulo - SP"
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Telefone de Contato *
                  </label>
                  <input
                    type="text"
                    value={formAgencia.telefone_contato || ''}
                    onChange={(e) => setFormAgencia({ ...formAgencia, telefone_contato: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#192313] mb-1">
                  E-mail Oficial da Agência
                </label>
                <input
                  type="email"
                  value={formAgencia.email_contato || ''}
                  onChange={(e) => setFormAgencia({ ...formAgencia, email_contato: e.target.value })}
                  placeholder="financeiro@suaagencia.com.br"
                  className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                />
              </div>

              <div className="pt-3 flex gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalAgenciaAberto(false)}
                  className="flex-1 h-10 rounded-full text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10 rounded-full text-xs font-semibold bg-[#192313] text-[#bada55] hover:bg-[#2a3820]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl border border-black/10 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#192313]" />
                <h3 className="text-base font-bold text-[#192313]">
                  Criar Nova Proposta Comercial
                </h3>
              </div>
              <button
                onClick={() => setModalNovaPropostaAberto(false)}
                className="text-black/40 hover:text-black font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarProposta} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Seleção de Modelo */}
              <div>
                <label className="block text-xs font-semibold text-[#192313] mb-1">
                  Modelo Base (11 disponíveis)
                </label>
                <select
                  value={formProposta.modelo_id}
                  onChange={(e) => {
                    const sel = modelos.find((m) => m.id === e.target.value);
                    if (sel) selecionarModeloProposta(sel);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                >
                  <option value="">Selecione um modelo pronto...</option>
                  {modelos
                    .filter((m) => m.tipo === 'proposta')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.titulo}
                      </option>
                    ))}
                </select>
              </div>

              {/* Vínculo: Cliente ou CRM Lead */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Cliente da Agência
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
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  >
                    <option value="">Nenhum (ou selecionar Lead abaixo)...</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Ou Oportunidade do CRM (Lead)
                  </label>
                  <select
                    value={formProposta.lead_id}
                    onChange={(e) => {
                      setFormProposta({ ...formProposta, lead_id: e.target.value, cliente_id: '' });
                      const ld = leads.find((l) => l.id === e.target.value);
                      if (ld) {
                        setFormProposta((prev) => ({
                          ...prev,
                          conteudo_html: prev.conteudo_html
                            .replace(/\[Nome do Cliente\]/g, ld.empresa || ld.nome_contato)
                            .replace(/\[Responsável\]/g, ld.nome_contato),
                        }));
                      }
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  >
                    <option value="">Selecione um lead do CRM...</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.empresa ? `${l.empresa} (${l.nome_contato})` : l.nome_contato}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Título da Proposta */}
              <div>
                <label className="block text-xs font-semibold text-[#192313] mb-1">
                  Título da Proposta *
                </label>
                <input
                  type="text"
                  required
                  value={formProposta.titulo}
                  onChange={(e) => setFormProposta({ ...formProposta, titulo: e.target.value })}
                  placeholder="Ex: Gestão de Mídias Sociais - Empresa Exemplo"
                  className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                />
              </div>

              {/* Valores e Validade */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Valor Mensal (Fee)
                  </label>
                  <input
                    type="text"
                    value={formProposta.valor_mensal}
                    onChange={(e) => setFormProposta({ ...formProposta, valor_mensal: e.target.value })}
                    placeholder="Ex: 2.500,00"
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Setup / Implantação
                  </label>
                  <input
                    type="text"
                    value={formProposta.valor_setup}
                    onChange={(e) => setFormProposta({ ...formProposta, valor_setup: e.target.value })}
                    placeholder="Ex: 1.000,00"
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Validade da Proposta
                  </label>
                  <input
                    type="date"
                    value={formProposta.validade}
                    onChange={(e) => setFormProposta({ ...formProposta, validade: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
              </div>

              {/* Editor Rico do Conteúdo */}
              <div>
                <label className="block text-xs font-semibold text-[#192313] mb-1">
                  Conteúdo da Proposta (Escopo, Investimento e Condições)
                </label>
                <div className="border border-black/15 rounded-2xl overflow-hidden bg-white">
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
                  className="flex-1 h-10 rounded-full text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10 rounded-full text-xs font-semibold bg-[#192313] text-[#bada55] hover:bg-[#2a3820]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl border border-black/10 my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-[#192313]" />
                <h3 className="text-base font-bold text-[#192313]">
                  Elaborar Contrato de Prestação de Serviços
                </h3>
              </div>
              <button
                onClick={() => setModalNovoContratoAberto(false)}
                className="text-black/40 hover:text-black font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarContrato} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block text-xs font-semibold text-[#192313] mb-1">
                  Modelo de Contrato (9 disponíveis)
                </label>
                <select
                  value={formContrato.modelo_id}
                  onChange={(e) => {
                    const sel = modelos.find((m) => m.id === e.target.value);
                    if (sel) selecionarModeloContrato(sel);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
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
                <label className="block text-xs font-semibold text-[#192313] mb-1">
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
                  className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
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
                <label className="block text-xs font-semibold text-[#192313] mb-1">
                  Título do Contrato *
                </label>
                <input
                  type="text"
                  required
                  value={formContrato.titulo}
                  onChange={(e) => setFormContrato({ ...formContrato, titulo: e.target.value })}
                  placeholder="Ex: Contrato de Prestação de Serviços de Marketing"
                  className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Valor Mensal (Fee)
                  </label>
                  <input
                    type="text"
                    value={formContrato.valor_mensal}
                    onChange={(e) => setFormContrato({ ...formContrato, valor_mensal: e.target.value })}
                    placeholder="Ex: 2.500,00"
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Dia do Vencimento
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={formContrato.dia_vencimento}
                    onChange={(e) => setFormContrato({ ...formContrato, dia_vencimento: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#192313] mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={formContrato.data_inicio}
                    onChange={(e) => setFormContrato({ ...formContrato, data_inicio: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-black/15 text-xs bg-white focus:ring-1 focus:ring-[#192313]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#192313] mb-1">
                  Cláusulas e Texto Jurídico do Contrato
                </label>
                <div className="border border-black/15 rounded-2xl overflow-hidden bg-white">
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
                  className="rounded border-black/20 text-[#192313]"
                />
                <span className="text-xs text-[#192313]/80">
                  Renovação automática ao término da vigência se não houver manifestação prévia.
                </span>
              </label>

              <div className="pt-3 flex gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalNovoContratoAberto(false)}
                  className="flex-1 h-10 rounded-full text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10 rounded-full text-xs font-semibold bg-[#192313] text-[#bada55] hover:bg-[#2a3820]"
                >
                  Salvar e Gerar Link de Assinatura
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: VISUALIZAR MODELO */}
      {/* ============================================================= */}
      {modalVisualizarModelo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-black/10 my-8 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#192313]/5 text-[#192313]/70 block mb-1">
                  {modalVisualizarModelo.tipo === 'proposta' ? 'Modelo de Proposta' : 'Modelo de Contrato'}
                </span>
                <h3 className="text-base font-bold text-[#192313]">
                  {modalVisualizarModelo.titulo}
                </h3>
              </div>
              <button
                onClick={() => setModalVisualizarModelo(null)}
                className="text-black/40 hover:text-black font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 py-2">
              <div
                className="prose prose-xs max-w-none text-[#192313] leading-relaxed
                  [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
                  [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1
                  [&_h3]:text-xs [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1
                  [&_p]:mb-2 [&_p]:text-xs [&_p]:text-[#192313]/80
                  [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ul]:text-xs
                  [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_ol]:text-xs"
                dangerouslySetInnerHTML={{ __html: modalVisualizarModelo.conteudo_html }}
              />
            </div>

            <div className="pt-4 border-t border-black/5 flex items-center justify-between gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalVisualizarModelo(null)}
                className="h-9 rounded-full text-xs"
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
                className="h-9 rounded-full text-xs font-semibold bg-[#192313] text-[#bada55] hover:bg-[#2a3820]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-black/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#192313]">
                  Certificado de Validade Jurídica
                </h3>
                <p className="text-[11px] text-[#192313]/60">
                  Assinatura Eletrônica Certificada
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-[#f7f8f2] p-4 rounded-2xl border border-black/5 text-xs text-[#192313]/80 mb-5">
              <div>
                <span className="text-[10px] text-[#192313]/40 block">Contrato</span>
                <span className="font-semibold text-[#192313]">{modalCertificadoContrato.titulo}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#192313]/40 block">Signatário</span>
                <span className="font-bold text-[#192313]">{modalCertificadoContrato.assinatura_cliente_nome}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#192313]/40 block">Documento (CPF / CNPJ)</span>
                <span className="font-semibold text-[#192313]">{modalCertificadoContrato.assinatura_cliente_doc}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#192313]/40 block">Data e Hora da Assinatura</span>
                <span className="font-semibold text-[#192313]">
                  {modalCertificadoContrato.assinatura_cliente_data
                    ? new Date(modalCertificadoContrato.assinatura_cliente_data).toLocaleString('pt-BR')
                    : 'Registrada'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#192313]/40 block">Endereço IP Registrado</span>
                <span className="font-mono text-[11px] text-[#192313]">{modalCertificadoContrato.assinatura_cliente_ip || '127.0.0.1'}</span>
              </div>
            </div>

            <Button
              onClick={() => setModalCertificadoContrato(null)}
              className="w-full h-10 rounded-full text-xs font-semibold bg-[#192313] text-white hover:bg-[#2a3820]"
            >
              Concluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
