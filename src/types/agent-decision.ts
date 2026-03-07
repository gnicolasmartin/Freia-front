// Agent decision log — records every LLM call the agent makes during simulation.

export type AgentDecisionType =
  | "message_generation"  // generateNodeMessage
  | "intent_detection"    // detectIntentWithLLM
  | "tool_selection"      // selectToolWithLLM
  | "tool_call"           // callLLMWithTool
  | "tool_finalization";  // finalizeToolWithLLM

/** A single message in the prompt, with content truncated to 2000 chars for storage. */
export interface SanitizedMessage {
  role: "system" | "user" | "assistant" | "tool";
  /** Content truncated for storage */
  content: string | null;
  /** For assistant messages with tool_calls: a brief summary */
  toolCallSummary?: string;
}

/** A tool call the LLM decided to make (captured from callLLMWithTool). */
export interface DecisionToolCall {
  id?: string;
  functionName: string;
  arguments: Record<string, unknown>;
}

export interface AgentDecisionEntry {
  id: string;
  timestamp: string;

  // Decision type
  decisionType: AgentDecisionType;

  // Model config
  modelName: string;
  temperature: number;

  // Context — optional, enriched by FlowTestChat
  agentName?: string;
  flowId?: string;
  flowName?: string;
  simulationSource?: string;
  nodeId?: string;
  nodeType?: string;

  // Prompt (sanitized — content truncated, no API keys)
  promptMessages: SanitizedMessage[];

  // Tool calls decided by the LLM (tool_call type only)
  toolCalls?: DecisionToolCall[];

  // Result
  responseContent: string | null;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}

// --- Display constants ---

export const DECISION_TYPE_CONFIG: Record<
  AgentDecisionType,
  { label: string; colorClass: string; bgClass: string; borderClass: string }
> = {
  message_generation: {
    label: "Mensaje",
    colorClass: "text-sky-400",
    bgClass: "bg-sky-900/20",
    borderClass: "border-sky-800/50",
  },
  intent_detection: {
    label: "Intención",
    colorClass: "text-violet-400",
    bgClass: "bg-violet-900/20",
    borderClass: "border-violet-800/50",
  },
  tool_selection: {
    label: "Selección tool",
    colorClass: "text-amber-400",
    bgClass: "bg-amber-900/20",
    borderClass: "border-amber-800/50",
  },
  tool_call: {
    label: "Tool call",
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-900/20",
    borderClass: "border-emerald-800/50",
  },
  tool_finalization: {
    label: "Resp. herramienta",
    colorClass: "text-orange-400",
    bgClass: "bg-orange-900/20",
    borderClass: "border-orange-800/50",
  },
};
