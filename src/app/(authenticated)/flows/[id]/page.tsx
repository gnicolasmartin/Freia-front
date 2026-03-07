"use client";

import { use, useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Circle,
  Check,
  Loader2,
  Rocket,
  AlertCircle,
  X,
  History,
  Variable,
  Play,
  Shield,
  Wrench,
  Package,
} from "lucide-react";
import { ReactFlowProvider, type Node } from "@xyflow/react";
import { useFlows } from "@/providers/FlowsProvider";
import { usePolicies } from "@/providers/PoliciesProvider";
import { useAgents } from "@/providers/AgentsProvider";
import { useLLMConfig } from "@/providers/LLMConfigProvider";
import FlowCanvas, {
  type FlowCanvasHandle,
  type SaveState,
} from "@/components/flows/FlowCanvas";
import FlowToolbar from "@/components/flows/FlowToolbar";
import NodePropertiesPanel from "@/components/flows/NodePropertiesPanel";
import type { ValidationIssue } from "@/components/flows/FlowValidationPanel";
import FlowVersionHistory from "@/components/flows/FlowVersionHistory";
import FlowVariablesPanel from "@/components/flows/FlowVariablesPanel";
import FlowPoliciesPanel from "@/components/flows/FlowPoliciesPanel";
import FlowToolsPanel from "@/components/flows/FlowToolsPanel";
import FlowTestChat from "@/components/flows/FlowTestChat";
import type { SimulationHighlight } from "@/components/flows/SimulationHighlightContext";

export default function FlowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { getFlow, updateFlow, publishFlow, restoreVersion, updateFlowVariables, updateFlowTestPresets, updateFlowPolicies, updateFlowAllowedTools } = useFlows();
  const { policies } = usePolicies();
  const { agents } = useAgents();
  const { getRawKey } = useLLMConfig();

  // Pick the agent associated with this flow (prefer active, then any)
  const flowAgent = useMemo(() => {
    const linked = agents.filter((a) => a.flowId === id);
    return linked.find((a) => a.status === "active") ?? linked[0] ?? undefined;
  }, [agents, id]);
  const flowAgentApiKey = flowAgent ? (getRawKey("openai") ?? undefined) : undefined;
  const activePolicies = policies.filter((p) => p.active);
  const flow = getFlow(id);
  const effectivePolicies = useMemo(
    () =>
      activePolicies.filter(
        (p) =>
          p.scope === "global" ||
          (p.scope === "flow" && (flow?.policyIds ?? []).includes(p.id)) ||
          (p.scope === "channel" && (p.channelIds ?? []).length > 0)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePolicies, flow?.policyIds]
  );
  const canvasRef = useRef<FlowCanvasHandle>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [autoSave, setAutoSave] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({
    status: "saved",
    lastSavedAt: null,
  });
  const [publishErrors, setPublishErrors] = useState<ValidationIssue[] | null>(
    null
  );
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [showTestChat, setShowTestChat] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [simHighlight, setSimHighlight] = useState<SimulationHighlight | null>(null);

  const handleNodeSelect = useCallback((node: Node | null) => {
    setSelectedNode(node);
  }, []);

  const handleNodeDataUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      canvasRef.current?.updateNodeData(nodeId, data);
      setSelectedNode((prev) =>
        prev && prev.id === nodeId ? { ...prev, data } : prev
      );
    },
    []
  );

  const handleSave = useCallback(() => {
    canvasRef.current?.save();
  }, []);

  const handleSaveStateChange = useCallback((state: SaveState) => {
    setSaveState(state);
  }, []);

  const handlePublish = useCallback(() => {
    // Save first if dirty
    canvasRef.current?.save();

    // Run full validation
    const issues = canvasRef.current?.validate() ?? [];
    const errors = issues.filter((i) => i.type === "error");

    if (errors.length > 0) {
      setPublishErrors(errors);
      return;
    }

    // No errors — create immutable version and publish
    publishFlow(id);
    setPublishErrors(null);
  }, [id, publishFlow]);

  const handlePublishErrorClick = useCallback(
    (issue: ValidationIssue) => {
      if (issue.nodeId) {
        canvasRef.current?.focusNode(issue.nodeId);
        setPublishErrors(null);
      }
    },
    []
  );

  const handleRestoreVersion = useCallback(
    (versionId: string) => {
      const restored = restoreVersion(id, versionId);
      if (restored) {
        canvasRef.current?.loadVersion(restored.nodes, restored.edges);
        setSelectedNode(null);
      }
    },
    [id, restoreVersion]
  );

  // Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  if (!flow) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-slate-400 text-lg">Flujo no encontrado</p>
        <button
          onClick={() => router.push("/flows")}
          className="mt-4 text-[#dd7430] hover:text-orange-400 text-sm font-medium"
        >
          Volver a flujos
        </button>
      </div>
    );
  }

  const isActive = flow.status === "active";
  const versions = flow.versions ?? [];
  const currentVersion = versions.length > 0
    ? versions[versions.length - 1]
    : null;
  const hasBeenPublished = versions.length > 0;
  const isDraftModified =
    hasBeenPublished &&
    currentVersion &&
    flow.updatedAt > currentVersion.publishedAt;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] sm:h-[calc(100vh-7rem)] lg:h-screen -m-4 sm:-m-6 lg:-m-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/flows")}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="Volver a flujos"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-white truncate">
                {flow.name}
              </h1>
              <FlowStatusBadge
                isActive={isActive}
                hasBeenPublished={hasBeenPublished}
                isDraftModified={!!isDraftModified}
              />
              {currentVersion && (
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                  v{currentVersion.version}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <SaveStatusIndicator saveState={saveState} />
              <span className="text-xs text-slate-500">
                Modificado{" "}
                {new Date(flow.updatedAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Version history toggle */}
          <button
            onClick={() => setShowVersionHistory(!showVersionHistory)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showVersionHistory
                ? "bg-slate-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            <History className="size-4" />
            <span className="hidden sm:inline">Versiones</span>
            {versions.length > 0 && (
              <span className="text-xs bg-slate-600 px-1.5 py-0.5 rounded">
                {versions.length}
              </span>
            )}
          </button>

          {/* Variables toggle */}
          <button
            onClick={() => setShowVariables(!showVariables)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showVariables
                ? "bg-slate-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            <Variable className="size-4" />
            <span className="hidden sm:inline">Variables</span>
            {(flow.variables?.length ?? 0) > 0 && (
              <span className="text-xs bg-slate-600 px-1.5 py-0.5 rounded">
                {flow.variables.length}
              </span>
            )}
          </button>

          {/* Policies toggle */}
          <button
            onClick={() => setShowPolicies(!showPolicies)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showPolicies
                ? "bg-slate-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            <Shield className="size-4" />
            <span className="hidden sm:inline">Políticas</span>
            {effectivePolicies.length > 0 && (
              <span className="text-xs bg-slate-600 px-1.5 py-0.5 rounded">
                {effectivePolicies.length}
              </span>
            )}
          </button>

          {/* Tools toggle */}
          <button
            onClick={() => setShowTools(!showTools)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showTools
                ? "bg-slate-600 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            <Wrench className="size-4" />
            <span className="hidden sm:inline">Herramientas</span>
            {(flow.allowedToolIds?.length ?? 0) > 0 && (
              <span className="text-xs bg-slate-600 px-1.5 py-0.5 rounded">
                {flow.allowedToolIds.length}
              </span>
            )}
          </button>

          {/* Stock/catalog toggle */}
          <button
            onClick={() => updateFlow(id, { useStock: !flow.useStock })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              flow.useStock
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
            aria-label="Usar catálogo/stock"
          >
            <Package className="size-4" />
            <span className="hidden sm:inline">Catálogo</span>
          </button>

          {/* Test flow toggle */}
          <button
            onClick={() => setShowTestChat(!showTestChat)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showTestChat
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            <Play className="size-4" />
            <span className="hidden sm:inline">Probar</span>
          </button>

          {/* Autosave toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-slate-400">Autoguardado</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoSave}
              onClick={() => setAutoSave(!autoSave)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                autoSave ? "bg-[#dd7430]" : "bg-slate-600"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  autoSave ? "translate-x-4.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>

          {/* Manual save button */}
          <button
            onClick={handleSave}
            disabled={
              saveState.status === "saved" || saveState.status === "saving"
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            <Save className="size-4" />
            Guardar
          </button>

          {/* Publish button */}
          <button
            onClick={handlePublish}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                : "bg-[#dd7430] text-white hover:bg-[#c4652a]"
            }`}
          >
            <Rocket className="size-4" />
            {isActive ? "Republicar" : "Publicar"}
          </button>
        </div>
      </div>

      {/* Publish errors banner */}
      {publishErrors && publishErrors.length > 0 && (
        <div className="mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-red-400">
              <AlertCircle className="size-4" />
              No se puede publicar — {publishErrors.length} error
              {publishErrors.length > 1 ? "es" : ""}
            </div>
            <button
              onClick={() => setPublishErrors(null)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="space-y-1">
            {publishErrors.map((err, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handlePublishErrorClick(err)}
                  className={`flex items-center gap-2 text-xs text-red-300 w-full text-left px-2 py-1 rounded transition-colors ${
                    err.nodeId
                      ? "hover:bg-red-500/10 cursor-pointer"
                      : "cursor-default"
                  }`}
                >
                  <span className="text-red-500 font-mono shrink-0">
                    {err.code}
                  </span>
                  <span>{err.message}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden">
        <ReactFlowProvider>
          <FlowToolbar useStock={flow.useStock ?? false} />
          <FlowCanvas
            ref={canvasRef}
            flowId={id}
            onNodeSelect={handleNodeSelect}
            onSaveStateChange={handleSaveStateChange}
            autoSaveEnabled={autoSave}
            autoSaveInterval={30000}
            simulationHighlight={simHighlight}
            activePolicies={effectivePolicies}
            useStock={flow.useStock ?? false}
          />
        </ReactFlowProvider>
        {selectedNode && (
          <NodePropertiesPanel
            node={selectedNode}
            onUpdate={handleNodeDataUpdate}
            onClose={() => setSelectedNode(null)}
            flowVariables={flow.variables ?? []}
            allowedToolIds={flow.allowedToolIds ?? []}
            useStock={flow.useStock ?? false}
          />
        )}
        {showPolicies && (
          <FlowPoliciesPanel
            policyIds={flow.policyIds ?? []}
            onChange={(policyIds) => updateFlowPolicies(id, policyIds)}
            onClose={() => setShowPolicies(false)}
          />
        )}
        {showTools && (
          <FlowToolsPanel
            allowedToolIds={flow.allowedToolIds ?? []}
            onChange={(ids) => updateFlowAllowedTools(id, ids)}
            onClose={() => setShowTools(false)}
          />
        )}
        {showVariables && (
          <FlowVariablesPanel
            variables={flow.variables ?? []}
            onChange={(vars) => updateFlowVariables(id, vars)}
            onClose={() => setShowVariables(false)}
            useStock={flow.useStock ?? false}
          />
        )}
        {showVersionHistory && (
          <FlowVersionHistory
            versions={versions}
            currentVersionId={flow.publishedVersionId}
            onRestore={handleRestoreVersion}
            onClose={() => setShowVersionHistory(false)}
          />
        )}
        {showTestChat && (
          <FlowTestChat
            nodes={flow.nodes}
            edges={flow.edges}
            variables={flow.variables ?? []}
            policyIds={flow.policyIds ?? []}
            allowedToolIds={flow.allowedToolIds ?? []}
            testPresets={flow.testPresets ?? []}
            agent={flowAgent}
            agentApiKey={flowAgentApiKey}
            onSavePreset={(preset) => {
              const updated = [...(flow.testPresets ?? [])];
              const idx = updated.findIndex((p) => p.id === preset.id);
              if (idx >= 0) updated[idx] = preset;
              else updated.push(preset);
              updateFlowTestPresets(id, updated);
            }}
            onDeletePreset={(presetId) => {
              updateFlowTestPresets(
                id,
                (flow.testPresets ?? []).filter((p) => p.id !== presetId)
              );
            }}
            onClose={() => {
              setShowTestChat(false);
              setSimHighlight(null);
            }}
            onFocusNode={(nodeId) => canvasRef.current?.focusNode(nodeId)}
            onSimulationHighlight={setSimHighlight}
            versions={versions}
            publishedVersionId={flow.publishedVersionId}
            flowId={flow.id}
            flowName={flow.name}
          />
        )}
      </div>
    </div>
  );
}

// --- Save status indicator ---

function SaveStatusIndicator({ saveState }: { saveState: SaveState }) {
  const timeStr = saveState.lastSavedAt
    ? saveState.lastSavedAt.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  switch (saveState.status) {
    case "saving":
      return (
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Loader2 className="size-3 animate-spin" />
          Guardando...
        </span>
      );
    case "unsaved":
      return (
        <span className="flex items-center gap-1 text-xs text-amber-400">
          <Circle className="size-2.5 fill-current" />
          Cambios sin guardar
        </span>
      );
    case "saved":
      return (
        <span className="flex items-center gap-1 text-xs text-green-400">
          <Check className="size-3" />
          {timeStr ? `Guardado a las ${timeStr}` : "Guardado"}
        </span>
      );
  }
}

// --- Flow status badge ---

function FlowStatusBadge({
  isActive,
  hasBeenPublished,
  isDraftModified,
}: {
  isActive: boolean;
  hasBeenPublished: boolean;
  isDraftModified: boolean;
}) {
  if (isDraftModified) {
    return (
      <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
        Modificado
      </span>
    );
  }
  if (isActive && hasBeenPublished) {
    return (
      <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
        Publicado
      </span>
    );
  }
  return (
    <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
      Draft
    </span>
  );
}
