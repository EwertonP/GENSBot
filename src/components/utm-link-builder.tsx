'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Trash2, Link2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { UtmLink } from '@/types/utm-link';
import { buildUtmUrl } from '@/lib/utm';

const inputCls =
  'w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground transition-colors';
const labelCls = 'text-[10px] font-bold text-muted-foreground uppercase tracking-wider';

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

/** Criador de links UTM — ferramenta standalone (sem rastreamento de clique), com histórico dos links já gerados. */
export default function UtmLinkBuilder() {
  const [links, setLinks] = useState<UtmLink[]>([]);
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

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/utm-links');
      const data = await res.json();
      setLinks(Array.isArray(data) ? data : []);
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
      return buildUtmUrl(baseUrl.trim(), { utm_source: source, utm_medium: medium, utm_campaign: campaign, utm_term: term, utm_content: content });
    } catch {
      return 'invalid';
    }
  }, [baseUrl, source, medium, campaign, term, content]);

  const handleSave = async () => {
    if (!preview || preview === 'invalid') {
      setError('Informe uma URL de destino válida (ex: https://seusite.com).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/utm-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || null,
          base_url: baseUrl.trim(),
          utm_source: source || null,
          utm_medium: medium || null,
          utm_campaign: campaign || null,
          utm_term: term || null,
          utm_content: content || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar o link.');
      setName('');
      setBaseUrl('');
      setCampaign('');
      setTerm('');
      setContent('');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/utm-links/${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
        <h3 className="text-sm font-bold text-foreground">Novo link</h3>

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
          <div className="bg-muted/40 border border-border rounded-lg p-3 flex items-center justify-between gap-3">
            <p className="text-[11px] font-mono text-foreground break-all">
              {preview === 'invalid' ? <span className="text-destructive">URL inválida</span> : preview}
            </p>
            {preview !== 'invalid' && <CopyButton text={preview} />}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="self-start flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          {saving ? 'Salvando...' : 'Salvar link'}
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
            {links.map((link) => (
              <div key={link.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {link.name && <p className="text-xs font-bold text-foreground truncate">{link.name}</p>}
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{link.generated_url}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <CopyButton text={link.generated_url} />
                  <button
                    onClick={() => link.id && handleDelete(link.id)}
                    aria-label="Excluir link"
                    className="p-1.5 hover:bg-accent text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
