"use client";

import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from "react";
import {
  X,
  Play,
  RotateCcw,
  Send,
  Bot,
  User,
  Wrench,
  Info,
  ArrowRight,
  GitBranch,
  Check,
  X as XIcon,
  Minus,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Save,
  Trash2,
  Beaker,
  Brain,
  Tag,
  AlertTriangle,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Flame,
  Activity,
  Eye,
} from "lucide-react";
import type { FlowNode, FlowEdge, FlowVariable, FlowVersion, TestPreset } from "@/types/flow";
import type { AgentFormData } from "@/types/agent";
import { usePolicies } from "@/providers/PoliciesProvider";
import { useToolRegistry } from "@/providers/ToolRegistryProvider";
import type { SimulationHighlight } from "./SimulationHighlightContext";
import {
  initSimulation,
  stepSimulation,
  TOOL_MOCK_OUTCOME_LABELS,
  type SimulationState,
  type SimulationMessage,
  type ConditionRuleEval,
  type ToolMockOutcome,
  type AIReasoningMetadata,
} from "@/lib/flow-simulator";
import { classifyInput } from "@/lib/input-classifier";
import {
  BUILTIN_VARIABLES,
  CATEGORY_LABELS,
  getSampleValue,
  type VariableCategory,
} from "@/lib/template-variables";
import {
  computeRiskScore,
  getRiskLevel,
  RISK_LEVEL_COLORS,
  checkRiskThresholds,
} from "@/lib/risk-score";
import { useAuditLog } from "@/providers/AuditLogProvider";
import { useAgentDecisionLog } from "@/providers/AgentDecisionLogProvider";
import type { AgentDecisionEntry } from "@/types/agent-decision";
import { useToolExecutionHistory } from "@/providers/ToolExecutionHistoryProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useProducts } from "@/providers/ProductsProvider";

interface FlowTestChatProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariable[];
  policyIds?: string[];
  allowedToolIds?: string[];
  testPresets?: TestPreset[];
  onSavePreset?: (preset: TestPreset) => void;
  onDeletePreset?: (presetId: string) => void;
  onClose: () => void;
  onFocusNode?: (nodeId: string) => void;
  onSimulationHighlight?: (highlight: SimulationHighlight | null) => void;
  versions?: FlowVersion[];
  publishedVersionId?: string;
  flowId?: string;
  flowName?: string;
  /** Optional agent driving this flow — enables real LLM coordination */
  agent?: AgentFormData;
  /** Raw API key for agent LLM calls */
  agentApiKey?: string;
}

const STEP_DELAY = 500;

const INPUT_PLACEHOLDERS: Record<string, string> = {
  text: "Escribe tu respuesta...",
  number: "Escribe un número...",
  email: "Escribe un email...",
  phone: "Escribe un teléfono...",
  date: "Escribe una fecha...",
  boolean: "Escribe true o false...",
};

interface SimulationResult {
  source: "draft" | string;
  label: string;
  status: SimulationState["status"];
  messageCount: number;
  nodeCount: number;
  errorCount: number;
  toolCalls: number;
  riskScore: number;
  endedAt: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  contact: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  channel: { bg: "bg-sky-500/20", text: "text-sky-400" },
  conversation: { bg: "bg-teal-500/20", text: "text-teal-400" },
  lead: { bg: "bg-blue-500/20", text: "text-blue-400" },
  system: { bg: "bg-purple-500/20", text: "text-purple-400" },
  user: { bg: "bg-[#dd7430]/20", text: "text-[#dd7430]" },
};

// --- Helpers ---

/** Build default var values: built-in samples + flow vars empty */
function buildDefaultVarValues(
  variables: FlowVariable[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const bv of BUILTIN_VARIABLES) {
    result[bv.name] = getSampleValue(bv);
  }
  for (const v of variables) {
    result[v.name] = "";
  }
  return result;
}

/** Convert editing vars (all strings) to typed values for simulation */
function buildVarsOverride(
  editingVars: Record<string, string>,
  defaults: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(editingVars)) {
    // Skip empty values for flow vars (let them stay undefined)
    if (value === "" && !(key in defaults && defaults[key] !== "")) {
      continue;
    }
    // Skip values that match default (no override needed)
    if (value === defaults[key]) continue;
    result[key] = value;
  }
  return result;
}

export default function FlowTestChat({
  nodes,
  edges,
  variables,
  policyIds = [],
  allowedToolIds = [],
  testPresets = [],
  onSavePreset,
  onDeletePreset,
  onClose,
  onFocusNode,
  onSimulationHighlight,
  versions = [],
  publishedVersionId,
  flowId,
  flowName,
  agent,
  agentApiKey,
}: FlowTestChatProps) {
  const { policies } = usePolicies();
  const { tools } = useToolRegistry();
  const { addEntry: addAuditEntry } = useAuditLog();
  const { addEntry: addDecisionEntry } = useAgentDecisionLog();
  const { addEntry: addToolExecEntry } = useToolExecutionHistory();
  const { user } = useAuth();
  const { products } = useProducts();

  // Build tool schemas map from registry for simulation engine
  const toolSchemas = useMemo(() => {
    const schemas: Record<string, import("@/types/flow").ToolParamDef[]> = {};
    for (const t of tools) {
      schemas[t.id] = t.inputSchema;
    }
    return schemas;
  }, [tools]);
  const lastAuditedMsgCountRef = useRef(0);

  const [simState, setSimState] = useState<SimulationState | null>(null);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [toolMockOutcome, setToolMockOutcome] =
    useState<ToolMockOutcome>("success");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<SimulationState | null>(null);
  const breachedPolicyIds = useRef(new Set<string>());

  // Derived risk score
  const riskBreakdown = useMemo(
    () => computeRiskScore(simState?.messages ?? []),
    [simState?.messages]
  );

  // Scenario state
  const [showScenario, setShowScenario] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  // Version comparison state
  const [selectedSource, setSelectedSource] = useState<"draft" | string>("draft");
  const [comparisonResults, setComparisonResults] = useState<SimulationResult[]>([]);

  // Version-aware policy IDs: use snapshot policyIds when simulating a published version
  const effectivePolicyIds = useMemo(() => {
    if (selectedSource === "draft") return policyIds;
    const version = versions.find((v) => v.id === selectedSource);
    return version?.policyIds ?? policyIds;
  }, [selectedSource, versions, policyIds]);

  // Resolve simulation data based on selected source (draft or published version)
  const simulationData = useMemo(() => {
    if (selectedSource === "draft") {
      return { nodes, edges, variables, label: "Draft" };
    }
    const version = versions.find((v) => v.id === selectedSource);
    if (!version) return { nodes, edges, variables, label: "Draft" };
    return {
      nodes: version.nodes,
      edges: version.edges,
      variables: version.variables,
      label: `v${version.version}`,
    };
  }, [selectedSource, versions, nodes, edges, variables]);

  // Default values for all variables
  const defaultVarValues = useMemo(
    () => buildDefaultVarValues(simulationData.variables),
    [simulationData.variables]
  );

  // Editing vars: string values for the variable editor
  const [editingVars, setEditingVars] =
    useState<Record<string, string>>(defaultVarValues);

  // Sync defaults when variables change
  useEffect(() => {
    setEditingVars((prev) => {
      const next = { ...defaultVarValues };
      // Preserve user edits for existing keys
      for (const key of Object.keys(next)) {
        if (key in prev && prev[key] !== "") {
          next[key] = prev[key];
        }
      }
      return next;
    });
  }, [defaultVarValues]);

  // Active channel type from simulation variables (used for channel-scoped policy filtering)
  const activeChannelType = editingVars["channel.type"] ?? "";

  // Scope-aware policy filtering: global always + flow-scoped if associated + channel-scoped if channel matches
  const applicablePolicies = useMemo(
    () =>
      policies.filter(
        (p) =>
          p.active &&
          (p.scope === "global" ||
            (p.scope === "flow" && effectivePolicyIds.includes(p.id)) ||
            (p.scope === "channel" && (p.channelIds ?? []).includes(activeChannelType)))
      ),
    [policies, effectivePolicyIds, activeChannelType]
  );
  const responsePolicies = useMemo(
    () =>
      applicablePolicies.filter(
        (p) =>
          (p.forbiddenResponseCategories?.length ?? 0) > 0 ||
          (p.forbiddenResponseKeywords?.length ?? 0) > 0
      ),
    [applicablePolicies]
  );
  const authorityPolicies = useMemo(
    () => applicablePolicies.filter((p) => (p.authorityRules?.length ?? 0) > 0),
    [applicablePolicies]
  );
  const escalationPolicies = useMemo(
    () =>
      applicablePolicies.filter(
        (p) =>
          (p.escalationTriggerCategories?.length ?? 0) > 0 ||
          (p.escalationTriggerKeywords?.length ?? 0) > 0 ||
          (p.escalationTriggerRules?.length ?? 0) > 0
      ),
    [applicablePolicies]
  );
  const classificationPolicies = useMemo(
    () =>
      applicablePolicies.filter(
        (p) =>
          (p.inputClassificationCategories?.length ?? 0) > 0 ||
          (p.inputClassificationKeywords?.length ?? 0) > 0
      ),
    [applicablePolicies]
  );

  // Keep ref in sync
  useEffect(() => {
    stateRef.current = simState;
  }, [simState]);

  // Emit simulation highlight changes to parent
  useEffect(() => {
    if (!simState) {
      onSimulationHighlight?.(null);
      return;
    }
    onSimulationHighlight?.({
      currentNodeId: simState.currentNodeId,
      visitedNodeIds: simState.visitedNodeIds,
    });
  }, [
    simState?.currentNodeId,
    simState?.visitedNodeIds,
    onSimulationHighlight,
  ]);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [simState?.messages.length]);

  // Focus input when waiting
  useEffect(() => {
    if (simState?.status === "waiting_input") {
      inputRef.current?.focus();
    }
  }, [simState?.status]);

  // Enrich agent decision entries with flow-level context before persisting
  const onAgentDecision = useCallback(
    (partial: Omit<AgentDecisionEntry, "id" | "timestamp">) => {
      addDecisionEntry({
        ...partial,
        agentName: agent?.name,
        flowId,
        flowName,
        simulationSource: selectedSource,
      });
    },
    [addDecisionEntry, agent?.name, flowId, flowName, selectedSource]
  );

  // Run simulation steps with delay until it pauses or completes
  const runUntilPause = useCallback(
    async (state: SimulationState) => {
      if (state.status !== "running") {
        setSimState(state);
        setIsRunning(false);
        return;
      }

      setIsRunning(true);
      const next = await stepSimulation(state, simulationData.nodes, simulationData.edges, simulationData.variables, undefined, {
        toolMockOutcome,
        responsePolicies,
        authorityPolicies,
        escalationPolicies,
        inputClassificationPolicies: classificationPolicies,
        toolSchemas,
        allowedToolIds,
        agent,
        agentApiKey,
        toolDefinitions: tools,
        onAgentDecision,
        products,
      });
      setSimState(next);

      if (next.status === "running") {
        setTimeout(() => runUntilPause(next), STEP_DELAY);
      } else {
        setIsRunning(false);
      }
    },
    [simulationData, toolMockOutcome, responsePolicies, authorityPolicies, escalationPolicies, toolSchemas, allowedToolIds, agent, agentApiKey, tools, onAgentDecision, products]
  );

  // Start or restart simulation
  const handleStart = useCallback(() => {
    const varsOverride = buildVarsOverride(editingVars, defaultVarValues);
    const initial = initSimulation(simulationData.nodes, simulationData.edges, simulationData.variables, varsOverride);
    breachedPolicyIds.current = new Set();
    lastAuditedMsgCountRef.current = 0;
    setSimState(initial);
    setInput("");

    if (initial.status === "running") {
      setTimeout(() => runUntilPause(initial), STEP_DELAY);
    }
  }, [simulationData, runUntilPause, editingVars, defaultVarValues]);

  // Init on mount
  useEffect(() => {
    handleStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-restart when version source changes
  const prevSourceRef = useRef(selectedSource);
  useEffect(() => {
    if (prevSourceRef.current !== selectedSource) {
      prevSourceRef.current = selectedSource;
      handleStart();
    }
  }, [selectedSource, handleStart]);

  // Capture comparison results when simulation finishes
  useEffect(() => {
    if (!simState || (simState.status !== "completed" && simState.status !== "error")) return;

    const lastNode = simState.visitedNodeIds[simState.visitedNodeIds.length - 1];
    const lastNodeData = simulationData.nodes.find((n) => n.id === lastNode);
    const endLabel = simState.status === "error"
      ? "Error"
      : (lastNodeData?.data as Record<string, unknown>)?.label as string ?? lastNode ?? "—";

    const result: SimulationResult = {
      source: selectedSource,
      label: simulationData.label,
      status: simState.status,
      messageCount: simState.messages.filter((m) => m.type === "bot" || m.type === "user").length,
      nodeCount: simState.visitedNodeIds.length,
      errorCount: simState.messages.filter((m) => m.type === "error").length,
      toolCalls: simState.messages.filter((m) => m.type === "tool").length,
      riskScore: riskBreakdown.total,
      endedAt: endLabel,
    };

    setComparisonResults((prev) => {
      const filtered = prev.filter((r) => r.source !== selectedSource);
      return [...filtered, result];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState?.status]);

  // Check risk thresholds when score changes
  useEffect(() => {
    if (!simState || riskBreakdown.total === 0) return;
    const breach = checkRiskThresholds(riskBreakdown.total, applicablePolicies, breachedPolicyIds.current);
    if (!breach) return;

    breachedPolicyIds.current.add(breach.policyId);
    const msg: SimulationMessage = {
      id: crypto.randomUUID(),
      type: "risk_threshold",
      content: `Umbral de riesgo superado: ${breach.currentScore} >= ${breach.threshold}`,
      timestamp: new Date().toISOString(),
      riskThreshold: {
        policyName: breach.policyName,
        threshold: breach.threshold,
        currentScore: breach.currentScore,
        action: breach.action,
      },
    };
    setSimState((prev) =>
      prev
        ? {
            ...prev,
            messages: [...prev.messages, msg],
            ...(breach.action === "escalate"
              ? { status: "completed" as const, currentNodeId: null }
              : {}),
          }
        : prev
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskBreakdown.total, applicablePolicies]);

  // Capture violations to audit log
  useEffect(() => {
    if (!simState || !flowId) return;
    const msgs = simState.messages;
    const prevCount = lastAuditedMsgCountRef.current;
    if (msgs.length <= prevCount) return;
    lastAuditedMsgCountRef.current = msgs.length;

    const newMsgs = msgs.slice(prevCount);
    const base = {
      flowId,
      flowName: flowName ?? "Sin nombre",
      simulationSource: simulationData.label,
    };

    for (const msg of newMsgs) {
      switch (msg.type) {
        case "policy_violation":
          if (msg.policyViolation) {
            addAuditEntry({
              ...base,
              type: "policy_violation",
              policyName: msg.policyViolation.policyName,
              action: msg.policyViolation.action,
              detail: {
                keyword: msg.policyViolation.keyword,
                originalContent: msg.policyViolation.originalContent,
              },
            });
          }
          break;
        case "authority_violation":
          if (msg.authorityViolation) {
            addAuditEntry({
              ...base,
              type: "authority_violation",
              policyName: msg.authorityViolation.policyName,
              action: msg.authorityViolation.action,
              detail: {
                ruleName: msg.authorityViolation.ruleName,
                ruleType: msg.authorityViolation.ruleType as "forbidden" | "limit",
                toolName: msg.authorityViolation.toolName,
                paramName: msg.authorityViolation.paramName,
                maxValue: msg.authorityViolation.maxValue,
                actualValue: msg.authorityViolation.actualValue,
              },
            });
          }
          break;
        case "escalation_trigger":
          if (msg.escalationTrigger) {
            addAuditEntry({
              ...base,
              type: "escalation_trigger",
              policyName: msg.escalationTrigger.policyName,
              action: msg.escalationTrigger.action,
              detail: {
                triggerType: msg.escalationTrigger.triggerType as "keyword" | "intent" | "confidence",
                triggerDescription: msg.escalationTrigger.triggerDescription,
                detectedIntent: msg.escalationTrigger.detectedIntent,
                confidence: msg.escalationTrigger.confidence,
              },
            });
          }
          break;
        case "risk_threshold":
          if (msg.riskThreshold) {
            addAuditEntry({
              ...base,
              type: "risk_threshold",
              policyName: msg.riskThreshold.policyName,
              action: msg.riskThreshold.action,
              detail: {
                threshold: msg.riskThreshold.threshold,
                currentScore: msg.riskThreshold.currentScore,
              },
            });
          }
          break;
        case "input_classification":
          if (msg.inputClassification) {
            addAuditEntry({
              ...base,
              type: "input_classification",
              policyName: msg.inputClassification.policyName,
              action: msg.inputClassification.action,
              detail: {
                category: msg.inputClassification.category,
                keyword: msg.inputClassification.keyword,
              },
            });
          }
          break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState?.messages.length]);

  // Capture tool executions to history
  const lastToolLogCountRef = useRef(0);
  useEffect(() => {
    if (!simState || !flowId) return;
    const logs = simState.toolExecutionLogs;
    const prevCount = lastToolLogCountRef.current;
    if (logs.length <= prevCount) return;
    lastToolLogCountRef.current = logs.length;

    const newLogs = logs.slice(prevCount);
    for (const log of newLogs) {
      const toolDef = tools.find((t) => t.id === log.tool);
      addToolExecEntry({
        timestamp: log.timestamp,
        toolId: log.tool,
        toolName: toolDef?.name ?? log.tool,
        toolCategory: toolDef?.category ?? "support",
        flowId,
        flowName: flowName ?? "Sin nombre",
        simulationSource: simulationData.label,
        nodeId: log.nodeId,
        userId: user?.id ?? "unknown",
        userName: user?.name ?? "Desconocido",
        request: log.request,
        response: log.response,
        error: log.error,
        durationMs: log.durationMs,
        result: log.error ? "error" : "success",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState?.toolExecutionLogs.length]);

  // Handle user input submission
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || !simState || simState.status !== "waiting_input")
      return;

    const trimmed = input.trim();

    // Pre-engine input classification
    const classification = classifyInput(trimmed, classificationPolicies);
    if (classification) {
      const userMsg: SimulationMessage = {
        id: crypto.randomUUID(),
        type: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };
      const classMsg: SimulationMessage = {
        id: crypto.randomUUID(),
        type: "input_classification",
        content: `Contenido detectado: ${classification.keyword}`,
        timestamp: new Date().toISOString(),
        inputClassification: classification,
      };

      if (classification.action === "escalate") {
        // Hard stop — don't enter the engine
        setSimState((prev) =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages, userMsg, classMsg],
                status: "completed",
                currentNodeId: null,
              }
            : prev
        );
        setInput("");
        return;
      }

      if (classification.action === "warn") {
        // Add warning then proceed normally through the engine
        setSimState((prev) =>
          prev
            ? { ...prev, messages: [...prev.messages, userMsg, classMsg] }
            : prev
        );
        // Fall through to stepSimulation below using updated state
        const stateWithWarning = {
          ...simState,
          messages: [...simState.messages, userMsg, classMsg],
        };
        const next = await stepSimulation(
          stateWithWarning,
          simulationData.nodes,
          simulationData.edges,
          simulationData.variables,
          trimmed,
          { toolMockOutcome, responsePolicies, authorityPolicies, escalationPolicies, inputClassificationPolicies: classificationPolicies, toolSchemas, allowedToolIds, agent, agentApiKey, toolDefinitions: tools, onAgentDecision, products }
        );
        setSimState(next);
        setInput("");
        if (next.status === "running") {
          setTimeout(() => runUntilPause(next), STEP_DELAY);
        }
        return;
      }

      // "ignore" — log silently (classification msg not shown), proceed normally
    }

    // Normal engine processing
    const next = await stepSimulation(
      simState,
      simulationData.nodes,
      simulationData.edges,
      simulationData.variables,
      trimmed,
      { toolMockOutcome, responsePolicies, authorityPolicies, escalationPolicies, inputClassificationPolicies: classificationPolicies, toolSchemas, allowedToolIds, agent, agentApiKey, toolDefinitions: tools, onAgentDecision, products }
    );
    setSimState(next);
    setInput("");

    if (next.status === "running") {
      setTimeout(() => runUntilPause(next), STEP_DELAY);
    }
  }, [input, simState, simulationData, runUntilPause, toolMockOutcome, responsePolicies, authorityPolicies, escalationPolicies, classificationPolicies, toolSchemas, allowedToolIds, agent, agentApiKey, tools, onAgentDecision, products]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Handle interactive option selection (buttons / list)
  const handleInteractiveSelect = useCallback(
    async (value: string) => {
      if (!simState || simState.status !== "waiting_input") return;
      const next = await stepSimulation(
        simState,
        simulationData.nodes,
        simulationData.edges,
        simulationData.variables,
        value,
        {
          toolMockOutcome,
          responsePolicies,
          authorityPolicies,
          escalationPolicies,
          inputClassificationPolicies: classificationPolicies,
          toolSchemas,
          allowedToolIds,
          agent,
          agentApiKey,
          toolDefinitions: tools,
          onAgentDecision,
          products,
        }
      );
      setSimState(next);
      if (next.status === "running") {
        setTimeout(() => runUntilPause(next), STEP_DELAY);
      }
    },
    [simState, simulationData, runUntilPause, toolMockOutcome, responsePolicies, authorityPolicies, escalationPolicies, classificationPolicies, toolSchemas, allowedToolIds, agent, agentApiKey, tools, onAgentDecision, products]
  );

  // Preset selection
  const handleSelectPreset = useCallback(
    (presetId: string | null) => {
      setSelectedPresetId(presetId);
      if (!presetId) {
        // Reset to defaults
        setEditingVars(defaultVarValues);
        setToolMockOutcome("success");
        return;
      }
      const preset = testPresets.find((p) => p.id === presetId);
      if (!preset) return;

      // Load preset values
      const newVars = { ...defaultVarValues };
      for (const [key, value] of Object.entries(preset.variables)) {
        if (key in newVars) {
          newVars[key] = String(value ?? "");
        }
      }
      setEditingVars(newVars);
      setToolMockOutcome(preset.toolMockOutcome);
    },
    [testPresets, defaultVarValues]
  );

  // Save current config as preset
  const handleSavePreset = useCallback(() => {
    if (!presetName.trim() || !onSavePreset) return;

    // Collect only non-default values
    const presetVars: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(editingVars)) {
      if (value !== defaultVarValues[key] && value !== "") {
        presetVars[key] = value;
      }
    }

    const preset: TestPreset = {
      id: selectedPresetId || crypto.randomUUID(),
      name: presetName.trim(),
      variables: presetVars,
      toolMockOutcome,
      createdAt: new Date().toISOString(),
    };

    onSavePreset(preset);
    setSelectedPresetId(preset.id);
    setSavingPreset(false);
    setPresetName("");
  }, [
    presetName,
    onSavePreset,
    editingVars,
    defaultVarValues,
    toolMockOutcome,
    selectedPresetId,
  ]);

  // Count modified vars
  const modifiedCount = useMemo(() => {
    let count = 0;
    for (const [key, value] of Object.entries(editingVars)) {
      if (value !== defaultVarValues[key]) count++;
    }
    return count;
  }, [editingVars, defaultVarValues]);

  return (
    <div className="w-96 h-full border-l border-slate-700 bg-slate-900/95 backdrop-blur-sm flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="size-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">
              Probar flujo
            </span>
            <StatusBadge status={simState?.status} />
            <RiskScoreBadge score={riskBreakdown.total} />
            {selectedSource !== "draft" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400">
                {simulationData.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleStart}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
              title="Reiniciar simulación"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Tool mock outcome selector */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-slate-500 shrink-0">
            <Wrench className="size-3 inline mr-1" />
            Mock:
          </span>
          <div className="flex gap-1 flex-1">
            {(Object.keys(TOOL_MOCK_OUTCOME_LABELS) as ToolMockOutcome[]).map(
              (key) => (
                <button
                  key={key}
                  onClick={() => setToolMockOutcome(key)}
                  className={`flex-1 text-[10px] px-1.5 py-1 rounded transition-colors ${
                    toolMockOutcome === key
                      ? key === "success"
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                        : key === "error"
                          ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                          : key === "no_stock"
                            ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                            : "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30"
                      : "bg-slate-800 text-slate-500 hover:text-slate-400 hover:bg-slate-700/50"
                  }`}
                >
                  {TOOL_MOCK_OUTCOME_LABELS[key]}
                </button>
              )
            )}
          </div>
        </div>

        {/* Version source selector */}
        {versions.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-slate-500 shrink-0">
              <GitBranch className="size-3 inline mr-1" />
              Simular:
            </span>
            <div className="flex gap-1 flex-1 overflow-x-auto">
              <button
                onClick={() => setSelectedSource("draft")}
                className={`shrink-0 text-[10px] px-1.5 py-1 rounded transition-colors ${
                  selectedSource === "draft"
                    ? "bg-[#dd7430]/20 text-[#dd7430] ring-1 ring-[#dd7430]/30"
                    : "bg-slate-800 text-slate-500 hover:text-slate-400 hover:bg-slate-700/50"
                }`}
              >
                Draft
              </button>
              {[...versions]
                .sort((a, b) => b.version - a.version)
                .slice(0, 4)
                .map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedSource(v.id)}
                    className={`shrink-0 text-[10px] px-1.5 py-1 rounded transition-colors ${
                      selectedSource === v.id
                        ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30"
                        : "bg-slate-800 text-slate-500 hover:text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    v{v.version}
                    {v.id === publishedVersionId ? " (activa)" : ""}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Agent operational-status banner — CA1/CA2: only Active can operate */}
      {agent && agent.status !== "active" && (
        <div
          className={`px-3 py-2 flex items-start gap-2 text-xs border-b ${
            agent.status === "paused"
              ? "bg-amber-900/10 border-amber-800/40 text-amber-400"
              : agent.status === "archived"
              ? "bg-slate-800/60 border-slate-700 text-slate-500"
              : "bg-slate-800/40 border-slate-700 text-slate-500"
          }`}
        >
          <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          <span>
            {agent.status === "paused"
              ? `Agente "${agent.name}" pausado — no procesará nuevas conversaciones en producción. La simulación funciona de todas formas.`
              : agent.status === "archived"
              ? `Agente "${agent.name}" archivado — no puede operar. Restaura el agente para activarlo.`
              : `Agente "${agent.name}" en Borrador — debe activarse antes de operar en producción.`}
          </span>
        </div>
      )}

      {/* Scenario config panel */}
      <ScenarioPanel
        variables={simulationData.variables}
        editingVars={editingVars}
        defaultVarValues={defaultVarValues}
        onUpdateVar={(key, value) =>
          setEditingVars((prev) => ({ ...prev, [key]: value }))
        }
        onResetVar={(key) =>
          setEditingVars((prev) => ({
            ...prev,
            [key]: defaultVarValues[key] ?? "",
          }))
        }
        onResetAll={() => setEditingVars(defaultVarValues)}
        testPresets={testPresets}
        selectedPresetId={selectedPresetId}
        onSelectPreset={handleSelectPreset}
        onDeletePreset={onDeletePreset}
        savingPreset={savingPreset}
        onStartSaving={() => {
          const selected = testPresets.find(
            (p) => p.id === selectedPresetId
          );
          setPresetName(selected?.name ?? "");
          setSavingPreset(true);
        }}
        onCancelSaving={() => {
          setSavingPreset(false);
          setPresetName("");
        }}
        presetName={presetName}
        onPresetNameChange={setPresetName}
        onSavePreset={handleSavePreset}
        canSavePresets={!!onSavePreset}
        modifiedCount={modifiedCount}
        showScenario={showScenario}
        onToggleScenario={() => setShowScenario(!showScenario)}
        onRunScenario={handleStart}
      />

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {simState?.messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onFocusNode={onFocusNode}
          />
        ))}
        {isRunning && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Comparison panel */}
      <ComparisonPanel results={comparisonResults} />

      {/* Current node indicator */}
      {simState?.currentNodeId && simState.status !== "completed" && (
        <div className="px-3 py-1.5 border-t border-slate-700/50">
          <button
            type="button"
            onClick={() =>
              simState.currentNodeId &&
              onFocusNode?.(simState.currentNodeId)
            }
            className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowRight className="size-2.5" />
            <span>
              Nodo actual:{" "}
              <span className="font-mono text-slate-400">
                {simState.currentNodeId}
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="p-3 border-t border-slate-700">
        {/* Interactive options (buttons or list) */}
        {simState?.status === "waiting_input" &&
        simState.waitingForInput?.responseType === "interactive" &&
        simState.waitingForInput.options ? (
          <>
            <div className="flex items-center gap-1.5 mb-2 text-[10px] text-amber-400/80">
              <Info className="size-3 shrink-0" />
              <span>
                Guardará en{" "}
                <span className="font-mono font-medium">
                  {simState.waitingForInput.variable || "—"}
                </span>{" "}
                (interactivo)
              </span>
            </div>
            {simState.waitingForInput.interactiveType === "buttons" ? (
              <div className="flex flex-wrap gap-2">
                {simState.waitingForInput.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleInteractiveSelect(opt.value)}
                    className="px-3 py-1.5 rounded-full text-sm bg-slate-700 text-white border border-slate-600 hover:bg-[#dd7430] hover:border-[#dd7430] transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {simState.waitingForInput.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleInteractiveSelect(opt.value)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-slate-800 text-white border border-slate-700 hover:border-[#dd7430] hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <ChevronRight className="size-3.5 shrink-0 text-slate-400" />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Standard free-text input */
          <>
            {simState?.status === "waiting_input" && simState.waitingForInput && (
              <div className="flex items-center gap-1.5 mb-2 text-[10px] text-amber-400/80">
                <Info className="size-3 shrink-0" />
                <span>
                  Guardará en{" "}
                  <span className="font-mono font-medium">
                    {simState.waitingForInput.variable || "—"}
                  </span>{" "}
                  ({simState.waitingForInput.responseType})
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={simState?.status !== "waiting_input"}
                placeholder={
                  simState?.status === "waiting_input"
                    ? INPUT_PLACEHOLDERS[
                        simState.waitingForInput?.responseType ?? "text"
                      ] ?? "Escribe tu respuesta..."
                    : simState?.status === "completed"
                      ? "Simulación finalizada"
                      : "Esperando..."
                }
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#dd7430] disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSubmit}
                disabled={
                  !input.trim() || simState?.status !== "waiting_input"
                }
                className="p-2 rounded-lg bg-[#dd7430] text-white hover:bg-[#c4652a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send className="size-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Scenario panel ---

interface ScenarioPanelProps {
  variables: FlowVariable[];
  editingVars: Record<string, string>;
  defaultVarValues: Record<string, string>;
  onUpdateVar: (key: string, value: string) => void;
  onResetVar: (key: string) => void;
  onResetAll: () => void;
  testPresets: TestPreset[];
  selectedPresetId: string | null;
  onSelectPreset: (id: string | null) => void;
  onDeletePreset?: (id: string) => void;
  savingPreset: boolean;
  onStartSaving: () => void;
  onCancelSaving: () => void;
  presetName: string;
  onPresetNameChange: (name: string) => void;
  onSavePreset: () => void;
  canSavePresets: boolean;
  modifiedCount: number;
  showScenario: boolean;
  onToggleScenario: () => void;
  onRunScenario: () => void;
}

function ScenarioPanel({
  variables,
  editingVars,
  defaultVarValues,
  onUpdateVar,
  onResetVar,
  onResetAll,
  testPresets,
  selectedPresetId,
  onSelectPreset,
  onDeletePreset,
  savingPreset,
  onStartSaving,
  onCancelSaving,
  presetName,
  onPresetNameChange,
  onSavePreset,
  canSavePresets,
  modifiedCount,
  showScenario,
  onToggleScenario,
  onRunScenario,
}: ScenarioPanelProps) {
  // Group built-in vars by category
  const builtinGrouped = useMemo(() => {
    const grouped: Record<string, { name: string; type: string }[]> = {};
    for (const bv of BUILTIN_VARIABLES) {
      (grouped[bv.category] ??= []).push({ name: bv.name, type: bv.type });
    }
    return grouped;
  }, []);

  return (
    <div className="border-b border-slate-700">
      {/* Toggle header */}
      <button
        type="button"
        onClick={onToggleScenario}
        className="flex items-center justify-between w-full px-4 py-2 text-left hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Beaker className="size-3.5 text-[#dd7430]" />
          <span className="text-xs font-medium text-slate-300">Escenario</span>
          {modifiedCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#dd7430]/20 text-[#dd7430]">
              {modifiedCount} modificada{modifiedCount !== 1 ? "s" : ""}
            </span>
          )}
          {selectedPresetId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 truncate max-w-[120px]">
              {testPresets.find((p) => p.id === selectedPresetId)?.name}
            </span>
          )}
        </div>
        {showScenario ? (
          <ChevronUp className="size-3.5 text-slate-500" />
        ) : (
          <ChevronDown className="size-3.5 text-slate-500" />
        )}
      </button>

      {showScenario && (
        <div className="px-3 pb-3 space-y-3">
          {/* Preset selector */}
          {testPresets.length > 0 && (
            <div>
              <label className="block text-[10px] font-medium text-slate-400 mb-1">
                Preset
              </label>
              <div className="flex gap-1.5">
                <select
                  value={selectedPresetId ?? ""}
                  onChange={(e) =>
                    onSelectPreset(e.target.value || null)
                  }
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-800/50 px-2 py-1.5 text-xs text-white focus:border-[#dd7430] focus:outline-none appearance-none"
                >
                  <option value="">Personalizado</option>
                  {testPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {selectedPresetId && onDeletePreset && (
                  <button
                    onClick={() => {
                      onDeletePreset(selectedPresetId);
                      onSelectPreset(null);
                    }}
                    className="p-1.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    title="Eliminar preset"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Variable editor */}
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {/* Flow variables first */}
            {variables.length > 0 && (
              <VarGroup
                label="Variables del flujo"
                category="user"
                vars={variables.map((v) => ({
                  name: v.name,
                  type: v.type,
                }))}
                editingVars={editingVars}
                defaultVarValues={defaultVarValues}
                onUpdateVar={onUpdateVar}
                onResetVar={onResetVar}
              />
            )}

            {/* Built-in categories */}
            {Object.entries(builtinGrouped).map(([category, vars]) => (
              <VarGroup
                key={category}
                label={
                  CATEGORY_LABELS[category as VariableCategory] ?? category
                }
                category={category}
                vars={vars}
                editingVars={editingVars}
                defaultVarValues={defaultVarValues}
                onUpdateVar={onUpdateVar}
                onResetVar={onResetVar}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onRunScenario}
              className="flex items-center gap-1.5 flex-1 justify-center px-3 py-1.5 rounded-lg text-xs font-medium bg-[#dd7430] text-white hover:bg-[#c4652a] transition-colors"
            >
              <Play className="size-3" />
              Ejecutar
            </button>
            {modifiedCount > 0 && (
              <button
                onClick={onResetAll}
                className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors px-2 py-1.5"
              >
                Limpiar
              </button>
            )}
            {canSavePresets && !savingPreset && (
              <button
                onClick={onStartSaving}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                title="Guardar como preset"
              >
                <Save className="size-3.5" />
              </button>
            )}
          </div>

          {/* Save preset form */}
          {savingPreset && (
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={presetName}
                onChange={(e) => onPresetNameChange(e.target.value)}
                placeholder="Nombre del preset..."
                className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#dd7430]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSavePreset();
                  if (e.key === "Escape") onCancelSaving();
                }}
              />
              <button
                onClick={onSavePreset}
                disabled={!presetName.trim()}
                className="p-1.5 rounded text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-30"
                title="Guardar"
              >
                <Check className="size-3.5" />
              </button>
              <button
                onClick={onCancelSaving}
                className="p-1.5 rounded text-slate-400 hover:bg-slate-700/50 transition-colors"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Variable group ---

function VarGroup({
  label,
  category,
  vars,
  editingVars,
  defaultVarValues,
  onUpdateVar,
  onResetVar,
}: {
  label: string;
  category: string;
  vars: { name: string; type: string }[];
  editingVars: Record<string, string>;
  defaultVarValues: Record<string, string>;
  onUpdateVar: (key: string, value: string) => void;
  onResetVar: (key: string) => void;
}) {
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.system;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
        >
          {label}
        </span>
      </div>
      <div className="space-y-1">
        {vars.map((v) => {
          const value = editingVars[v.name] ?? "";
          const defaultValue = defaultVarValues[v.name] ?? "";
          const isModified = value !== defaultValue;

          return (
            <div key={v.name} className="flex items-center gap-1.5">
              <span
                className={`font-mono text-[10px] shrink-0 w-28 truncate ${
                  isModified ? "text-[#dd7430]" : "text-slate-500"
                }`}
                title={v.name}
              >
                {v.name}
              </span>
              <input
                type="text"
                value={value}
                onChange={(e) => onUpdateVar(v.name, e.target.value)}
                placeholder={defaultValue || `(${v.type})`}
                className={`flex-1 px-2 py-1 rounded text-[10px] font-mono bg-slate-800/50 border text-white placeholder:text-slate-600 focus:outline-none focus:border-[#dd7430] min-w-0 ${
                  isModified ? "border-[#dd7430]/30" : "border-slate-700"
                }`}
              />
              {isModified && (
                <button
                  onClick={() => onResetVar(v.name)}
                  className="shrink-0 p-0.5 rounded text-slate-600 hover:text-slate-400 transition-colors"
                  title="Restaurar default"
                >
                  <RotateCcw className="size-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Message bubble ---

function MessageBubble({
  message,
  onFocusNode,
}: {
  message: SimulationMessage;
  onFocusNode?: (nodeId: string) => void;
}) {
  switch (message.type) {
    case "bot":
      return (
        <div className="flex items-start gap-2 max-w-[85%]">
          <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
            <Bot className="size-3 text-slate-400" />
          </div>
          <div>
            <div
              className="rounded-lg rounded-tl-none px-3 py-2 text-sm text-slate-200 bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-600 transition-colors"
              onClick={() => message.nodeId && onFocusNode?.(message.nodeId)}
              title={message.nodeId ? "Click para focalizar nodo" : undefined}
            >
              {message.content}
            </div>
            {message.aiGenerated && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-violet-400 px-1.5">
                <Brain className="size-2.5" />
                Generado por agente IA
              </span>
            )}
          </div>
        </div>
      );

    case "user":
      return (
        <div className="flex justify-end">
          <div className="flex items-start gap-2 max-w-[85%]">
            <div className="rounded-lg rounded-tr-none px-3 py-2 text-sm text-[#dd7430] bg-[#dd7430]/10 border border-[#dd7430]/20">
              {message.content}
            </div>
            <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#dd7430]/20 flex items-center justify-center">
              <User className="size-3 text-[#dd7430]" />
            </div>
          </div>
        </div>
      );

    case "tool":
      return <ToolCallBubble message={message} onFocusNode={onFocusNode} />;

    case "condition":
      return (
        <ConditionEvalBubble message={message} onFocusNode={onFocusNode} />
      );

    case "ai_reasoning":
      return (
        <AIReasoningBubble message={message} onFocusNode={onFocusNode} />
      );

    case "error":
      return <ErrorBubble message={message} onFocusNode={onFocusNode} />;

    case "policy_violation":
      return (
        <PolicyViolationBubble message={message} onFocusNode={onFocusNode} />
      );

    case "authority_violation":
      return (
        <AuthorityViolationBubble message={message} onFocusNode={onFocusNode} />
      );

    case "escalation_trigger":
      return (
        <EscalationTriggerBubble message={message} onFocusNode={onFocusNode} />
      );

    case "risk_threshold":
      return <RiskThresholdBubble message={message} />;

    case "input_classification":
      return <InputClassificationBubble message={message} />;

    case "system":
      return (
        <div className="flex justify-center py-1">
          <span className="text-[10px] text-slate-500 italic px-2 py-0.5 rounded-full bg-slate-800/50">
            {message.content}
          </span>
        </div>
      );
  }
}

// --- Error bubble ---

function ErrorBubble({
  message,
  onFocusNode,
}: {
  message: SimulationMessage;
  onFocusNode?: (nodeId: string) => void;
}) {
  const detail = message.errorDetail;

  return (
    <div className="px-3 py-1">
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-red-400" />
            <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">
              Error
            </span>
          </div>
          {detail?.nodeLabel && (
            <span className="text-[10px] text-red-300 bg-red-500/20 rounded px-1.5 py-0.5">
              {detail.nodeLabel}
            </span>
          )}
        </div>

        {/* Content */}
        <p className="text-xs text-red-200/80">{message.content}</p>

        {/* Go to node button */}
        {message.nodeId && onFocusNode && (
          <div className="flex justify-end">
            <button
              onClick={() => onFocusNode(message.nodeId!)}
              className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded px-2 py-1 transition-colors"
            >
              <MapPin className="size-3" />
              Ir al nodo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Policy violation bubble ---

const VIOLATION_ACTION_LABELS: Record<string, string> = {
  block: "Bloqueada",
  escalate: "Escalada a humano",
  reformulate: "Reformulada",
};

function PolicyViolationBubble({
  message,
  onFocusNode,
}: {
  message: SimulationMessage;
  onFocusNode?: (nodeId: string) => void;
}) {
  const detail = message.policyViolation;
  if (!detail) return null;

  return (
    <div className="px-3 py-1">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="size-3.5 text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
              Violación de política
            </span>
          </div>
          <span className="text-[10px] text-amber-300 bg-amber-500/20 rounded px-1.5 py-0.5">
            {VIOLATION_ACTION_LABELS[detail.action] ?? detail.action}
          </span>
        </div>

        {/* Policy name + keyword */}
        <p className="text-xs text-amber-200/80">
          Política:{" "}
          <span className="font-semibold">{detail.policyName}</span>
          {" · "}Keyword:{" "}
          <span className="font-mono bg-amber-500/10 px-1 rounded">
            {detail.keyword}
          </span>
        </p>

        {/* Original content (collapsed) */}
        <details className="text-xs">
          <summary className="text-amber-400 cursor-pointer hover:text-amber-300">
            Ver contenido original
          </summary>
          <p className="mt-1 text-slate-400 line-through decoration-amber-500/50">
            {detail.originalContent}
          </p>
        </details>

        {/* Go to node button */}
        {message.nodeId && onFocusNode && (
          <div className="flex justify-end">
            <button
              onClick={() => onFocusNode(message.nodeId!)}
              className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 rounded px-2 py-1 transition-colors"
            >
              <MapPin className="size-3" />
              Ir al nodo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Authority violation bubble ---

const AUTHORITY_ACTION_LABELS: Record<string, string> = {
  block: "Bloqueada",
  escalate: "Escalada a humano",
};

function AuthorityViolationBubble({
  message,
  onFocusNode,
}: {
  message: SimulationMessage;
  onFocusNode?: (nodeId: string) => void;
}) {
  const detail = message.authorityViolation;
  if (!detail) return null;

  return (
    <div className="px-3 py-1">
      <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-violet-400" />
            <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
              Violación de autoridad
            </span>
          </div>
          <span className="text-[10px] text-violet-300 bg-violet-500/20 rounded px-1.5 py-0.5">
            {AUTHORITY_ACTION_LABELS[detail.action] ?? detail.action}
          </span>
        </div>

        {/* Rule detail */}
        <p className="text-xs text-violet-200/80">
          {detail.ruleType === "forbidden" ? (
            <>
              Herramienta{" "}
              <span className="font-mono bg-violet-500/10 px-1 rounded">
                {detail.toolName}
              </span>
              {" — "}
              <span className="font-semibold">Prohibida</span>
            </>
          ) : (
            <>
              Parámetro{" "}
              <span className="font-mono bg-violet-500/10 px-1 rounded">
                {detail.paramName}
              </span>
              {" — Máx. "}
              <span className="font-semibold">{detail.maxValue}</span>
              {", actual: "}
              <span className="font-semibold text-red-400">
                {detail.actualValue}
              </span>
            </>
          )}
        </p>

        {/* Policy + rule name */}
        <p className="text-[10px] text-violet-300/60">
          Política: {detail.policyName}
          {detail.ruleName && ` · ${detail.ruleName}`}
        </p>

        {/* Go to node button */}
        {message.nodeId && onFocusNode && (
          <div className="flex justify-end">
            <button
              onClick={() => onFocusNode(message.nodeId!)}
              className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 hover:bg-violet-500/20 rounded px-2 py-1 transition-colors"
            >
              <MapPin className="size-3" />
              Ir al nodo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Escalation trigger bubble ---

const ESCALATION_ACTION_LABELS: Record<string, string> = {
  escalate: "Escalada",
  flag: "Marcada",
  notify: "Notificada",
};

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  keyword: "Palabra clave",
  intent: "Intent",
  confidence: "Confianza",
};

function EscalationTriggerBubble({
  message,
  onFocusNode,
}: {
  message: SimulationMessage;
  onFocusNode?: (nodeId: string) => void;
}) {
  const detail = message.escalationTrigger;
  if (!detail) return null;

  return (
    <div className="px-3 py-1">
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="size-3.5 text-rose-400" />
            <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">
              Trigger de escalamiento
            </span>
          </div>
          <span className="text-[10px] text-rose-300 bg-rose-500/20 rounded px-1.5 py-0.5">
            {ESCALATION_ACTION_LABELS[detail.action] ?? detail.action}
          </span>
        </div>

        {/* Trigger detail */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-800/50 text-rose-300">
              {TRIGGER_TYPE_LABELS[detail.triggerType] ?? detail.triggerType}
            </span>
            <span className="text-xs text-rose-200/80">{detail.triggerDescription}</span>
          </div>
          {(detail.detectedIntent || detail.confidence !== undefined) && (
            <p className="text-[10px] text-rose-300/60">
              {detail.detectedIntent && `Intent: ${detail.detectedIntent}`}
              {detail.detectedIntent && detail.confidence !== undefined && " · "}
              {detail.confidence !== undefined && `Confianza: ${(detail.confidence * 100).toFixed(0)}%`}
            </p>
          )}
        </div>

        {/* Policy name */}
        <p className="text-[10px] text-rose-300/60">
          Política: {detail.policyName}
        </p>

        {/* Go to node button */}
        {message.nodeId && onFocusNode && (
          <div className="flex justify-end">
            <button
              onClick={() => onFocusNode(message.nodeId!)}
              className="flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded px-2 py-1 transition-colors"
            >
              <MapPin className="size-3" />
              Ir al nodo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Risk threshold bubble ---

const RISK_ACTION_LABELS: Record<string, string> = {
  warn: "Advertencia",
  escalate: "Escalada",
};

function RiskThresholdBubble({ message }: { message: SimulationMessage }) {
  const detail = message.riskThreshold;
  if (!detail) return null;

  return (
    <div className="px-3 py-1">
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="size-3.5 text-cyan-400" />
            <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">
              Umbral de riesgo
            </span>
          </div>
          <span className="text-[10px] text-cyan-300 bg-cyan-500/20 rounded px-1.5 py-0.5">
            {RISK_ACTION_LABELS[detail.action] ?? detail.action}
          </span>
        </div>
        <p className="text-xs text-cyan-200/80">
          Score actual: <span className="font-semibold">{detail.currentScore}</span> / Umbral: <span className="font-semibold">{detail.threshold}</span>
        </p>
        <p className="text-[10px] text-cyan-300/60">
          Política: {detail.policyName}
        </p>
      </div>
    </div>
  );
}

// --- Input classification bubble ---

const CLASSIFICATION_ACTION_LABELS: Record<string, string> = {
  ignore: "Ignorada",
  escalate: "Escalada",
  warn: "Advertencia",
};

function InputClassificationBubble({ message }: { message: SimulationMessage }) {
  const detail = message.inputClassification;
  if (!detail) return null;

  return (
    <div className="px-3 py-1">
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Eye className="size-3.5 text-orange-400" />
            <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">
              Contenido detectado
            </span>
          </div>
          <span className="text-[10px] text-orange-300 bg-orange-500/20 rounded px-1.5 py-0.5">
            {CLASSIFICATION_ACTION_LABELS[detail.action] ?? detail.action}
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-orange-200/80">
            Palabra clave: <span className="font-mono bg-orange-800/30 rounded px-1">{detail.keyword}</span>
          </p>
          {detail.category && (
            <p className="text-[10px] text-orange-300/60">
              Categoría: {detail.category}
            </p>
          )}
        </div>
        <p className="text-[10px] text-orange-300/60">
          Política: {detail.policyName}
        </p>
      </div>
    </div>
  );
}

// --- Risk score badge (header) ---

function RiskScoreBadge({ score }: { score: number }) {
  if (score === 0) return null;
  const level = getRiskLevel(score);
  const colors = RISK_LEVEL_COLORS[level];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
      title={`Risk score: ${score}/100`}
    >
      <Activity className="size-3" />
      {score}
    </span>
  );
}

// --- Condition evaluation bubble ---

const OPERATOR_DISPLAY: Record<string, string> = {
  "==": "==",
  equals: "==",
  "!=": "!=",
  not_equals: "!=",
  "<": "<",
  less_than: "<",
  ">": ">",
  greater_than: ">",
  contains: "contiene",
  in: "en",
  exists: "existe",
};

function ConditionEvalBubble({
  message,
  onFocusNode,
}: {
  message: SimulationMessage;
  onFocusNode?: (nodeId: string) => void;
}) {
  const eval_ = message.conditionEval;
  if (!eval_) return null;

  return (
    <div
      className="mx-2 rounded-lg px-3 py-2.5 text-xs bg-blue-500/10 border border-blue-500/20 cursor-pointer hover:border-blue-500/30 transition-colors"
      onClick={() => message.nodeId && onFocusNode?.(message.nodeId)}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2 text-blue-400">
        <GitBranch className="size-3" />
        <span className="font-medium text-[10px] uppercase tracking-wide">
          Condición
        </span>
        <span className="ml-auto text-[10px] text-blue-300/70">
          → {eval_.routeTaken}
        </span>
      </div>

      {/* Rules list */}
      <div className="space-y-1">
        {eval_.rules.map((rule: ConditionRuleEval, i: number) => {
          const opDisplay = OPERATOR_DISPLAY[rule.operator] ?? rule.operator;
          const isMatch = rule.result === true;
          const isFail = rule.result === false;
          const isSkipped = rule.result === null;

          return (
            <div
              key={i}
              className={`flex items-start gap-1.5 rounded px-2 py-1 ${
                isMatch
                  ? "bg-emerald-500/10"
                  : isFail
                    ? "bg-red-500/5"
                    : "bg-slate-800/30"
              }`}
            >
              {/* Result icon */}
              <div className="shrink-0 mt-0.5">
                {isMatch && <Check className="size-3 text-emerald-400" />}
                {isFail && <XIcon className="size-3 text-red-400" />}
                {isSkipped && <Minus className="size-3 text-slate-600" />}
              </div>

              {/* Rule expression */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-mono text-blue-300">
                    {rule.variable || "?"}
                  </span>
                  <span className="text-slate-500">{opDisplay}</span>
                  {rule.operator !== "exists" && (
                    <span className="font-mono text-slate-300">
                      {rule.expectedValue || "?"}
                    </span>
                  )}
                </div>

                {/* Actual value */}
                {!isSkipped && (
                  <div className="flex items-center gap-1 mt-0.5 text-[10px]">
                    <span className="text-slate-600">valor actual:</span>
                    <span
                      className={`font-mono ${
                        isMatch ? "text-emerald-400" : "text-red-300"
                      }`}
                    >
                      {rule.actualValue}
                    </span>
                  </div>
                )}

                {isSkipped && (
                  <span className="text-[10px] text-slate-600 italic">
                    no evaluada
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Default route indicator */}
      {eval_.matchedIndex === null && (
        <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-blue-500/10 text-[10px] text-slate-400 italic">
          <ArrowRight className="size-2.5" />
          Ninguna regla coincidió — ruta por defecto
        </div>
      )}
    </div>
  );
}

// --- Tool call bubble ---

const OUTCOME_STYLES: Record<
  ToolMockOutcome,
  { bg: string; text: string; label: string }
> = {
  success: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    label: "Exitoso",
  },
  error: { bg: "bg-red-500/10", text: "text-red-400", label: "Error" },
  no_stock: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    label: "Sin stock",
  },
  cancelled: {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    label: "Cancelado",
  },
};

function ToolCallBubble({
  message,
  onFocusNode,
}: {
  message: SimulationMessage;
  onFocusNode?: (nodeId: string) => void;
}) {
  const detail = message.toolCallDetail;

  // Fallback for messages without detail
  if (!detail) {
    return (
      <div
        className="mx-4 rounded-lg px-3 py-2 text-xs font-mono bg-purple-500/10 border border-purple-500/20 text-purple-300 cursor-pointer hover:border-purple-500/30 transition-colors"
        onClick={() => message.nodeId && onFocusNode?.(message.nodeId)}
      >
        {message.content}
      </div>
    );
  }

  const outcomeStyle = OUTCOME_STYLES[detail.outcome];

  return (
    <div
      className="mx-2 rounded-lg px-3 py-2.5 text-xs bg-purple-500/10 border border-purple-500/20 cursor-pointer hover:border-purple-500/30 transition-colors"
      onClick={() => message.nodeId && onFocusNode?.(message.nodeId)}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <Wrench className="size-3 text-purple-400" />
        <span className="font-medium text-[10px] uppercase tracking-wide text-purple-400">
          {detail.tool}
        </span>
        <span
          className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${outcomeStyle.bg} ${outcomeStyle.text}`}
        >
          {outcomeStyle.label}
        </span>
        <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
          <Clock className="size-2.5" />
          {detail.durationMs}ms
        </span>
      </div>

      {/* Request */}
      <div className="mb-2">
        <div className="flex items-center gap-1 mb-1 text-[10px] text-purple-300/70">
          <ArrowUpRight className="size-2.5" />
          <span className="uppercase tracking-wide font-medium">Request</span>
        </div>
        <pre className="font-mono text-[10px] text-slate-300 bg-slate-800/60 rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(detail.request, null, 2)}
        </pre>
      </div>

      {/* Response */}
      <div>
        <div className="flex items-center gap-1 mb-1 text-[10px] text-purple-300/70">
          <ArrowDownLeft className="size-2.5" />
          <span className="uppercase tracking-wide font-medium">Response</span>
        </div>
        <pre
          className={`font-mono text-[10px] rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all ${
            detail.outcome === "success"
              ? "text-emerald-300 bg-emerald-500/5"
              : detail.outcome === "error"
                ? "text-red-300 bg-red-500/5"
                : "text-slate-300 bg-slate-800/60"
          }`}
        >
          {JSON.stringify(detail.response, null, 2)}
        </pre>
      </div>

      {/* Tool selection reasoning */}
      {message.aiReasoning?.toolSelection && (
        <ToolSelectionSection selection={message.aiReasoning.toolSelection} />
      )}
    </div>
  );
}

// --- Tool selection section (inside ToolCallBubble) ---

function ToolSelectionSection({
  selection,
}: {
  selection: AIReasoningMetadata["toolSelection"];
}) {
  if (!selection) return null;

  return (
    <div className="mt-2 pt-2 border-t border-purple-500/10">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Brain className="size-3 text-indigo-400" />
        <span className="font-medium text-[10px] uppercase tracking-wide text-indigo-400">
          Selección
        </span>
        <ConfidenceBadge value={selection.confidence} />
      </div>
      <p className="text-[10px] text-slate-300 mb-1.5 italic">
        {selection.reasoning}
      </p>
      {selection.alternatives && selection.alternatives.length > 0 && (
        <div className="space-y-0.5">
          <span className="text-[9px] text-slate-600 uppercase tracking-wide">
            Alternativas
          </span>
          {selection.alternatives.map((alt) => (
            <div
              key={alt.tool}
              className="flex items-center gap-1.5 text-[10px]"
            >
              <span className="text-slate-600">—</span>
              <span className="font-mono text-slate-400">{alt.tool}</span>
              <ConfidenceBar value={alt.score} className="flex-1 max-w-16" />
              <span className="text-slate-600 w-8 text-right">
                {Math.round(alt.score * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- AI reasoning bubble (for Ask nodes) ---

function AIReasoningBubble({
  message,
  onFocusNode,
}: {
  message: SimulationMessage;
  onFocusNode?: (nodeId: string) => void;
}) {
  const reasoning = message.aiReasoning;
  if (!reasoning) return null;

  const { intent, entities } = reasoning;

  return (
    <div
      className="mx-2 rounded-lg px-3 py-2.5 text-xs bg-indigo-500/10 border border-indigo-500/20 cursor-pointer hover:border-indigo-500/30 transition-colors"
      onClick={() => message.nodeId && onFocusNode?.(message.nodeId)}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2 text-indigo-400">
        <Brain className="size-3" />
        <span className="font-medium text-[10px] uppercase tracking-wide">
          Razonamiento AI
        </span>
      </div>

      {/* Intent */}
      {intent && (
        <div className="mb-2">
          <div className="flex items-center gap-1 mb-1 text-[10px] text-indigo-300/70">
            <span className="uppercase tracking-wide font-medium">
              Intención
            </span>
          </div>

          {/* Primary intent */}
          <div className="flex items-center gap-1.5 rounded px-2 py-1 bg-indigo-500/10 mb-1">
            <span className="font-mono text-indigo-300 flex-1 truncate">
              {intent.label}
            </span>
            <ConfidenceBar
              value={intent.confidence}
              className="w-14 shrink-0"
            />
            <span className="text-[10px] text-indigo-300 w-8 text-right shrink-0">
              {Math.round(intent.confidence * 100)}%
            </span>
          </div>

          {/* Alternative intents */}
          {intent.alternatives && intent.alternatives.length > 0 && (
            <div className="space-y-0.5 pl-2">
              {intent.alternatives.map((alt) => (
                <div
                  key={alt.intent}
                  className="flex items-center gap-1.5 text-[10px]"
                >
                  <span className="text-slate-600">—</span>
                  <span className="text-slate-500 flex-1 truncate">
                    {alt.label}
                  </span>
                  <ConfidenceBar
                    value={alt.confidence}
                    className="w-14 shrink-0"
                  />
                  <span className="text-slate-600 w-8 text-right shrink-0">
                    {Math.round(alt.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Entities */}
      {entities && entities.length > 0 && (
        <div>
          <div className="flex items-center gap-1 mb-1 text-[10px] text-indigo-300/70">
            <Tag className="size-2.5" />
            <span className="uppercase tracking-wide font-medium">
              Entidades
            </span>
          </div>
          <div className="space-y-0.5">
            {entities.map((entity, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded px-2 py-1 bg-slate-800/40"
              >
                <span className="text-[10px] text-slate-500 w-14 shrink-0">
                  {entity.type}
                </span>
                <span className="font-mono text-[10px] text-slate-300 flex-1 truncate">
                  {entity.value}
                </span>
                <ConfidenceBadge value={entity.confidence} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!intent && (!entities || entities.length === 0) && (
        <p className="text-[10px] text-slate-600 italic">
          Sin datos de razonamiento
        </p>
      )}
    </div>
  );
}

// --- Confidence helpers ---

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.8
      ? "text-emerald-400 bg-emerald-500/10"
      : value >= 0.5
        ? "text-amber-400 bg-amber-500/10"
        : "text-red-400 bg-red-500/10";

  return (
    <span className={`text-[9px] px-1 py-0.5 rounded font-mono ${color}`}>
      {pct}%
    </span>
  );
}

function ConfidenceBar({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round(value * 100));
  const barColor =
    value >= 0.8
      ? "bg-emerald-400"
      : value >= 0.5
        ? "bg-amber-400"
        : "bg-red-400";

  return (
    <div className={`h-1 rounded-full bg-slate-700 ${className}`}>
      <div
        className={`h-full rounded-full ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// --- Status badge ---

function StatusBadge({
  status,
}: {
  status?: SimulationState["status"];
}) {
  if (!status) return null;

  const styles: Record<string, string> = {
    running: "bg-emerald-500/20 text-emerald-400",
    waiting_input: "bg-amber-500/20 text-amber-400",
    completed: "bg-slate-700 text-slate-400",
    error: "bg-red-500/20 text-red-400",
  };

  const labels: Record<string, string> = {
    running: "Ejecutando",
    waiting_input: "Esperando input",
    completed: "Finalizado",
    error: "Error",
  };

  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded ${styles[status] ?? ""}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

// --- Comparison panel ---

const STATUS_LABELS: Record<string, string> = {
  running: "Ejecutando",
  waiting_input: "Esperando",
  completed: "Completado",
  error: "Error",
};

function ComparisonPanel({ results }: { results: SimulationResult[] }) {
  const [expanded, setExpanded] = useState(true);

  if (results.length < 2) return null;

  // Sort: draft first, then by label
  const sorted = [...results].sort((a, b) => {
    if (a.source === "draft") return -1;
    if (b.source === "draft") return 1;
    return a.label.localeCompare(b.label);
  });

  const rows: { label: string; key: keyof SimulationResult; format?: (v: unknown) => string }[] = [
    { label: "Estado", key: "status", format: (v) => STATUS_LABELS[v as string] ?? String(v) },
    { label: "Nodos", key: "nodeCount" },
    { label: "Mensajes", key: "messageCount" },
    { label: "Errores", key: "errorCount" },
    { label: "Tools", key: "toolCalls" },
    { label: "Riesgo", key: "riskScore" },
    { label: "Fin", key: "endedAt" },
  ];

  // Check if any values differ between results
  const hasDifferences = rows.some((row) => {
    const values = sorted.map((r) => r[row.key]);
    return values.some((v) => v !== values[0]);
  });

  // Build summary
  const draft = sorted.find((r) => r.source === "draft");
  const other = sorted.find((r) => r.source !== "draft");
  let summary = "";
  if (draft && other) {
    const errDiff = draft.errorCount - other.errorCount;
    if (errDiff > 0) {
      summary = `Draft tiene ${errDiff} error${errDiff > 1 ? "es" : ""} más que ${other.label}`;
    } else if (errDiff < 0) {
      summary = `Draft tiene ${Math.abs(errDiff)} error${Math.abs(errDiff) > 1 ? "es" : ""} menos que ${other.label}`;
    } else if (!hasDifferences) {
      summary = "Resultados equivalentes";
    }
  }

  return (
    <div className="mx-3 mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-300 transition-colors mb-1"
      >
        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        <span className="font-semibold uppercase tracking-wider">Comparación</span>
        {!hasDifferences && (
          <span className="text-emerald-400 font-normal">(iguales)</span>
        )}
      </button>

      {expanded && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-2.5 text-[10px]">
          {/* Column headers */}
          <div className="grid gap-1" style={{ gridTemplateColumns: `80px repeat(${sorted.length}, 1fr)` }}>
            <div />
            {sorted.map((r) => (
              <div
                key={r.source}
                className={`font-semibold text-center truncate ${
                  r.source === "draft" ? "text-[#dd7430]" : "text-sky-400"
                }`}
              >
                {r.label}
              </div>
            ))}

            {/* Data rows */}
            {rows.map((row) => {
              const values = sorted.map((r) => r[row.key]);
              const differ = values.some((v) => v !== values[0]);

              return (
                <Fragment key={row.key}>
                  <div className="text-slate-500 py-0.5">{row.label}</div>
                  {sorted.map((r) => {
                    const val = r[row.key];
                    const formatted = row.format ? row.format(val) : String(val);
                    const isError = row.key === "errorCount" && (val as number) > 0;
                    const isStatusError = row.key === "status" && val === "error";

                    return (
                      <div
                        key={r.source}
                        className={`text-center py-0.5 ${
                          isError || isStatusError
                            ? "text-red-400"
                            : differ
                              ? "text-amber-400"
                              : "text-slate-300"
                        }`}
                      >
                        {formatted}
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>

          {/* Summary */}
          {summary && (
            <div className={`mt-2 pt-2 border-t border-slate-700 text-center ${
              summary.includes("más") ? "text-amber-400" : summary.includes("menos") ? "text-emerald-400" : "text-slate-400"
            }`}>
              {summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
