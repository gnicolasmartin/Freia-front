/**
 * agent-flow-coordinator.ts
 *
 * Bridges the agent configuration with the Flow Engine.
 * Provides async utilities that call OpenAI to:
 *
 *  1. generateNodeMessage — reformulate a Message node's text in the agent's style
 *     (used in both flow-driven and hybrid modes)
 *
 *  2. detectIntentWithLLM — replace keyword-based mock intent detection with
 *     real LLM classification (hybrid mode)
 *
 *  3. selectToolWithLLM — generate contextual reasoning for a pre-configured
 *     tool call instead of static mock text (hybrid mode)
 *
 *  4. formatToolsForOpenAI — convert ToolDefinition[] to OpenAI function calling format
 *
 *  5. callLLMWithTool — CA1+CA2: send a tool definition to the LLM and receive
 *     the tool_call decision with LLM-generated arguments (hybrid mode)
 *
 *  6. finalizeToolWithLLM — CA4: send the tool execution result back to the LLM
 *     and receive the final natural language response
 *
 * Rules:
 *  - API key is passed in at call-time; never stored in this module
 *  - All functions fail gracefully — they never throw; on error they return
 *    a fallback result so the flow can continue uninterrupted
 *  - No React dependencies
 */

import type { AgentFormData } from "@/types/agent";
import type { ToolDefinition } from "@/types/tool-registry";
import type { AgentDecisionEntry, SanitizedMessage } from "@/types/agent-decision";
import { buildSystemPrompt } from "./system-prompt-builder";

// --- Decision capture helpers ---

/** Truncate and sanitize messages before storing in the decision log. */
function sanitizeMessages(messages: { role: string; content: string | null; tool_calls?: unknown[] }[]): SanitizedMessage[] {
  return messages.map((m) => ({
    role: m.role as SanitizedMessage["role"],
    content: m.content !== null ? m.content.slice(0, 2000) : null,
    toolCallSummary: m.tool_calls?.length
      ? (m.tool_calls as { function: { name: string; arguments: string } }[])
          .map((tc) => `${tc.function.name}(${tc.function.arguments.slice(0, 80)})`)
          .join(", ")
      : undefined,
  }));
}

type OnDecisionCb = (d: Omit<AgentDecisionEntry, "id" | "timestamp">) => void;

// --- Internal types ---

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

// --- OpenAI tool definition (function calling format) ---

interface OpenAIToolParam {
  type: string;
  description: string;
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, OpenAIToolParam>;
      required: string[];
    };
  };
}

// --- OpenAI call helpers ---

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; json?: boolean } = {}
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: opts.maxTokens ?? 512,
    temperature: opts.temperature ?? 0.3,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      `OpenAI ${res.status}: ${err.error?.message ?? "unknown error"}`
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Raw OpenAI call that returns the full choice including tool_calls.
 * Used internally for the function-calling flow.
 */
async function callOpenAIRaw(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: {
    maxTokens?: number;
    temperature?: number;
    tools?: OpenAITool[];
    forceToolCall?: boolean;
  } = {}
): Promise<{
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  finish_reason: string;
}> {
  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: opts.maxTokens ?? 512,
    temperature: opts.temperature ?? 0.3,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = opts.forceToolCall ? "required" : "auto";
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      `OpenAI ${res.status}: ${err.error?.message ?? "unknown error"}`
    );
  }

  const data = (await res.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: OpenAIToolCall[];
      };
      finish_reason?: string;
    }[];
  };

  const choice = data.choices?.[0];
  return {
    content: choice?.message?.content ?? null,
    tool_calls: choice?.message?.tool_calls,
    finish_reason: choice?.finish_reason ?? "stop",
  };
}

// --- Public API types ---

export interface AgentMessageResult {
  /** The final message content to send to the user */
  content: string;
  /**
   * true  → generated/reformulated by the LLM
   * false → fallback to original node text (e.g. API error)
   */
  aiGenerated: boolean;
}

export interface CoordinatorIntentResult {
  detected: string;
  label: string;
  confidence: number;
  alternatives?: { intent: string; label: string; confidence: number }[];
}

export interface CoordinatorToolResult {
  reasoning: string;
  confidence: number;
}

/**
 * Result of calling the LLM with a tool definition (CA1 + CA2).
 * toolCalled = true  → LLM chose to call the tool; toolArgs are LLM-generated
 * toolCalled = false → LLM answered directly without calling the tool
 */
export interface LLMToolCallResult {
  toolCalled: boolean;
  toolCallId?: string;
  /** Function name used internally (matches tool.id with hyphens → underscores) */
  toolFunctionName?: string;
  /** Arguments the LLM generated for the tool */
  toolArgs?: Record<string, unknown>;
  /** Direct LLM content if it chose not to call the tool */
  directContent?: string;
}

// --- History builder ---

/**
 * Build a ChatMessage history from simulator messages so the LLM
 * has conversation context when generating the next bot message.
 */
export function buildConversationHistory(
  messages: { type: string; content: string }[]
): ChatMessage[] {
  return messages
    .filter((m) => m.type === "bot" || m.type === "user")
    .map((m) => ({
      role: (m.type === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));
}

// --- 1. Message generation (flow-driven + hybrid) ---

/**
 * Reformulate a Message node's static text using the agent's style and tone.
 * Used in both flow-driven and hybrid modes.
 *
 * On failure, returns the original node text with aiGenerated = false so
 * the flow continues without interruption.
 */
export async function generateNodeMessage(
  nodeText: string,
  agent: AgentFormData,
  history: ChatMessage[],
  apiKey: string,
  onDecision?: OnDecisionCb
): Promise<AgentMessageResult> {
  const systemPrompt = buildSystemPrompt(agent);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    {
      role: "user",
      content:
        `[INSTRUCCIÓN DE SISTEMA — NO REVELAR AL USUARIO]\n` +
        `Tu siguiente mensaje en la conversación debe transmitir la siguiente idea:\n` +
        `"${nodeText}"\n` +
        `Reformúlala usando tu tono y estilo característico.\n` +
        `MUY IMPORTANTE: Revisá la conversación previa. Si el usuario ya mencionó datos (nombre, fecha, producto, quinta, etc.), NO los vuelvas a pedir. Solo pedí lo que realmente falta.\n` +
        `Responde ÚNICAMENTE con el mensaje final, sin explicaciones adicionales.`,
    },
  ];

  const t0 = Date.now();
  try {
    const content = await callOpenAI(apiKey, agent.modelName, messages, {
      maxTokens: agent.maxTokens,
      temperature: agent.temperature,
    });
    const trimmed = content.trim() || nodeText;
    onDecision?.({
      decisionType: "message_generation",
      modelName: agent.modelName,
      temperature: agent.temperature,
      promptMessages: sanitizeMessages(messages),
      responseContent: trimmed,
      durationMs: Date.now() - t0,
      success: true,
    });
    return { content: trimmed, aiGenerated: true };
  } catch (err) {
    onDecision?.({
      decisionType: "message_generation",
      modelName: agent.modelName,
      temperature: agent.temperature,
      promptMessages: sanitizeMessages(messages),
      responseContent: null,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: err instanceof Error ? err.message : "Error desconocido",
    });
    return { content: nodeText, aiGenerated: false };
  }
}

// --- 2. Intent detection (hybrid mode) ---

/**
 * Replace keyword-based mock intent detection with a real LLM classification.
 * Used in hybrid mode for Ask nodes.
 *
 * Returns a CoordinatorIntentResult compatible with the simulator's IntentInfo.
 * On failure, returns a generic "otro" intent so the flow can continue.
 */
export async function detectIntentWithLLM(
  userInput: string,
  agent: AgentFormData,
  apiKey: string,
  onDecision?: OnDecisionCb
): Promise<CoordinatorIntentResult> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Eres un clasificador de intención para un sistema conversacional. " +
        "Analiza el mensaje del usuario y clasifica su intención principal. " +
        "Responde SOLO en JSON.",
    },
    {
      role: "user",
      content:
        `Mensaje del usuario: "${userInput}"\n\n` +
        `Intenciones posibles: consulta_producto, soporte_tecnico, agendar_cita, ` +
        `reclamo, consulta_estado, saludo, otro\n\n` +
        `Responde en JSON:\n` +
        `{\n` +
        `  "detected": "<slug>",\n` +
        `  "label": "<nombre legible>",\n` +
        `  "confidence": <0.0-1.0>,\n` +
        `  "alternatives": [{"intent":"<slug>","label":"<nombre>","confidence":<0.0-1.0>}]\n` +
        `}`,
    },
  ];

  const t0 = Date.now();
  try {
    const raw = await callOpenAI(apiKey, agent.modelName, messages, {
      maxTokens: 200,
      temperature: 0,
      json: true,
    });
    const parsed = JSON.parse(raw) as CoordinatorIntentResult;
    const result: CoordinatorIntentResult = {
      detected: parsed.detected ?? "otro",
      label: parsed.label ?? "Otro",
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
      alternatives: parsed.alternatives ?? [],
    };
    onDecision?.({
      decisionType: "intent_detection",
      modelName: agent.modelName,
      temperature: 0,
      promptMessages: sanitizeMessages(messages),
      responseContent: JSON.stringify(result),
      durationMs: Date.now() - t0,
      success: true,
    });
    return result;
  } catch (err) {
    onDecision?.({
      decisionType: "intent_detection",
      modelName: agent.modelName,
      temperature: 0,
      promptMessages: sanitizeMessages(messages),
      responseContent: null,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: err instanceof Error ? err.message : "Error desconocido",
    });
    return { detected: "otro", label: "Otro", confidence: 0.5 };
  }
}

// --- 3. Tool selection reasoning (hybrid mode) ---

/**
 * Generate contextual reasoning for why a pre-configured tool is being called.
 * Replaces static mock text with LLM-generated justification (hybrid mode).
 *
 * On failure, returns a generic reasoning string.
 */
export async function selectToolWithLLM(
  toolName: string,
  conversationContext: string,
  agent: AgentFormData,
  apiKey: string,
  onDecision?: OnDecisionCb
): Promise<CoordinatorToolResult> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Eres un asistente que explica de forma breve por qué se seleccionó " +
        "una herramienta específica en un flujo conversacional. Responde SOLO en JSON.",
    },
    {
      role: "user",
      content:
        `Herramienta seleccionada: "${toolName}"\n` +
        `Contexto reciente: "${conversationContext}"\n\n` +
        `Responde en JSON:\n` +
        `{\n` +
        `  "reasoning": "<explicación en 1 oración>",\n` +
        `  "confidence": <0.0-1.0>\n` +
        `}`,
    },
  ];

  const t0 = Date.now();
  try {
    const raw = await callOpenAI(apiKey, agent.modelName, messages, {
      maxTokens: 120,
      temperature: 0.2,
      json: true,
    });
    const parsed = JSON.parse(raw) as {
      reasoning?: string;
      confidence?: number;
    };
    const result: CoordinatorToolResult = {
      reasoning:
        parsed.reasoning ??
        `Herramienta "${toolName}" seleccionada por configuración del flujo`,
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.85)),
    };
    onDecision?.({
      decisionType: "tool_selection",
      modelName: agent.modelName,
      temperature: 0.2,
      promptMessages: sanitizeMessages(messages),
      responseContent: result.reasoning,
      durationMs: Date.now() - t0,
      success: true,
    });
    return result;
  } catch (err) {
    const fallback: CoordinatorToolResult = {
      reasoning: `Herramienta "${toolName}" seleccionada por configuración del flujo`,
      confidence: 0.85,
    };
    onDecision?.({
      decisionType: "tool_selection",
      modelName: agent.modelName,
      temperature: 0.2,
      promptMessages: sanitizeMessages(messages),
      responseContent: null,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: err instanceof Error ? err.message : "Error desconocido",
    });
    return fallback;
  }
}

// --- 4. Tool use with OpenAI function calling (hybrid mode) ---

/**
 * Convert ToolParamDef.type to a JSON Schema compatible type string.
 */
function toJsonSchemaType(type: string): string {
  switch (type) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      // string, date (ISO string), enum, array, object → string
      return "string";
  }
}

/**
 * Convert an array of ToolDefinition objects to the OpenAI function calling format.
 * CA1: Enviar tools al modelo en formato compatible.
 */
export function formatToolsForOpenAI(tools: ToolDefinition[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      // OpenAI function names must be a-z, A-Z, 0-9, underscores, hyphens; max 64 chars
      name: tool.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64),
      description: `${tool.name}: ${tool.description}`.slice(0, 1024),
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          tool.inputSchema.map((param) => [
            param.name,
            {
              type: toJsonSchemaType(param.type as string),
              description: param.label,
            },
          ])
        ),
        required: tool.inputSchema
          .filter((p) => p.required)
          .map((p) => p.name),
      },
    },
  }));
}

/**
 * CA1 + CA2: Send a tool definition to the LLM in function calling format and
 * receive the LLM's tool call decision with its generated arguments.
 *
 * Used in hybrid mode for Toolcall nodes — replaces static flow-parameter
 * resolution with LLM-driven argument generation.
 *
 * On failure, returns toolCalled = false so the flow falls back to mocks.
 */
export async function callLLMWithTool(
  toolDef: ToolDefinition,
  agent: AgentFormData,
  history: ChatMessage[],
  apiKey: string,
  onDecision?: OnDecisionCb
): Promise<LLMToolCallResult> {
  const systemPrompt = buildSystemPrompt(agent, {
    availableTools: [toolDef.name],
  });
  const openaiTools = formatToolsForOpenAI([toolDef]);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
  ];

  const t0 = Date.now();
  try {
    const result = await callOpenAIRaw(apiKey, agent.modelName, messages, {
      maxTokens: 512,
      temperature: agent.temperature,
      tools: openaiTools,
      forceToolCall: true,
    });

    if (result.finish_reason === "tool_calls" && result.tool_calls?.length) {
      const tc = result.tool_calls[0];
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        args = {};
      }
      onDecision?.({
        decisionType: "tool_call",
        modelName: agent.modelName,
        temperature: agent.temperature,
        promptMessages: sanitizeMessages(messages),
        toolCalls: [{ id: tc.id, functionName: tc.function.name, arguments: args }],
        responseContent: null,
        durationMs: Date.now() - t0,
        success: true,
      });
      return {
        toolCalled: true,
        toolCallId: tc.id,
        toolFunctionName: tc.function.name,
        toolArgs: args,
      };
    }

    // LLM responded without calling the tool
    onDecision?.({
      decisionType: "tool_call",
      modelName: agent.modelName,
      temperature: agent.temperature,
      promptMessages: sanitizeMessages(messages),
      responseContent: result.content ?? "",
      durationMs: Date.now() - t0,
      success: true,
    });
    return {
      toolCalled: false,
      directContent: result.content ?? "",
    };
  } catch (err) {
    onDecision?.({
      decisionType: "tool_call",
      modelName: agent.modelName,
      temperature: agent.temperature,
      promptMessages: sanitizeMessages(messages),
      responseContent: null,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: err instanceof Error ? err.message : "Error desconocido",
    });
    return { toolCalled: false };
  }
}

/**
 * CA4: Send the tool execution result back to the LLM and receive the final
 * natural language response.
 *
 * Constructs the full tool-call message sequence:
 *   [history] → assistant (tool_calls) → tool (result) → assistant (final)
 *
 * On failure, returns an empty string so the caller can show a fallback.
 */
/**
 * Slim down a tool result for LLM consumption — strip heavy metadata,
 * keep only what the LLM needs to formulate a conversational response.
 */
function slimToolResult(tool: string, result: Record<string, unknown>): Record<string, unknown> {
  const data = result.data as Record<string, unknown> | undefined;
  if (!data) return result;

  // For search_resources / calendar_check: strip full resource objects, keep summaries
  if (tool === "search_resources" || tool === "calendar_check") {
    const slim = { ...result, data: { ...data } };
    const slimData = slim.data as Record<string, unknown>;

    // Slim down matches array
    if (Array.isArray(slimData.matches)) {
      slimData.matches = (slimData.matches as Record<string, unknown>[]).map((m) => {
        const res = m.resource as Record<string, unknown> | undefined;
        return {
          name: res?.name ?? "?",
          description: res?.description ?? "",
          capacity: res?.metadata ? (res.metadata as Record<string, string>).capacidad_personas : undefined,
          available: m.available,
          availableDates: m.availableDates,
          totalDatesInRange: m.totalDatesInRange,
          capacityMatch: m.capacityMatch,
          featureMatches: m.featureMatches,
          reason: m.reason,
        };
      });
    }
    // Slim down suggestions array
    if (Array.isArray(slimData.suggestions)) {
      slimData.suggestions = (slimData.suggestions as Record<string, unknown>[]).map((s) => {
        const res = s.resource as Record<string, unknown> | undefined;
        return {
          name: res?.name ?? "?",
          reason: s.reason,
        };
      });
    }
    // Slim down resources array (calendar_check range results)
    if (Array.isArray(slimData.resources)) {
      slimData.resources = (slimData.resources as Record<string, unknown>[]).map((r) => ({
        resourceName: r.resourceName,
        availableDates: r.availableDates,
        blockedDates: r.blockedDates,
      }));
    }
    return slim;
  }

  return result;
}

export async function finalizeToolWithLLM(
  toolCallId: string,
  toolFunctionName: string,
  toolArgs: Record<string, unknown>,
  toolResult: Record<string, unknown>,
  agent: AgentFormData,
  history: ChatMessage[],
  apiKey: string,
  onDecision?: OnDecisionCb
): Promise<string> {
  const systemPrompt = buildSystemPrompt(agent);
  const slimResult = slimToolResult(toolFunctionName, toolResult);

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
    // The assistant message that triggered the tool call (with tool_calls, no content)
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: toolCallId,
          type: "function",
          function: {
            name: toolFunctionName,
            arguments: JSON.stringify(toolArgs),
          },
        },
      ],
    },
    // The tool result message (slimmed down)
    {
      role: "tool",
      content: JSON.stringify(slimResult) +
        "\n[INSTRUCCIÓN: Respondé de forma concisa. Mencioná solo los datos relevantes a lo que el usuario preguntó. No listes todas las reglas/amenities a menos que el usuario lo pida específicamente.]",
      tool_call_id: toolCallId,
    },
  ];

  const t0 = Date.now();
  try {
    const result = await callOpenAIRaw(apiKey, agent.modelName, messages, {
      maxTokens: agent.maxTokens,
      temperature: agent.temperature,
    });
    const content = result.content?.trim() ?? "";
    onDecision?.({
      decisionType: "tool_finalization",
      modelName: agent.modelName,
      temperature: agent.temperature,
      promptMessages: sanitizeMessages(messages),
      responseContent: content,
      durationMs: Date.now() - t0,
      success: true,
    });
    return content;
  } catch (err) {
    onDecision?.({
      decisionType: "tool_finalization",
      modelName: agent.modelName,
      temperature: agent.temperature,
      promptMessages: sanitizeMessages(messages),
      responseContent: null,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: err instanceof Error ? err.message : "Error desconocido",
    });
    return "";
  }
}

// ─── Condition classification with LLM (hybrid mode) ─────────────────────

export interface ConditionClassificationResult {
  matchedIndex: number | null;
  confidence: number;
  reasoning: string;
}

/**
 * Ask the LLM to classify user input against condition rules.
 * Used in hybrid mode when keyword-based matching fails.
 * Returns the index of the best matching rule, or null for default.
 */
export async function classifyConditionWithLLM(
  userInput: string,
  rules: { label: string; index: number }[],
  agent: AgentFormData,
  apiKey: string,
  onDecision?: OnDecisionCb,
): Promise<ConditionClassificationResult> {
  const ruleDescriptions = rules
    .map((r) => `${r.index}: "${r.label}"`)
    .join("\n");

  const systemPrompt = `Sos un clasificador de intención para un asistente de atención al cliente.
Dado el mensaje del usuario, determiná cuál de las siguientes opciones describe mejor su intención:

${ruleDescriptions}
default: Ninguna de las anteriores

Respondé SOLO con un JSON: {"index": <número o null para default>, "confidence": <0-1>, "reasoning": "<breve explicación>"}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userInput },
  ];

  const t0 = Date.now();
  try {
    const result = await callOpenAIRaw(apiKey, agent.modelName, messages, {
      maxTokens: 150,
      temperature: 0.1,
    });

    const content = result.content ?? "";
    onDecision?.({
      decisionType: "condition_classification",
      modelName: agent.modelName,
      temperature: 0.1,
      promptMessages: sanitizeMessages(messages),
      responseContent: content,
      durationMs: Date.now() - t0,
      success: true,
    });

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { index: number | null; confidence: number; reasoning: string };
      return {
        matchedIndex: parsed.index,
        confidence: parsed.confidence ?? 0.5,
        reasoning: parsed.reasoning ?? "",
      };
    }
    return { matchedIndex: null, confidence: 0, reasoning: "No se pudo parsear la respuesta" };
  } catch {
    return { matchedIndex: null, confidence: 0, reasoning: "Error en clasificación LLM" };
  }
}
