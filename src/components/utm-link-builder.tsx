'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Trash2, Link2, Check, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import type { UtmLink } from '@/types/utm-link';
import { buildUtmUrl } from '@/lib/utm';
import { fieldInputClass as inputCls, fieldLabelClass as labelCls } from '@/lib/form-styles';

const SOURCE_SUGGESTIONS = ['instagram', 'whatsapp', 'email', 'facebook'];
const MEDIUM_SUGGESTIONS = ['bio', 'dm_automation', 'story', 'post', 'anuncio'];

function SuggestInput({ value, onChange, suggestions, placeholder }: { value: string; onChange: (v: string) => void; suggestions: string[]; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} list={`suggest-${placeholder}`} />
      <datalist id={`suggest-${placeholder}`}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-1">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
              value === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 text-[10px] font-bold text-foreground bg-background hover:bg-accent border border-border rounded px-2 py-1 cursor-pointer"
    >
      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  );
}

interface UtmLinkBuilderProps {
  /** Constrói a URL da API já com `?account=...` — mesma função usada pelo resto do dashboard. Passado pra escopar o seletor de automação à conta ativa. */
  withAccount: (url: string) => string;
}

interface AutomationOption {
  id: string;
  name: string;
}

/** Criador de links UTM com rastreamento de clique (redirect via src/app/r/[code]), histórico e vínculo opcional com uma automação. */
export default function UtmLinkBuilder({ withAccount }: UtmLinkBuilderProps) {
  const [links, setLinks] = useState<UtmLink[]>([]);
  const [automations, setAutomations] = useState<AutomationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [source, setSource] = useState('instagram');
  const [medium, setMedium] = useState('bio');
  const [campaign, setCampaign] = useState('');
  const [term, setTerm] = useState('');
  const [content, setContent] = useState('');
  const [automationId, setAutomationId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

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
      setAutomations(Array.isArray(automationsData) ? automationsData.map((a: any) => ({ id: a.id, name: a.name })) : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = useMemo(() => {
    if (!baseUrl.trim()) return null;
    try {
      return buildUtmUrl(baseUrl.trim(), { utm_source: source, utm_medium: medium, utm_campaign: campaign, utm_term: term, utm_content: content });
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
  };

  const handleSave = async () => {
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
      const res = await fetch(withAccount(editingId ? `/api/utm-links/${editingId}` : '/api/utm-links'), {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
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
    await fetch(withAccount(`/api/utm-links/${id}`), { method: 'DELETE' });
    if (editingId === id) resetForm();
    await load();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{editingId ? 'Editar link' : 'Novo link'}</h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancelar edição
            </button>
          )}
        </div>

        {error && <p className="text-[11px] text-destructive font-bold">{error}</p>}

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>URL de destino</label>
          <input className={inputCls} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://seusite.com/pagina" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Origem (utm_source)</label>
            <SuggestInput value={source} onChange={setSource} suggestions={SOURCE_SUGGESTIONS} placeholder="origem" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Meio (utm_medium)</label>
            <SuggestInput value={medium} onChange={setMedium} suggestions={MEDIUM_SUGGESTIONS} placeholder="meio" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Campanha (utm_campaign)</label>
          <input className={inputCls} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="lancamento_agosto" />
        </div>

        {automations.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Vincular a uma automação (opcional)</label>
            <select
              className={inputCls}
              value={automationId}
              onChange={(e) => setAutomationId(e.target.value)}
            >
              <option value="">Nenhuma — link avulso</option>
              {automations.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="text-[9px] text-muted-foreground">
              Vinculando, os cliques neste link contam no ranking de automações do dashboard.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-foreground self-start cursor-pointer"
        >
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Avançado (utm_term / utm_content)
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Termo (utm_term)</label>
              <input className={inputCls} value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Conteúdo (utm_content)</label>
              <input className={inputCls} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Nome do link (opcional, só pra identificar no histórico)</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bio - lançamento agosto" />
        </div>

        {preview && (
          <div className="bg-muted/40 border border-border rounded-lg p-3 flex flex-col gap-1">
            <p className="text-[11px] font-mono text-foreground break-all">
              {preview === 'invalid' ? <span className="text-destructive">URL inválida</span> : preview}
            </p>
            {preview !== 'invalid' && (
              <p className="text-[9px] text-muted-foreground">
                {editingId
                  ? 'O link curto continua o mesmo — só o destino/parâmetros mudam.'
                  : 'Ao salvar, um link curto de rastreamento é gerado — é ele que registra o clique.'}
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="self-start flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Salvar link'}
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">Histórico</h3>
        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : links.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-10 text-center flex flex-col items-center gap-3">
            <Link2 className="w-6 h-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Nenhum link gerado ainda.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
            {links.map((link) => {
              const linkedAutomation = automations.find(a => a.id === link.automation_id);
              return (
              <div key={link.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {link.name && <p className="text-xs font-bold text-foreground truncate">{link.name}</p>}
                    {linkedAutomation && (
                      <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                        {linkedAutomation.name}
                      </span>
                    )}
                    <span className="text-[9px] font-bold text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full">
                      {link.click_count || 0} clique{(link.click_count || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-primary truncate">{link.short_url || link.generated_url}</p>
                  <p className="text-[9px] font-mono text-muted-foreground truncate">{link.generated_url}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <CopyButton text={link.short_url || link.generated_url} />
                  <button
                    onClick={() => startEdit(link)}
                    aria-label="Editar link"
                    className="p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => link.id && handleDelete(link.id)}
                    aria-label="Excluir link"
                    className="p-1.5 hover:bg-accent text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
