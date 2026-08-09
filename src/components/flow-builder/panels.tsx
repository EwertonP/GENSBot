'use client';

import React from 'react';
import { X } from 'lucide-react';
import type {
  FlowNode,
  TriggerNodeConfig,
  SendMessageNodeConfig,
  ConditionNodeConfig,
  DelayNodeConfig,
  ActionNodeConfig,
} from '@/types/flow';

const inputCls =
  'w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary text-foreground placeholder-muted-foreground transition-colors';
const labelCls = 'text-[10px] font-bold text-muted-foreground uppercase tracking-wider';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function TriggerPanel({ data, onChange }: { data: TriggerNodeConfig; onChange: (d: TriggerNodeConfig) => void }) {
  const ALL_TYPES: TriggerNodeConfig['triggerTypes'] = ['dm', 'comment', 'story', 'story_mention'];
  const toggle = (t: TriggerNodeConfig['triggerTypes'][number]) => {
    const has = data.triggerTypes.includes(t);
    onChange({ ...data, triggerTypes: has ? data.triggerTypes.filter((x) => x !== t) : [...data.triggerTypes, t] });
  };
  return (
    <div className="flex flex-col gap-3">
      <Field label="Tipos de gatilho">
        <div className="flex flex-wrap gap-1.5">
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                data.triggerTypes.includes(t) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Palavras-chave (separadas por vírgula)">
        <input
          className={inputCls}
          value={data.keywords.join(', ')}
          onChange={(e) => onChange({ ...data, keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
        />
      </Field>
      <Field label="Tipo de correspondência">
        <select className={inputCls} value={data.match_type} onChange={(e) => onChange({ ...data, match_type: e.target.value as any })}>
          <option value="contains">Contém</option>
          <option value="exact">Exata</option>
          <option value="any">Qualquer mensagem</option>
        </select>
      </Field>
    </div>
  );
}

function SendMessagePanel({
  data,
  onChange,
  sequences,
}: {
  data: SendMessageNodeConfig;
  onChange: (d: SendMessageNodeConfig) => void;
  sequences: { id?: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Texto da mensagem">
        <textarea rows={4} className={inputCls} value={data.text} onChange={(e) => onChange({ ...data, text: e.target.value })} />
      </Field>
      <Field label="Botão de resposta rápida (opcional)">
        <input
          className={inputCls}
          value={data.quick_reply_button || ''}
          onChange={(e) => onChange({ ...data, quick_reply_button: e.target.value || null })}
        />
      </Field>
      <Field label="Link (opcional)">
        <input className={inputCls} value={data.link_url || ''} onChange={(e) => onChange({ ...data, link_url: e.target.value || null })} />
      </Field>
      {data.link_url && (
        <Field label="Texto do botão do link">
          <input
            className={inputCls}
            value={data.link_button_label || ''}
            onChange={(e) => onChange({ ...data, link_button_label: e.target.value || null })}
          />
        </Field>
      )}
      <Field label="Sequência de follow-up após esta mensagem (opcional)">
        <select
          className={inputCls}
          value={data.sequence_id || ''}
          onChange={(e) => onChange({ ...data, sequence_id: e.target.value || null })}
        >
          <option value="">Nenhuma</option>
          {sequences.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function ConditionPanel({ data, onChange }: { data: ConditionNodeConfig; onChange: (d: ConditionNodeConfig) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Tipo de condição">
        <select className={inputCls} value={data.conditionType} onChange={(e) => onChange({ ...data, conditionType: e.target.value as any })}>
          <option value="keyword">Palavra-chave na mensagem</option>
          <option value="tag">Tag do contato</option>
          <option value="contact_field">Campo do contato</option>
        </select>
      </Field>

      {data.conditionType === 'keyword' && (
        <>
          <Field label="Palavras-chave (separadas por vírgula)">
            <input
              className={inputCls}
              value={(data.keywords || []).join(', ')}
              onChange={(e) => onChange({ ...data, keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          </Field>
          <Field label="Tipo de correspondência">
            <select className={inputCls} value={data.match_type || 'contains'} onChange={(e) => onChange({ ...data, match_type: e.target.value as any })}>
              <option value="contains">Contém</option>
              <option value="exact">Exata</option>
            </select>
          </Field>
        </>
      )}

      {data.conditionType === 'tag' && (
        <>
          <Field label="Tag">
            <input className={inputCls} value={data.tag || ''} onChange={(e) => onChange({ ...data, tag: e.target.value })} />
          </Field>
          <Field label="Condição">
            <select className={inputCls} value={data.tagPresence || 'has'} onChange={(e) => onChange({ ...data, tagPresence: e.target.value as any })}>
              <option value="has">Contato tem a tag</option>
              <option value="not_has">Contato não tem a tag</option>
            </select>
          </Field>
        </>
      )}

      {data.conditionType === 'contact_field' && (
        <>
          <Field label="Campo">
            <select className={inputCls} value={data.field || 'email'} onChange={(e) => onChange({ ...data, field: e.target.value as any })}>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="name">Nome</option>
              <option value="username">Usuário</option>
            </select>
          </Field>
          <Field label="Operador">
            <select className={inputCls} value={data.operator || 'not_empty'} onChange={(e) => onChange({ ...data, operator: e.target.value as any })}>
              <option value="not_empty">Preenchido</option>
              <option value="is_empty">Vazio</option>
              <option value="equals">Igual a</option>
            </select>
          </Field>
          {data.operator === 'equals' && (
            <Field label="Valor">
              <input className={inputCls} value={data.value || ''} onChange={(e) => onChange({ ...data, value: e.target.value })} />
            </Field>
          )}
        </>
      )}
    </div>
  );
}

function DelayPanel({ data, onChange }: { data: DelayNodeConfig; onChange: (d: DelayNodeConfig) => void }) {
  return (
    <Field label="Atraso (minutos)">
      <input
        type="number"
        min={0}
        className={inputCls}
        value={data.delayMinutes}
        onChange={(e) => onChange({ ...data, delayMinutes: Number(e.target.value) })}
      />
    </Field>
  );
}

function ActionPanel({ data, onChange }: { data: ActionNodeConfig; onChange: (d: ActionNodeConfig) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Tipo de ação">
        <select className={inputCls} value={data.actionType} onChange={(e) => onChange({ ...data, actionType: e.target.value as any })}>
          <option value="add_tag">Adicionar tag</option>
          <option value="remove_tag">Remover tag</option>
          <option value="set_field">Definir campo do contato</option>
        </select>
      </Field>
      {(data.actionType === 'add_tag' || data.actionType === 'remove_tag') && (
        <Field label="Tag">
          <input className={inputCls} value={data.tag || ''} onChange={(e) => onChange({ ...data, tag: e.target.value })} />
        </Field>
      )}
      {data.actionType === 'set_field' && (
        <>
          <Field label="Campo">
            <select className={inputCls} value={data.field || 'email'} onChange={(e) => onChange({ ...data, field: e.target.value as any })}>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="name">Nome</option>
            </select>
          </Field>
          <Field label="Valor">
            <input className={inputCls} value={data.value || ''} onChange={(e) => onChange({ ...data, value: e.target.value })} />
          </Field>
        </>
      )}
    </div>
  );
}

/** Roteia pro painel de config certo conforme o tipo do nó selecionado. */
export function NodeConfigPanel({
  node,
  onChange,
  onClose,
  sequences = [],
}: {
  node: FlowNode;
  onChange: (data: FlowNode['data']) => void;
  onClose: () => void;
  sequences?: { id?: string; name: string }[];
}) {
  return (
    <div className="w-72 shrink-0 border-l border-border bg-card p-4 flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground">Configurar nó</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Fechar painel">
          <X className="w-4 h-4" />
        </button>
      </div>

      {node.type === 'trigger' && <TriggerPanel data={node.data as TriggerNodeConfig} onChange={onChange as any} />}
      {node.type === 'sendMessage' && (
        <SendMessagePanel data={node.data as SendMessageNodeConfig} onChange={onChange as any} sequences={sequences} />
      )}
      {node.type === 'condition' && <ConditionPanel data={node.data as ConditionNodeConfig} onChange={onChange as any} />}
      {node.type === 'delay' && <DelayPanel data={node.data as DelayNodeConfig} onChange={onChange as any} />}
      {node.type === 'action' && <ActionPanel data={node.data as ActionNodeConfig} onChange={onChange as any} />}
    </div>
  );
}
