// Pure functions for conversation state transitions.
// No React dependency — reusable in backend.

import type { ConversationState, FlowVariable, FlowVersion } from "@/types/flow";
import { getBusinessHoursConfig, isCurrentlyBusinessHours } from "./business-hours";

/** Conversations inactive longer than this (ms) are considered stale. */
export const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// --- Factory ---

export function createConversation(
  flowId: string,
  version: FlowVersion,
  startNodeId = "start"
): ConversationState {
  const now = new Date().toISOString();

  const vars: Record<string, unknown> = {};
  // Inject business-hours system variables at conversation start
  const bhConfig = getBusinessHoursConfig();
  vars["system.isBusinessHours"]   = isCurrentlyBusinessHours(bhConfig);
  vars["system.outOfHoursMessage"] = bhConfig.outOfHoursMessage ?? "";
  vars["system.bookingUrl"]        = bhConfig.bookingUrl ?? "";
  for (const v of version.variables) {
    vars[v.name] = undefined;
  }

  return {
    id: crypto.randomUUID(),
    flowId,
    versionId: version.id,
    currentNodeId: startNodeId,
    vars,
    varTimestamps: {},
    status: "active",
    startedAt: now,
    lastActivityAt: now,
    retryCount: {},
    toolExecutionLogs: [],
  };
}

// --- State transitions (all return new objects, no mutation) ---

export function advanceNode(
  state: ConversationState,
  nextNodeId: string
): ConversationState {
  return {
    ...state,
    currentNodeId: nextNodeId,
    lastActivityAt: new Date().toISOString(),
  };
}

export function updateVars(
  state: ConversationState,
  updates: Record<string, unknown>
): ConversationState {
  const now = new Date().toISOString();
  const newTimestamps = { ...state.varTimestamps };
  for (const key of Object.keys(updates)) {
    if (updates[key] !== undefined) {
      newTimestamps[key] = now;
    } else {
      delete newTimestamps[key];
    }
  }
  return {
    ...state,
    vars: { ...state.vars, ...updates },
    varTimestamps: newTimestamps,
    lastActivityAt: now,
  };
}

export function incrementRetry(
  state: ConversationState,
  nodeId: string
): ConversationState {
  const current = state.retryCount[nodeId] ?? 0;
  return {
    ...state,
    retryCount: { ...state.retryCount, [nodeId]: current + 1 },
    lastActivityAt: new Date().toISOString(),
  };
}

export function endConversation(
  state: ConversationState,
  status: "completed" | "abandoned" = "completed"
): ConversationState {
  return {
    ...state,
    status,
    lastActivityAt: new Date().toISOString(),
  };
}

// --- TTL expiration ---

export function expireVars(
  state: ConversationState,
  variableDefs: FlowVariable[]
): ConversationState {
  const now = Date.now();
  let changed = false;
  const newVars = { ...state.vars };
  const newTimestamps = { ...state.varTimestamps };

  for (const def of variableDefs) {
    if (!def.ttlSeconds || !newTimestamps[def.name]) continue;
    const setAt = new Date(newTimestamps[def.name]).getTime();
    if (now - setAt > def.ttlSeconds * 1000) {
      newVars[def.name] = undefined;
      delete newTimestamps[def.name];
      changed = true;
    }
  }

  if (!changed) return state;
  return { ...state, vars: newVars, varTimestamps: newTimestamps };
}

// --- Queries ---

export function isStale(state: ConversationState): boolean {
  const lastActivity = new Date(state.lastActivityAt).getTime();
  return Date.now() - lastActivity > STALE_THRESHOLD_MS;
}

export function getActiveConversations(
  conversations: ConversationState[]
): ConversationState[] {
  return conversations.filter((c) => c.status === "active");
}

export function getConversationsForFlow(
  conversations: ConversationState[],
  flowId: string
): ConversationState[] {
  return conversations.filter((c) => c.flowId === flowId);
}
