"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useState,
  type DragEvent,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  SelectionMode,
  type Connection,
  type NodeTypes,
  type Node,
  type Edge,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useFlows } from "@/providers/FlowsProvider";
import { TOOL_PARAM_SCHEMAS, type ToolParamMapping, type FlowVariable } from "@/types/flow";
import type { Policy } from "@/types/policy";
import { getEffectiveKeywords } from "@/types/policy";
import { extractVariables } from "@/lib/template-engine";
import { isKnownVariable } from "@/lib/template-variables";
import {
  SimulationHighlightProvider,
  type SimulationHighlight,
} from "./SimulationHighlightContext";
import StartNode from "./nodes/StartNode";
import MessageNode from "./nodes/MessageNode";
import AskNode from "./nodes/AskNode";
import ConditionNode from "./nodes/ConditionNode";
import ToolCallNode from "./nodes/ToolCallNode";
import HandoffNode from "./nodes/HandoffNode";
import EndNode from "./nodes/EndNode";
import StockLookupNode from "./nodes/StockLookupNode";
import FlowValidationPanel, {
  type ValidationIssue,
} from "./FlowValidationPanel";

// --- Node defaults for drop creation ---

const NODE_DEFAULTS: Record<string, Record<string, unknown>> = {
  message: { label: "Message", message: "" },
  ask: { label: "Ask", responseType: "text", variable: "", maxRetries: 3 },
  condition: { label: "Condition", rules: [] },
  toolcall: {
    label: "Tool Call",
    tool: "",
    parameterMapping: [],
    requireConfirmation: false,
  },
  handoff: { label: "Handoff", target: "", handoffMessage: "" },
  end: { label: "End", outcome: "resolved" },
  stocklookup: {
    label: "Buscar Producto",
    searchMode: "variable",
    searchVariable: "",
    searchLiteral: "",
    saveProductId: "",
    saveProductName: "",
    saveVariantId: "",
    savePrice: "",
    saveFinalPrice: "",
    saveDiscounts: "",
  },
};

// --- Connection rules ---

const MULTI_INPUT_TYPES = new Set(["end", "message", "condition", "handoff", "ask"]);

// --- Graph utilities ---

function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  edges: Edge[]
): boolean {
  const visited = new Set<string>();
  const stack = [targetId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const edge of edges) {
      if (edge.source === current) {
        stack.push(edge.target);
      }
    }
  }

  return false;
}

/** Detect cycles in the existing graph. Returns set of node IDs involved. */
function detectCycles(nodes: Node[], edges: Edge[]): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const node of nodes) color.set(node.id, WHITE);

  const cycleNodes = new Set<string>();

  function dfs(nodeId: string, path: string[]) {
    color.set(nodeId, GRAY);
    path.push(nodeId);

    for (const neighbor of adjacency.get(nodeId) || []) {
      if (color.get(neighbor) === GRAY) {
        const cycleStart = path.indexOf(neighbor);
        for (let i = cycleStart; i < path.length; i++) {
          cycleNodes.add(path[i]);
        }
      } else if (color.get(neighbor) === WHITE) {
        dfs(neighbor, path);
      }
    }

    path.pop();
    color.set(nodeId, BLACK);
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      dfs(node.id, []);
    }
  }

  return cycleNodes;
}

// --- Validation ---

function getNodeDisplayName(node: Node): string {
  return (
    ((node.data as Record<string, unknown>).label as string) ||
    node.type ||
    "Nodo"
  );
}

function validateGraph(nodes: Node[], edges: Edge[], flowVariables: FlowVariable[] = [], activePolicies: Policy[] = [], allowedToolIds: string[] = [], useStock = false): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const startNode = nodes.find((n) => n.type === "start");
  const endNodes = nodes.filter((n) => n.type === "end");

  // --- Structural ---

  // E001: No start node
  if (!startNode) {
    issues.push({
      type: "error",
      code: "E001",
      message: "No hay nodo de Inicio",
    });
  } else {
    // W001: Start without output
    if (!edges.some((e) => e.source === startNode.id)) {
      issues.push({
        type: "warning",
        code: "W001",
        message: "El nodo Inicio no tiene conexión de salida",
        nodeId: startNode.id,
      });
    }
  }

  // W002: No end node
  if (endNodes.length === 0 && nodes.length > 1) {
    issues.push({
      type: "warning",
      code: "W002",
      message: "No hay nodo Fin en el flujo",
    });
  }

  // E002: Disconnected nodes
  for (const node of nodes) {
    if (node.type === "start") continue;
    const hasInput = edges.some((e) => e.target === node.id);
    const hasOutput = edges.some((e) => e.source === node.id);
    const name = getNodeDisplayName(node);

    if (!hasInput && !hasOutput) {
      issues.push({
        type: "error",
        code: "E002",
        message: `"${name}" está desconectado`,
        nodeId: node.id,
      });
    }
  }

  // W003: Dead-end (input but no output, not End)
  for (const node of nodes) {
    if (node.type === "start" || node.type === "end") continue;
    const hasInput = edges.some((e) => e.target === node.id);
    const hasOutput = edges.some((e) => e.source === node.id);

    if (hasInput && !hasOutput) {
      issues.push({
        type: "warning",
        code: "W003",
        message: `"${getNodeDisplayName(node)}" sin salida (dead-end)`,
        nodeId: node.id,
      });
    }
  }

  // E006: Cycle detection
  const cycleNodes = detectCycles(nodes, edges);
  if (cycleNodes.size > 0) {
    const first = nodes.find((n) => cycleNodes.has(n.id));
    issues.push({
      type: "error",
      code: "E006",
      message: `Ciclo infinito detectado (${cycleNodes.size} nodo${cycleNodes.size > 1 ? "s" : ""})`,
      nodeId: first?.id,
    });
  }

  // --- Semantic ---

  for (const node of nodes) {
    const d = node.data as Record<string, unknown>;
    const name = getNodeDisplayName(node);

    // E003: Ask without destination variable (saveToVar required)
    if (node.type === "ask") {
      const variable = (d.variable as string) || "";
      if (!variable.trim()) {
        issues.push({
          type: "error",
          code: "E003",
          message: `"${name}" sin variable destino (saveToVar obligatorio)`,
          nodeId: node.id,
        });
      }

      // W005: Ask with validationRule but no errorMessage
      const validationRule = (d.validationRule as string) || "";
      const errorMessage = (d.errorMessage as string) || "";
      if (validationRule.trim() && !errorMessage.trim()) {
        issues.push({
          type: "warning",
          code: "W005",
          message: `"${name}" tiene regla de validación sin mensaje de error`,
          nodeId: node.id,
        });
      }

      // E009: Ask node solicita datos prohibidos por política
      const askQuestion = ((d.question as string) || "").toLowerCase();
      const askVariable = ((d.variable as string) || "").toLowerCase();
      const askLabel = ((d.label as string) || "").toLowerCase();

      for (const policy of activePolicies) {
        const keywords = getEffectiveKeywords(policy);
        let matched = false;
        for (const kw of keywords) {
          const kwLower = kw.toLowerCase();
          if (askQuestion.includes(kwLower) || askVariable.includes(kwLower) || askLabel.includes(kwLower)) {
            issues.push({
              type: "error",
              code: "E009",
              message: `"${name}" solicita datos prohibidos por "${policy.name}": "${kw}"`,
              nodeId: node.id,
            });
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }

    // E004: Condition without default route connected
    if (node.type === "condition") {
      const rules = (d.rules as Array<{ variable?: string; operator?: string; value?: string }>) || [];
      if (rules.length === 0) {
        issues.push({
          type: "warning",
          code: "W004",
          message: `"${name}" sin reglas definidas`,
          nodeId: node.id,
        });
      }

      // W006: Incomplete condition rules (missing variable or value)
      for (const rule of rules) {
        if (!rule.variable?.trim()) {
          issues.push({
            type: "warning",
            code: "W006",
            message: `"${name}" tiene regla sin variable`,
            nodeId: node.id,
          });
          break;
        }
        if (rule.operator !== "exists" && !rule.value?.trim()) {
          issues.push({
            type: "warning",
            code: "W006",
            message: `"${name}" tiene regla sin valor de comparación`,
            nodeId: node.id,
          });
          break;
        }
      }

      // Check default handle is connected
      const defaultConnected = edges.some(
        (e) => e.source === node.id && e.sourceHandle === "default"
      );
      if (!defaultConnected) {
        issues.push({
          type: "error",
          code: "E004",
          message: `"${name}" sin ruta por defecto conectada`,
          nodeId: node.id,
        });
      }
    }

    // E005: Tool without tool selected
    if (node.type === "toolcall") {
      const tool = (d.tool as string) || "";
      if (!tool.trim()) {
        issues.push({
          type: "error",
          code: "E005",
          message: `"${name}" sin herramienta seleccionada`,
          nodeId: node.id,
        });
      } else {
        // W008: Tool not authorized for this flow
        if (allowedToolIds.length > 0 && !allowedToolIds.includes(tool)) {
          issues.push({
            type: "warning",
            code: "W008",
            message: `"${name}" usa herramienta no autorizada para este flujo: "${tool}"`,
            nodeId: node.id,
          });
        }

        // E007: Required tool params without mapping
        const schema = TOOL_PARAM_SCHEMAS[tool] || [];
        const mappings = (d.parameterMapping as ToolParamMapping[]) || [];
        const requiredParams = schema.filter((p) => p.required);
        const unmapped = requiredParams.filter(
          (p) => !mappings.some((m) => m.paramName === p.name && m.variableName)
        );
        if (unmapped.length > 0) {
          issues.push({
            type: "error",
            code: "E007",
            message: `"${name}" tiene ${unmapped.length} parámetro${unmapped.length > 1 ? "s" : ""} obligatorio${unmapped.length > 1 ? "s" : ""} sin asignar: ${unmapped.map((p) => p.label).join(", ")}`,
            nodeId: node.id,
          });
        }

        // W009: No error route connected
        const hasErrorRoute = edges.some(
          (e) => e.source === node.id && e.sourceHandle === "error"
        );
        if (!hasErrorRoute) {
          issues.push({
            type: "warning",
            code: "W009",
            message: `"${name}" sin ruta de error conectada — se usará la ruta por defecto en caso de fallo`,
            nodeId: node.id,
          });
        }
      }
    }

    // W007: Undefined variables in templates
    if (node.type === "message" || node.type === "ask") {
      const templates: string[] = [];
      if (node.type === "message") {
        const msg = (d.message as string) || "";
        if (msg) templates.push(msg);
      }
      if (node.type === "ask") {
        const errMsg = (d.errorMessage as string) || "";
        if (errMsg) templates.push(errMsg);
      }
      for (const tpl of templates) {
        const vars = extractVariables(tpl);
        const unknown = vars.filter((v) => !isKnownVariable(v, flowVariables, { useStock }));
        if (unknown.length > 0) {
          issues.push({
            type: "warning",
            code: "W007",
            message: `"${name}" usa variable${unknown.length > 1 ? "s" : ""} no definida${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`,
            nodeId: node.id,
          });
        }
      }
    }

    // E008: Undefined variable in Condition rule (blocking)
    if (node.type === "condition") {
      const rules = (d.rules as Array<{ variable?: string }>) || [];
      for (const rule of rules) {
        const v = rule.variable?.trim();
        if (v && !isKnownVariable(v, flowVariables, { useStock })) {
          issues.push({
            type: "error",
            code: "E008",
            message: `"${name}" usa variable no definida en condición: ${v}`,
            nodeId: node.id,
          });
          break;
        }
      }
    }
  }

  // W010: Product variables used in templates but no stocklookup node
  const hasStockLookup = nodes.some((n) => n.type === "stocklookup");
  if (!hasStockLookup) {
    for (const node of nodes) {
      const d = node.data as Record<string, unknown>;
      const templates: string[] = [];
      if (node.type === "message") {
        const msg = (d.message as string) || "";
        if (msg) templates.push(msg);
      }
      if (node.type === "ask") {
        const errMsg = (d.errorMessage as string) || "";
        if (errMsg) templates.push(errMsg);
      }
      for (const tpl of templates) {
        const productVars = extractVariables(tpl).filter((v) =>
          v.startsWith("product.")
        );
        if (productVars.length > 0) {
          const name = getNodeDisplayName(node);
          issues.push({
            type: "warning",
            code: "W010",
            message: `"${name}" usa variable${productVars.length > 1 ? "s" : ""} de producto sin nodo Stock Lookup en el flujo: ${productVars.join(", ")}`,
            nodeId: node.id,
          });
          break;
        }
      }
    }
  }

  return issues;
}

// --- Save state ---

export type SaveStatus = "saved" | "unsaved" | "saving";

export interface SaveState {
  status: SaveStatus;
  lastSavedAt: Date | null;
}

// --- Component ---

export interface FlowCanvasHandle {
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  save: () => void;
  focusNode: (nodeId: string) => void;
  validate: () => ValidationIssue[];
  loadVersion: (nodes: Node[], edges: Edge[]) => void;
}

interface FlowCanvasProps {
  flowId: string;
  onNodeSelect?: (node: Node | null) => void;
  onSaveStateChange?: (state: SaveState) => void;
  autoSaveEnabled?: boolean;
  autoSaveInterval?: number;
  simulationHighlight?: SimulationHighlight | null;
  activePolicies?: Policy[];
  useStock?: boolean;
}

const FlowCanvas = forwardRef<FlowCanvasHandle, FlowCanvasProps>(
  function FlowCanvas(
    {
      flowId,
      onNodeSelect,
      onSaveStateChange,
      autoSaveEnabled = false,
      autoSaveInterval = 30000,
      simulationHighlight,
      activePolicies = [],
      useStock = false,
    },
    ref
  ) {
    const { getFlow, updateFlowGraph } = useFlows();
    const flow = getFlow(flowId);
    const { screenToFlowPosition, setCenter, getZoom } = useReactFlow();

    const nodeTypes: NodeTypes = useMemo(
      () => ({
        start: StartNode,
        message: MessageNode,
        ask: AskNode,
        condition: ConditionNode,
        toolcall: ToolCallNode,
        handoff: HandoffNode,
        end: EndNode,
        stocklookup: StockLookupNode,
      }),
      []
    );

    const [nodes, setNodes, onNodesChange] = useNodesState(flow?.nodes ?? []);
    const [edges, setEdges, onEdgesChange] = useEdgesState(flow?.edges ?? []);
    const [validationIssues, setValidationIssues] = useState<
      ValidationIssue[]
    >([]);

    // --- Save / dirty tracking ---

    const isDirtyRef = useRef(false);
    const initialLoad = useRef(true);
    const lastSavedAtRef = useRef<Date | null>(null);

    const notifySaveState = useCallback(
      (status: SaveStatus) => {
        onSaveStateChange?.({
          status,
          lastSavedAt: lastSavedAtRef.current,
        });
      },
      [onSaveStateChange]
    );

    const save = useCallback(() => {
      if (!isDirtyRef.current) return;
      notifySaveState("saving");
      updateFlowGraph(flowId, nodes, edges);
      isDirtyRef.current = false;
      lastSavedAtRef.current = new Date();
      setTimeout(() => notifySaveState("saved"), 300);
    }, [flowId, nodes, edges, updateFlowGraph, notifySaveState]);

    // Mark dirty on changes (skip initial load)
    useEffect(() => {
      if (initialLoad.current) {
        initialLoad.current = false;
        return;
      }
      isDirtyRef.current = true;
      notifySaveState("unsaved");
    }, [nodes, edges, notifySaveState]);

    // Autosave interval
    useEffect(() => {
      if (!autoSaveEnabled) return;

      const interval = setInterval(() => {
        if (isDirtyRef.current) {
          save();
        }
      }, autoSaveInterval);

      return () => clearInterval(interval);
    }, [autoSaveEnabled, autoSaveInterval, save]);

    // --- Focus node (select + center) ---

    const focusNode = useCallback(
      (nodeId: string) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Select the node
        setNodes((nds) =>
          nds.map((n) => ({ ...n, selected: n.id === nodeId }))
        );

        // Center on node
        const x = node.position.x + 90; // approximate center
        const y = node.position.y + 30;
        setCenter(x, y, { zoom: Math.max(getZoom(), 1), duration: 400 });

        // Notify parent about selection
        if (onNodeSelect) onNodeSelect(node);
      },
      [nodes, setNodes, setCenter, getZoom, onNodeSelect]
    );

    // Expose methods to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        updateNodeData: (nodeId: string, data: Record<string, unknown>) => {
          setNodes((nds) =>
            nds.map((n) => (n.id === nodeId ? { ...n, data } : n))
          );

          // Clean up edges for removed condition rule handles
          const node = nodes.find((n) => n.id === nodeId);
          if (node?.type === "condition" && data.rules) {
            const validHandleIds = new Set([
              ...(data.rules as Array<{ id: string }>).map((r) => r.id),
              "default",
            ]);
            setEdges((eds) =>
              eds.filter(
                (e) =>
                  e.source !== nodeId ||
                  validHandleIds.has(e.sourceHandle || "")
              )
            );
          }
        },
        save,
        focusNode,
        validate: () => validateGraph(nodes, edges, flow?.variables ?? [], activePolicies, flow?.allowedToolIds ?? [], useStock),
        loadVersion: (newNodes: Node[], newEdges: Edge[]) => {
          setNodes(newNodes);
          setEdges(newEdges);
          isDirtyRef.current = false;
          initialLoad.current = true;
          notifySaveState("saved");
        },
      }),
      [setNodes, setEdges, nodes, edges, save, focusNode, notifySaveState, activePolicies]
    );

    // Real-time graph validation
    useEffect(() => {
      setValidationIssues(validateGraph(nodes, edges, flow?.variables ?? [], activePolicies, flow?.allowedToolIds ?? [], useStock));
    }, [nodes, edges, activePolicies]);

    // --- Connection validation ---

    const isValidConnection = useCallback(
      (connection: Edge | Connection) => {
        const { source, target, sourceHandle } = connection;
        if (!source || !target) return false;

        if (source === target) return false;

        const isDuplicate = edges.some(
          (e) =>
            e.source === source &&
            e.target === target &&
            e.sourceHandle === (sourceHandle || null)
        );
        if (isDuplicate) return false;

        const sourceHandleOccupied = edges.some(
          (e) =>
            e.source === source &&
            e.sourceHandle === (sourceHandle || null)
        );
        if (sourceHandleOccupied) return false;

        const targetNode = nodes.find((n) => n.id === target);
        if (targetNode) {
          const allowsMultiInput = MULTI_INPUT_TYPES.has(
            targetNode.type || ""
          );
          if (!allowsMultiInput) {
            const currentInputs = edges.filter(
              (e) => e.target === target
            ).length;
            if (currentInputs >= 1) return false;
          }
        }

        if (wouldCreateCycle(source, target, edges)) return false;

        return true;
      },
      [edges, nodes]
    );

    const onConnect = useCallback(
      (connection: Connection) => {
        if (!isValidConnection(connection)) return;

        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              animated: true,
              style: { stroke: "#dd7430" },
            },
            eds
          )
        );
      },
      [setEdges, isValidConnection]
    );

    // --- Selection ---

    const onSelectionChange = useCallback(
      ({ nodes: selectedNodes }: { nodes: Node[] }) => {
        if (onNodeSelect) {
          onNodeSelect(selectedNodes.length === 1 ? selectedNodes[0] : null);
        }
      },
      [onNodeSelect]
    );

    // --- Drag & Drop ---

    const onDragOver = useCallback((event: DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
      (event: DragEvent) => {
        event.preventDefault();
        const type = event.dataTransfer.getData("application/reactflow");
        if (!type) return;

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newNode = {
          id: `${type}-${Date.now()}`,
          type,
          position,
          data: NODE_DEFAULTS[type] || { label: type },
        };

        setNodes((nds) => [...nds, newNode]);
      },
      [screenToFlowPosition, setNodes]
    );

    const onPaneClick = useCallback(() => {
      if (onNodeSelect) onNodeSelect(null);
    }, [onNodeSelect]);

    // Handle validation issue click → focus node
    const handleIssueClick = useCallback(
      (issue: ValidationIssue) => {
        if (issue.nodeId) {
          focusNode(issue.nodeId);
        }
      },
      [focusNode]
    );

    // --- Simulation highlight: context value + edge styling ---

    const simHighlightValue = useMemo<SimulationHighlight>(
      () => simulationHighlight ?? { currentNodeId: null, visitedNodeIds: [] },
      [simulationHighlight]
    );

    const displayEdges = useMemo(() => {
      if (!simulationHighlight?.currentNodeId && (simulationHighlight?.visitedNodeIds.length ?? 0) === 0) {
        return edges;
      }

      const visited = simulationHighlight?.visitedNodeIds ?? [];
      const currentId = simulationHighlight?.currentNodeId;

      // Build set of traversed edge IDs from consecutive visited pairs
      const traversedEdgeIds = new Set<string>();
      for (let i = 0; i < visited.length - 1; i++) {
        const edge = edges.find(
          (e) => e.source === visited[i] && e.target === visited[i + 1]
        );
        if (edge) traversedEdgeIds.add(edge.id);
      }

      // The "active" edge: from the last visited node to the current node
      let activeEdgeId: string | null = null;
      if (currentId && visited.length > 0) {
        const lastVisited = visited[visited.length - 1];
        if (lastVisited !== currentId) {
          const edge = edges.find(
            (e) => e.source === lastVisited && e.target === currentId
          );
          activeEdgeId = edge?.id ?? null;
        }
      }

      return edges.map((e) => {
        if (e.id === activeEdgeId) {
          return { ...e, style: { stroke: "#10b981", strokeWidth: 2.5 }, animated: true };
        }
        if (traversedEdgeIds.has(e.id)) {
          return { ...e, style: { stroke: "#10b981", strokeWidth: 2 }, animated: false };
        }
        return e;
      });
    }, [edges, simulationHighlight]);

    return (
      <div className="h-full w-full relative">
        <SimulationHighlightProvider value={simHighlightValue}>
        <ReactFlow
          nodes={nodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onSelectionChange={onSelectionChange}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: "#dd7430" },
          }}
          connectionLineStyle={{ stroke: "#dd7430" }}
          selectionMode={SelectionMode.Partial}
          className="bg-slate-950"
        >
          <Background color="#334155" gap={20} />
          <Controls
            className="!bg-slate-800 !border-slate-700 !rounded-lg [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700"
          />
          <MiniMap
            nodeStrokeColor="#dd7430"
            nodeColor="#1e293b"
            maskColor="rgba(15, 23, 42, 0.7)"
            className="!bg-slate-900 !border-slate-700 !rounded-lg"
          />
        </ReactFlow>
        </SimulationHighlightProvider>

        <FlowValidationPanel
          issues={validationIssues}
          onIssueClick={handleIssueClick}
        />
      </div>
    );
  }
);

export default FlowCanvas;
