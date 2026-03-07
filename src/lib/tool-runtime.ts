// Runtime utility for resolving tool parameters from conversation state.
// Pure functions — no React dependency, reusable in backend.

import type {
  ToolParamMapping,
  ToolParamDef,
  ToolExecutionLog,
  ConversationState,
} from "@/types/flow";
import { TOOL_PARAM_SCHEMAS } from "@/types/flow";

// --- Deep property access (supports dotted paths like "contact.email") ---

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current !== null && current !== undefined && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// --- Resolve mapped variables to actual parameter values ---

export interface ResolvedParams {
  params: Record<string, unknown>;
  missing: string[];
  warnings: string[];
}

export function resolveToolParams(
  tool: string,
  mappings: ToolParamMapping[],
  vars: Record<string, unknown>,
  schemaOverride?: ToolParamDef[]
): ResolvedParams {
  const schema = schemaOverride ?? TOOL_PARAM_SCHEMAS[tool] ?? [];
  const params: Record<string, unknown> = {};
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const paramDef of schema) {
    const mapping = mappings.find((m) => m.paramName === paramDef.name);

    if (!mapping || !mapping.variableName) {
      if (paramDef.required) {
        missing.push(paramDef.name);
      }
      continue;
    }

    const value = getNestedValue(vars, mapping.variableName);

    if (value === undefined || value === null) {
      if (paramDef.required) {
        missing.push(paramDef.name);
        warnings.push(
          `Variable "${mapping.variableName}" no tiene valor para parámetro "${paramDef.name}"`
        );
      }
      continue;
    }

    params[paramDef.name] = value;
  }

  return { params, missing, warnings };
}

// --- Create execution log entry ---

export function createToolExecutionLog(
  nodeId: string,
  tool: string,
  request: Record<string, unknown>
): ToolExecutionLog {
  return {
    nodeId,
    tool,
    timestamp: new Date().toISOString(),
    request,
  };
}

export function completeToolExecutionLog(
  log: ToolExecutionLog,
  response?: Record<string, unknown>,
  error?: string
): ToolExecutionLog {
  const durationMs =
    new Date().getTime() - new Date(log.timestamp).getTime();
  return {
    ...log,
    response,
    error,
    durationMs,
  };
}

// --- Append log to conversation state ---

export function appendToolLog(
  state: ConversationState,
  log: ToolExecutionLog
): ConversationState {
  return {
    ...state,
    toolExecutionLogs: [...state.toolExecutionLogs, log],
  };
}
