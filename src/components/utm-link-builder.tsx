'use client';
import { DataTable, DataTablePagination } from '@/components/ui/data-table';
import { IconButton } from '@/components/ui/icon-button';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Trash2,
  Link2,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  QrCode,
  Sparkles,
  MousePointerClick,
  TrendingUp,
  Share2,
  BarChart3,
  Phone,
  Mail,
  Megaphone,
  Search,
} from 'lucide-react';
import { Instagram } from '@/components/instagram-icon';
import { ClienteAvatar } from '@/components/cliente-avatar';
import type { UtmLink } from '@/types/utm-link';
import { buildUtmUrl } from '@/lib/utm';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { confirmDialog, DialogShell } from '@/components/ui/dialog';
import { QrCodeStyled } from '@/components/qr-code-styled';

interface UtmLinkBuilderProps {
  withAccount: (url: string) => string;
}

interface AutomationOption {
  id: string;
  name: string;
}

interface PresetCanal {
  id: string;
  label: string;
  source: string;
  medium: string;
  icon: any;
  color: string;
}

const PRESETS: PresetCanal[] = [
  { id: 'bio', label: 'Instagram Bio', source: 'instagram', medium: 'bio', icon: Instagram, color: 'text-pink-700 dark:text-pink-300' },
  { id: 'reels', label: 'Reels DM', source: 'instagram', medium: 'dm_automation', icon: Instagram, color: 'text-chart-4' },
  { id: 'story', label: 'Stories', source: 'instagram', medium: 'story', icon: Instagram, color: 'text-warning' },
  { id: 'whatsapp', label: 'WhatsApp Chat', source: 'whatsapp', medium: 'chat', icon: Phone, color: 'text-success' },
  { id: 'ads', label: 'Meta Ads (Tráfego)', source: 'facebook_ads', medium: 'cpc', icon: Megaphone, color: 'text-info' },
  { id: 'email', label: 'E-mail Marketing', source: 'email', medium: 'newsletter', icon: Mail, color: 'text-indigo-700 dark:text-indigo-300' },
];

const LINKS_POR_PAGINA = 25;

function Vazio() {
  return <span className="text-muted-foreground">—</span>;
}

export default function UtmLinkBuilder({ withAccount }: UtmLinkBuilderProps) {
  const [links, setLinks] = useState<UtmLink[]>([]);
  const [automations, setAutomations] = useState<AutomationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [source, setSource] = useState('instagram');
  const [medium, setMedium] = useState('bio');
  const [campaign, setCampaign] = useState('');
  const [term, setTerm] = useState('');
  const [content, setContent] = useState('');
  const [automationId, setAutomationId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrLink, setQrLink] = useState<{ url: string; name: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [linksRes, automationsRes] = await Promise.all([
        fetch(withAccount('/api/utm-links')),
        fetch(withAccount('/api/automations')),
      ]);
      const linksData = await linksRes.json();
      const automationsData = await automationsRes.json();
      setLinks(Array.isArray(linksData) ? linksData : []);
      setAutomations(
        Array.isArray(automationsData)
          ? automationsData.map((a: any) => ({ id: a.id, name: a.name }))
          : []
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const preview = useMemo(() => {
    if (!baseUrl.trim()) return null;
    try {
      return buildUtmUrl(baseUrl.trim(), {
        utm_source: source,
        utm_medium: medium,
        utm_campaign: campaign,
        utm_term: term,
        utm_content: content,
      });
    } catch {
      return 'invalid';
    }
  }, [baseUrl, source, medium, campaign, term, content]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setBaseUrl('');
    setSource('instagram');
    setMedium('bio');
    setCampaign('');
    setTerm('');
    setContent('');
    setAutomationId('');
    setError(null);
  };

  const startEdit = (link: UtmLink) => {
    setEditingId(link.id || null);
    setName(link.name || '');
    setBaseUrl(link.base_url);
    setSource(link.utm_source || '');
    setMedium(link.utm_medium || '');
    setCampaign(link.utm_campaign || '');
    setTerm(link.utm_term || '');
    setContent(link.utm_content || '');
    setAutomationId(link.automation_id || '');
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyPreset = (preset: PresetCanal) => {
    setSource(preset.source);
    setMedium(preset.medium);
    if (!campaign) {
      setCampaign(preset.id);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview || preview === 'invalid') {
      setError('Informe uma URL de destino válida (ex: https://seusite.com).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name || null,
        base_url: baseUrl.trim(),
        utm_source: source || null,
        utm_medium: medium || null,
        utm_campaign: campaign || null,
        utm_term: term || null,
        utm_content: content || null,
        automation_id: automationId || null,
      };
      const res = await fetch(
        withAccount(editingId ? `/api/utm-links/${editingId}` : '/api/utm-links'),
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar o link.');
      resetForm();
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({title: "Excluir este link UTM?",description: "O link curto para de redirecionar e os cliques registrados deixam de aparecer aqui.",confirmLabel: "Excluir link",tone: "destructive"}))) return;
    await fetch(withAccount(`/api/utm-links/${id}`), { method: 'DELETE' });
    if (editingId === id) resetForm();
    await load();
  };

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // silencioso
    }
  };

  // KPIs
  const totalCliques = useMemo(() => {
    return links.reduce((acc, l) => acc + (l.click_count || 0), 0);
  }, [links]);

  const [busca, setBusca] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [pagina, setPagina] = useState(1);

  const clientesDosLinks = useMemo(
    () => Array.from(new Set(links.map((l) => l.cliente?.nome).filter((n): n is string => !!n))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [links]
  );

  const linksFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return links
      .filter((l) => !filtroCliente || l.cliente?.nome === filtroCliente)
      .filter((l) => !termo || [l.name, l.utm_campaign, l.base_url, l.short_code].some((v) => v?.toLowerCase().includes(termo)))
      .sort((a, b) => (b.click_count || 0) - (a.click_count || 0));
  }, [links, busca, filtroCliente]);

  const totalPaginas = Math.max(1, Math.ceil(linksFiltrados.length / LINKS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const linksPagina = linksFiltrados.slice((paginaAtual - 1) * LINKS_POR_PAGINA, paginaAtual * LINKS_POR_PAGINA);
  const urlCurta = (l: UtmLink) => l.short_url || `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${l.short_code}`;

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* 1. Header & KPIs */}
      <div className="flex flex-col gap-4">
        <div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono">
            Rastreamento de Conversões · GENSBot
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground tracking-tight flex items-center gap-2.5 mt-0.5">
            <span>Links UTM & Campanhas</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-foreground font-mono font-bold">
              {links.length} links
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Gere links inteligentes com rastreamento de cliques para Bio, Stories, Reels DMs e anúncios da agência.
          </p>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4 rounded-2xl border border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total de Cliques
              </p>
              <h3 className="text-2xl font-bold font-display text-foreground mt-0.5 font-mono">
                {totalCliques}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-lime/40 flex items-center justify-center text-foreground">
              <MousePointerClick className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Links Criados
              </p>
              <h3 className="text-2xl font-bold font-display text-foreground mt-0.5 font-mono">
                {links.length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-foreground">
              <Link2 className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Canal Principal
              </p>
              <h3 className="text-sm font-bold font-display text-foreground mt-1 truncate">
                {links[0]?.utm_source || 'Instagram'} ({links[0]?.utm_medium || 'Bio'})
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-foreground">
              <TrendingUp className="w-5 h-5" />
            </div>
          </Card>
        </div>
      </div>

      {/* 2. Layout em 2 Colunas: Construtor + Live Preview com QR Code */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulário Construtor */}
        <Card className="lg:col-span-7 p-6 rounded-2xl border border-border bg-card shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-display text-foreground">
              {editingId ? 'Editar Link UTM' : 'Criar Novo Link UTM'}
            </h3>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={resetForm} className="text-xs h-7">
                Cancelar Edição
              </Button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            {/* Presets de 1 Clique */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Canais Populares (Preenchimento Rápido)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => {
                  const isSelected = source === p.source && medium === p.medium;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`text-xs px-2.5 py-1 rounded-xl border flex items-center gap-1.5 transition-ui cursor-pointer ${
                        isSelected
                          ? 'bg-card border-foreground/30 shadow-2xs font-bold text-foreground ring-1 ring-foreground/20'
                          : 'border-border hover:bg-accent/60 text-muted-foreground'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${p.color}`} />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nome do Link */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Nome da Campanha / Identificador
              </label>
              <Input
                placeholder="Ex.: Bio Principal / Campanha Clareamento / Reels Bastidores"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* URL Base */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                URL de Destino (Site / WhatsApp / Landing Page)
              </label>
              <Input
                placeholder="https://agenciagens.com.br/contato ou https://sitecliente.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required
              />
            </div>

            {/* Origem e Meio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Origem (<span className="font-mono text-xs">utm_source</span>)
                </label>
                <Input
                  placeholder="instagram, whatsapp, email..."
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Meio (<span className="font-mono text-xs">utm_medium</span>)
                </label>
                <Input
                  placeholder="bio, story, dm_automation, cpc..."
                  value={medium}
                  onChange={(e) => setMedium(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Campanha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Nome da Campanha (<span className="font-mono text-xs">utm_campaign</span>)
              </label>
              <Input
                placeholder="Ex.: lancamento_outubro / clareamento_2026"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
              />
            </div>

            {/* Vínculo de Automação */}
            {automations.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Vincular à Automação de DM (Opcional)
                </label>
                <Select
                  value={automationId}
                  onChange={(e) => setAutomationId(e.target.value)}
                >
                  <option value="">Nenhuma — link avulso</option>
                  {automations.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Parâmetros Avançados */}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground self-start cursor-pointer py-1"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>Parâmetros Avançados (Termo e Conteúdo)</span>
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Termo (<span className="font-mono text-xs">utm_term</span>)
                  </label>
                  <Input
                    placeholder="Palavra-chave ou público"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Conteúdo (<span className="font-mono text-xs">utm_content</span>)
                  </label>
                  <Input
                    placeholder="Variante de criativo (ex: video1)"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button type="submit" variant="primary" loading={saving} className="rounded-xl shadow-xs w-full sm:w-auto">
                {editingId ? 'Salvar Alterações' : 'Gerar e Rastrear Link'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Live Preview Card com QR Code */}
        <Card className="lg:col-span-5 p-6 rounded-2xl border border-border bg-card shadow-2xs flex flex-col gap-4 sticky top-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
              Preview em Tempo Real
            </span>
            <Badge variant="success" className="text-xs font-bold">
              Rastreamento Ativo
            </Badge>
          </div>

          {preview && preview !== 'invalid' ? (
            <div className="flex flex-col gap-4">
              {/* URL Gerada */}
              <div className="p-3.5 rounded-xl bg-accent/40 border border-border flex flex-col gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  URL Final com Parâmetros
                </span>
                <p className="text-xs font-mono text-foreground break-all leading-relaxed bg-background/60 p-2 rounded-lg border border-border">
                  {preview}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyText(preview, 'preview')}
                    className="text-xs"
                  >
                    {copiedId === 'preview' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-success mr-1" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copiar URL Longa
                      </>
                    )}
                  </Button>

                  <a
                    href={preview}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Testar
                  </a>
                </div>
              </div>

              {/* QR Code */}
              <div className="p-4 rounded-xl bg-accent/30 border border-border flex flex-col items-center justify-center text-center gap-2.5">
                <QrCodeStyled data={preview} size={128} />
                <div className="leading-tight">
                  <p className="text-xs font-bold text-foreground">Prévia do QR Code</p>
                  <p className="text-xs text-muted-foreground">
                    Depois de salvar, baixe o QR do link curto na tabela abaixo. Ele conta os cliques.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <QrCode className="w-10 h-10 text-muted-foreground" />
              <p className="text-xs">
                Preencha a URL de destino para visualizar o link gerado e o QR Code.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* 3. Links cadastrados, no padrão de tabela da Audiência */}
      <Card padding="lg" className="rounded-2xl shadow-sm flex flex-col gap-4 text-foreground">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-title font-bold text-foreground">Links cadastrados</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Do mais clicado para o menos clicado. Clique num link para editar.</p>
          </div>
          <Badge variant="muted" className="tabular-nums">
            {links.length} link{links.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {links.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar por nome, campanha ou destino" aria-label="Buscar links" className="pl-9" />
            </div>
            {clientesDosLinks.length > 1 && (
              <Select value={filtroCliente} onChange={(e) => { setFiltroCliente(e.target.value); setPagina(1); }} aria-label="Filtrar por cliente" className="max-w-[220px]">
                <option value="">Todos os clientes</option>
                {clientesDosLinks.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}

        <DataTable
          rows={linksPagina}
          loading={loading}
          getRowId={(l) => l.id || l.generated_url}
          onRowClick={startEdit}
          empty={
            links.length === 0 ? (
              <EmptyState size="compact" icon={Link2} title="Nenhum link UTM cadastrado" description="Crie o primeiro link acima para começar a rastrear acessos." />
            ) : (
              <EmptyState size="compact" icon={Search} title="Nenhum link encontrado" description="Nenhum link bate com essa busca ou cliente." action={{ label: 'Limpar filtros', onClick: () => { setBusca(''); setFiltroCliente(''); } }} />
            )
          }
          columns={[
            {
              id: 'nome',
              header: 'Link',
              mobile: 'primary',
              cell: (l) => (
                <div className="min-w-0 sm:min-w-[180px]">
                  <button type="button" onClick={(e) => { e.stopPropagation(); startEdit(l); }} className="font-semibold text-foreground truncate block max-w-[240px] text-left hover:underline cursor-pointer">
                    {l.name || 'Sem nome'}
                  </button>
                  {l.utm_campaign && <span className="text-xs text-muted-foreground font-mono truncate block max-w-[240px]">{l.utm_campaign}</span>}
                </div>
              ),
            },
            {
              id: 'cliente',
              header: 'Cliente',
              cell: (l) =>
                l.cliente?.nome ? (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <ClienteAvatar nome={l.cliente.nome} cor={l.cliente.cor} fotoUrl={l.cliente.foto_url} tamanho="xs" />
                    <span className="truncate max-w-[160px]">{l.cliente.nome}</span>
                  </span>
                ) : (
                  <Vazio />
                ),
            },
            { id: 'canal', header: 'Canal', className: 'text-muted-foreground whitespace-nowrap', cell: (l) => `${l.utm_source || 'link'} / ${l.utm_medium || 'geral'}` },
            {
              id: 'curto',
              header: 'Link curto',
              cell: (l) =>
                l.short_code ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleCopyText(urlCurta(l), l.id || ''); }}
                    className="inline-flex items-center gap-1 font-mono text-brand-text hover:underline cursor-pointer whitespace-nowrap"
                    aria-label={`Copiar link curto /r/${l.short_code}`}
                  >
                    /r/{l.short_code}
                    {copiedId === l.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                ) : (
                  <Vazio />
                ),
            },
            {
              id: 'destino',
              header: 'Destino',
              mobile: 'hidden',
              className: 'text-muted-foreground max-w-[240px] truncate',
              cell: (l) => (
                <a href={l.generated_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="hover:text-foreground hover:underline">
                  {l.base_url}
                </a>
              ),
            },
            { id: 'cliques', header: 'Cliques', align: 'right', className: 'font-semibold text-foreground tabular-nums', cell: (l) => (l.click_count || 0).toLocaleString('pt-BR') },
          ]}
          actions={(l) => (
            <>
              {l.short_code && (
                <IconButton label="QR Code do link curto" onClick={() => setQrLink({ url: urlCurta(l), name: `qr-${l.short_code}` })}>
                  <QrCode />
                </IconButton>
              )}
              <IconButton label="Excluir link" tone="destructive" onClick={() => l.id && handleDelete(l.id)}>
                <Trash2 />
              </IconButton>
            </>
          )}
        />

        <DataTablePagination page={paginaAtual} totalPages={totalPaginas} onPage={setPagina} />
      </Card>

      <DialogShell open={!!qrLink} onRequestClose={() => setQrLink(null)} aria-label="QR Code do link" className="w-full max-w-sm">
        {qrLink && (
          <div className="p-6 flex flex-col items-center gap-4 text-center">
            <div className="leading-tight">
              <h3 className="text-sm font-bold font-display text-foreground">QR Code do link curto</h3>
              <p className="text-xs text-muted-foreground font-mono mt-1 break-all">{qrLink.url}</p>
            </div>
            <QrCodeStyled data={qrLink.url} size={220} fileName={qrLink.name} />
            <p className="text-xs text-muted-foreground">
              Cada leitura conta como clique. Dá pra mudar o destino depois sem reimprimir.
            </p>
          </div>
        )}
      </DialogShell>
    </div>
  );
}
