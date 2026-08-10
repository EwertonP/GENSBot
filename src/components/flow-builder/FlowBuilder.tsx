'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { X, Save, AlertTriangle, History, RotateCcw } from 'lucide-react';
import type { Automation } from '@/types/automation';
import type { FlowDefinition, FlowNode, FlowNodeType, FlowNodeConfig } from '@/types/flow';
import { nodeTypes } from './nodes';
import NodePalette from './NodePalette';
import { NodeConfigPanel } from './panels';
import { validateFlow, type FlowValidationIssue } from './flowValidation';
import { legacyAutomationToFlowDefinition } from '@/lib/flow-engine/compat';
import VersionHistoryPanel from './VersionHistoryPanel';

let idCounter = 0;
function nextId(type: FlowNodeType) {
  idCounter += 1;
  return `${type}-${Date.now()}-${idCounter}`;
}

function defaultDataFor(type: FlowNodeType): FlowNodeConfig['data'] {
  switch (type) {
    case 'trigger':
      return { triggerTypes: ['dm'], keywords: [], match_type: 'contains' };
    case 'sendMessage':
      return { text: '' };
    case 'condition':
      return { conditionType: 'keyword', keywords: [], match_type: 'contains' };
    case 'delay':
      return { delayMinutes: 5 };
    case 'action':
      return { actionType: 'add_tag', tag: '' };
  }
}

function toRfNodes(flow: FlowDefinition): Node[] {
  return flow.nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data as any }));
}
function toRfEdges(flow: FlowDefinition): Edge[] {
  return flow.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined }));
}

interface FlowBuilderProps {
  automation: Automation;
  onClose: () => void;
  onSaved: (updated: Automation) => void;
}

export default function FlowBuilder({ automation, onClose, onSaved }: FlowBuilderProps) {
  const initialFlow = useMemo<FlowDefinition>(
    () => automation.flow_definition || legacyAutomationToFlowDefinition(automation),
    [automation],
  );
  const isMigrated = !automation.flow_definition;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(toRfNodes(initialFlow));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toRfEdges(initialFlow));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issues, setIssues] = useState<FlowValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sequences, setSequences] = useState<{ id?: string; name: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewing, setViewing] = useState<{ versionId: string; flow: FlowDefinition } | null>(null);
  const [currentAutomation, setCurrentAutomation] = useState(automation);

  useEffect(() => {
    fetch('/api/sequences')
      .then((res) => res.json())
      .then((data) => setSequences(Array.isArray(data) ? data : []))
      .catch(() => setSequences([]));
  }, []);

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

  const handleAddNode = useCallback(
    (type: FlowNodeType) => {
      const id = nextId(type);
      const newNode: Node = {
        id,
        type,
        position: { x: 80 + Math.random() * 200, y: 80 + nodes.length * 40 },
        data: defaultDataFor(type) as any,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes.length, setNodes],
  );

  const selectedNode = nodes.find((n) => n.id === selectedId) as (Node & { type: FlowNodeType }) | undefined;

  const handleNodeDataChange = useCallback(
    (data: FlowNode['data']) => {
      if (!selectedId) return;
      setNodes((nds) => nds.map((n) => (n.id === selectedId ? { ...n, data: data as any } : n)));
    },
    [selectedId, setNodes],
  );

  const buildFlowDefinition = useCallback((): FlowDefinition => {
    return {
      nodes: nodes.map((n) => ({ id: n.id, type: n.type as FlowNodeType, position: n.position, data: n.data as any })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: (e.sourceHandle as string) ?? null })),
    };
  }, [nodes, edges]);

  const handleSave = useCallback(async () => {
    const flow = buildFlowDefinition();
    const problems = validateFlow(flow);
    setIssues(problems);
    if (problems.length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/automations/${currentAutomation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentAutomation, flow_definition: flow }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar o fluxo.');
      setCurrentAutomation(data);
      onSaved(data);
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao salvar o fluxo.');
    } finally {
      setSaving(false);
    }
  }, [currentAutomation, buildFlowDefinition, onSaved]);

  const handleViewVersion = useCallback((flow: FlowDefinition, versionId: string) => {
    setViewing({ versionId, flow });
    setSelectedId(null);
  }, []);

  const handleRestoreVersion = useCallback(
    async (versionId: string) => {
      setSaveError(null);
      try {
        const res = await fetch(`/api/automations/${currentAutomation.id}/versions/${versionId}/restore`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao restaurar versão.');
        setCurrentAutomation(data);
        setNodes(toRfNodes(data.flow_definition));
        setEdges(toRfEdges(data.flow_definition));
        setViewing(null);
      } catch (err: any) {
        setSaveError(err.message || 'Erro ao restaurar versão.');
      }
    },
    [currentAutomation.id, setNodes, setEdges],
  );

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-foreground">Editor visual — {automation.name}</h2>
          {isMigrated && (
            <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3" /> Automação ainda não migrada para o canvas — salvar aqui converte.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saveError && <span className="text-[10px] text-destructive font-bold">{saveError}</span>}
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer border ${
              showHistory ? 'bg-accent border-primary text-primary' : 'border-border text-muted-foreground hover:bg-accent'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Histórico
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !!viewing}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg text-muted-foreground cursor-pointer" aria-label="Fechar editor visual">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2 flex flex-col gap-1">
          {issues.map((issue, i) => (
            <p key={i} className="text-[10px] text-destructive font-bold">
              {issue.message}
            </p>
          ))}
        </div>
      )}

      {viewing && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold text-amber-600">Visualizando uma versão antiga (somente leitura).</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRestoreVersion(viewing.versionId)}
              className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/90 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Restaurar esta versão
            </button>
            <button onClick={() => setViewing(null)} className="text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer">
              Voltar para edição
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {!viewing && <NodePalette onAdd={handleAddNode} />}

        <div className="flex-1">
          <ReactFlow
            nodes={viewing ? toRfNodes(viewing.flow) : nodes}
            edges={viewing ? toRfEdges(viewing.flow) : edges}
            onNodesChange={viewing ? undefined : onNodesChange}
            onEdgesChange={viewing ? undefined : onEdgesChange}
            onConnect={viewing ? undefined : onConnect}
            onNodeClick={viewing ? undefined : (_, node) => setSelectedId(node.id)}
            onPaneClick={viewing ? undefined : () => setSelectedId(null)}
            nodesDraggable={!viewing}
            nodesConnectable={!viewing}
            elementsSelectable={!viewing}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {showHistory && (
          <VersionHistoryPanel
            automationId={currentAutomation.id!}
            onClose={() => setShowHistory(false)}
            onView={handleViewVersion}
            onRestore={handleRestoreVersion}
            viewingVersionId={viewing?.versionId ?? null}
          />
        )}

        {!viewing && !showHistory && selectedNode && (
          <NodeConfigPanel
            node={{ id: selectedNode.id, type: selectedNode.type, position: selectedNode.position, data: selectedNode.data as any }}
            onChange={handleNodeDataChange}
            onClose={() => setSelectedId(null)}
            sequences={sequences}
          />
        )}
      </div>
    </div>
  );
}
