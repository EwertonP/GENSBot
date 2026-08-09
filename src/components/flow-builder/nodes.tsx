'use client';

import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Zap, MessageSquare, GitBranch, Clock, Tag } from 'lucide-react';
import type { FlowNodeType } from '@/types/flow';

const NODE_META: Record<FlowNodeType, { label: string; icon: React.ElementType; color: string }> = {
  trigger: { label: 'Gatilho', icon: Zap, color: 'border-amber-500 bg-amber-500/10 text-amber-600' },
  sendMessage: { label: 'Mensagem', icon: MessageSquare, color: 'border-primary bg-primary/10 text-primary' },
  condition: { label: 'Condição', icon: GitBranch, color: 'border-violet-500 bg-violet-500/10 text-violet-600' },
  delay: { label: 'Espera', icon: Clock, color: 'border-sky-500 bg-sky-500/10 text-sky-600' },
  action: { label: 'Ação', icon: Tag, color: 'border-emerald-500 bg-emerald-500/10 text-emerald-600' },
};

function BaseNode({ type, selected, subtitle }: { type: FlowNodeType; selected?: boolean; subtitle?: string }) {
  const meta = NODE_META[type];
  const Icon = meta.icon;
  return (
    <div
      className={`min-w-[180px] rounded-lg border-2 bg-card px-3 py-2 shadow-sm ${meta.color} ${selected ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
    >
      {type !== 'trigger' && <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />}
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs font-bold text-foreground">{meta.label}</span>
      </div>
      {subtitle && <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{subtitle}</p>}
      {type === 'condition' ? (
        <>
          <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} className="!bg-emerald-500 !w-2 !h-2" />
          <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} className="!bg-destructive !w-2 !h-2" />
          <div className="mt-1 flex justify-between text-[8px] font-bold text-muted-foreground px-1">
            <span>sim</span>
            <span>não</span>
          </div>
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!bg-border !w-2 !h-2" />
      )}
    </div>
  );
}

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as any;
  return <BaseNode type="trigger" selected={selected} subtitle={(d.keywords || []).join(', ') || d.triggerTypes?.join(', ')} />;
}

export function SendMessageNode({ data, selected }: NodeProps) {
  const d = data as any;
  return <BaseNode type="sendMessage" selected={selected} subtitle={d.text} />;
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as any;
  const subtitle =
    d.conditionType === 'keyword' ? `palavra-chave: ${(d.keywords || []).join(', ')}` :
    d.conditionType === 'tag' ? `tag ${d.tagPresence === 'not_has' ? 'ausente' : 'presente'}: ${d.tag || ''}` :
    d.conditionType === 'contact_field' ? `campo ${d.field}: ${d.operator}` : undefined;
  return <BaseNode type="condition" selected={selected} subtitle={subtitle} />;
}

export function DelayNode({ data, selected }: NodeProps) {
  const d = data as any;
  return <BaseNode type="delay" selected={selected} subtitle={`${d.delayMinutes ?? 0} min`} />;
}

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as any;
  const subtitle =
    d.actionType === 'add_tag' ? `adicionar tag: ${d.tag || ''}` :
    d.actionType === 'remove_tag' ? `remover tag: ${d.tag || ''}` :
    d.actionType === 'set_field' ? `definir ${d.field}: ${d.value || ''}` : undefined;
  return <BaseNode type="action" selected={selected} subtitle={subtitle} />;
}

export const nodeTypes = {
  trigger: TriggerNode,
  sendMessage: SendMessageNode,
  condition: ConditionNode,
  delay: DelayNode,
  action: ActionNode,
};

export const NODE_PALETTE_ITEMS: { type: FlowNodeType; label: string; icon: React.ElementType }[] = [
  { type: 'sendMessage', label: NODE_META.sendMessage.label, icon: NODE_META.sendMessage.icon },
  { type: 'condition', label: NODE_META.condition.label, icon: NODE_META.condition.icon },
  { type: 'delay', label: NODE_META.delay.label, icon: NODE_META.delay.icon },
  { type: 'action', label: NODE_META.action.label, icon: NODE_META.action.icon },
];

export { NODE_META };
