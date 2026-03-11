/**
 * message-processor.ts
 *
 * Pure orchestration logic for processing inbound WhatsApp messages.
 * No React dependency — receives all data as parameters.
 *
 * Flow:
 *   1. Extract text from inbound event
 *   2. Check for existing active conversation for this contact
 *   3. If none → resolve route → find agent → find flow
 *   4. Init or resume simulation
 *   5. Step through flow nodes collecting bot responses
 *   6. Send responses via WhatsApp API
 */

import type { MessageReceivedEvent } from "@/types/webhook-event";
import type { RoutingConfig, RoutingDecision, InboundMessageContext } from "@/types/routing";
import type { Agent } from "@/types/agent";
import type { Flow, FlowNode, FlowEdge, FlowVariable } from "@/types/flow";
import type { Policy } from "@/types/policy";
import type { ToolDefinition } from "@/types/tool-registry";
import type { SimulationState, SimulationOptions } from "./flow-simulator";
import { initSimulation, stepSimulation } from "./flow-simulator";
import { resolveRoute } from "./whatsapp-router";
import { getBusinessHoursConfig } from "./business-hours";
import { recordUserMessageInWindow } from "./conversation-window";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActiveConversation {
  contactPhone: string;
  contactName?: string;
  agentId: string;
  agentName: string;
  flowId: string;
  simulationState: SimulationState;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariable[];
  simulationOptions: SimulationOptions;
  startedAt: string;
  lastActivityAt: string;
}

export interface WACredentials {
  phoneNumberId: string;
  accessToken: string;
  /** Multi-tenant: company that owns these credentials. */
  companyId?: string;
}

/** Signature for a send function (injectable for server-side processing). */
export type SendMessageFn = (
  to: string,
  text: string,
  credentials: WACredentials | null,
  testMode: boolean,
  interactive?: InteractivePayload
) => Promise<{ success: boolean; messageId?: string; error?: string }>;

export interface ProcessMessageInput {
  event: MessageReceivedEvent;
  activeConversations: Map<string, ActiveConversation>;
  routingConfig: RoutingConfig;
  agents: Agent[];
  flows: Flow[];
  policies: Policy[];
  tools: ToolDefinition[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: Record<string, any>[];
  openaiApiKey?: string;
  waCredentials: WACredentials | null;
  testMode: boolean;
  /**
   * Override the default browser-based send function.
   * Server-side callers inject a direct WhatsApp API sender.
   */
  sendFn?: SendMessageFn;
  /**
   * Business hours config. If not provided, reads from localStorage
   * (which returns defaults on the server where localStorage is unavailable).
   */
  businessHoursConfig?: import("@/types/business-hours").BusinessHoursConfig;
}

export interface ProcessMessageResult {
  success: boolean;
  agentId?: string;
  flowId?: string;
  agentName?: string;
  responseTexts: string[];
  routingDecision?: RoutingDecision;
  updatedConversation?: ActiveConversation;
  conversationEnded?: boolean;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts the user-facing text from an inbound event.
 * For interactive replies (button/list clicks), extracts the button id
 * so we can resolve it against the waiting options.
 */
function extractTextFromEvent(event: MessageReceivedEvent): string {
  const { content } = event;
  switch (content.type) {
    case "text":
      return content.text ?? "";
    case "interactive":
    case "button": {
      // interactivePayload is JSON like {"id":"opt_0","title":"..."} for button/list replies
      const raw = content.interactivePayload;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { id?: string; title?: string };
          // Return the button id (e.g. "opt_0") which we'll resolve to the option value
          if (parsed.id) return parsed.id;
          if (parsed.title) return parsed.title;
        } catch {
          // Not JSON — use as-is (e.g. plain button payload)
          return raw;
        }
      }
      return content.text ?? "";
    }
    case "location":
      return `Ubicación: ${content.latitude}, ${content.longitude}`;
    case "image":
    case "audio":
    case "video":
    case "document":
    case "sticker":
      return `[${content.type}]`;
    case "reaction":
      return content.text ?? "";
    default:
      return "";
  }
}

function getFlowData(flow: Flow): { nodes: FlowNode[]; edges: FlowEdge[]; variables: FlowVariable[] } | null {
  // Prefer published version
  if (flow.publishedVersionId) {
    const version = (flow.versions ?? []).find((v) => v.id === flow.publishedVersionId);
    if (version) {
      return {
        nodes: version.nodes,
        edges: version.edges,
        variables: version.variables ?? [],
      };
    }
  }
  // Fallback to draft
  if (flow.nodes && flow.nodes.length > 0) {
    return {
      nodes: flow.nodes,
      edges: flow.edges,
      variables: flow.variables ?? [],
    };
  }
  return null;
}

interface InteractivePayload {
  type: "buttons" | "list";
  buttons?: Array<{ id: string; title: string }>;
  buttonTitle?: string;
  rows?: Array<{ id: string; title: string; description?: string }>;
}

/**
 * Normalize Argentine phone numbers for the WhatsApp Cloud API.
 * Inbound messages arrive with the "9" (e.g. 5491160527827),
 * but outbound sends require it without the "9" (e.g. 541160527827).
 */
function normalizePhoneForSend(phone: string): string {
  // Argentine mobile: 549XXXXXXXXXX → 54XXXXXXXXXX
  if (phone.startsWith("549") && phone.length === 13) {
    return "54" + phone.slice(3);
  }
  return phone;
}

async function sendWhatsAppMessage(
  to: string,
  text: string,
  credentials: WACredentials | null,
  testMode: boolean,
  interactive?: InteractivePayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const normalizedTo = normalizePhoneForSend(to);

  if (testMode) {
    console.info(`[MessageProcessor] TEST MODE — would send to ${normalizedTo}: "${text.slice(0, 80)}..." interactive=${interactive?.type ?? "none"}`);
    return { success: true, messageId: `wamid.test.${Date.now()}` };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = { to: normalizedTo, text };
    if (credentials) {
      body.phoneNumberId = credentials.phoneNumberId;
      body.accessToken = credentials.accessToken;
      if (credentials.companyId) body.companyId = credentials.companyId;
    }
    if (interactive) {
      body.interactive = interactive;
    }

    const res = await fetch("/api/channels/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      return { success: false, error: (err as { error?: string }).error ?? `HTTP ${res.status}` };
    }

    const data = (await res.json()) as { messageId?: string };
    return { success: true, messageId: data.messageId };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Builds an InteractivePayload from simulation waitingForInput state.
 */
function buildInteractivePayload(
  waitingForInput: NonNullable<SimulationState["waitingForInput"]>
): InteractivePayload | undefined {
  if (waitingForInput.responseType !== "interactive" || !waitingForInput.options?.length) {
    return undefined;
  }

  const options = waitingForInput.options;

  if (waitingForInput.interactiveType === "buttons" && options.length <= 3) {
    return {
      type: "buttons",
      buttons: options.map((o, i) => ({
        id: `opt_${i}`,
        title: o.label,
      })),
    };
  }

  // List for >3 options or explicit list type
  return {
    type: "list",
    buttonTitle: "Ver opciones",
    rows: options.map((o, i) => ({
      id: `opt_${i}`,
      title: o.label,
    })),
  };
}

// ─── Max steps guard ─────────────────────────────────────────────────────────

const MAX_STEPS_PER_MESSAGE = 50;

// ─── Main processor ──────────────────────────────────────────────────────────

export async function processInboundMessage(
  input: ProcessMessageInput
): Promise<ProcessMessageResult> {
  const {
    event,
    activeConversations,
    routingConfig,
    agents,
    flows,
    policies,
    tools,
    products,
    openaiApiKey,
    waCredentials,
    testMode,
    sendFn: customSendFn,
    businessHoursConfig: customBHConfig,
  } = input;

  const send: SendMessageFn = customSendFn ?? sendWhatsAppMessage;

  const contactPhone = event.from;
  const messageText = extractTextFromEvent(event);

  if (!messageText.trim()) {
    return { success: false, error: "Empty message text", responseTexts: [] };
  }

  console.info(`[MessageProcessor] Inbound from ${contactPhone}: "${messageText.slice(0, 100)}"`);

  // Record inbound message to keep the 24h conversation window open
  try { recordUserMessageInWindow(contactPhone); } catch { /* localStorage unavailable */ }

  // ── 1. Check for existing active conversation ──────────────────────────────

  const existing = activeConversations.get(contactPhone);
  if (existing && existing.simulationState.status === "waiting_input") {
    // Resolve interactive button/list replies to the actual option value
    let resolvedInput = messageText;
    const waiting = existing.simulationState.waitingForInput;
    if (waiting?.responseType === "interactive" && waiting.options?.length) {
      // WhatsApp sends button id (e.g. "opt_0") or the button title text
      const optMatch = messageText.match(/^opt_(\d+)$/);
      if (optMatch) {
        const idx = parseInt(optMatch[1], 10);
        if (idx >= 0 && idx < waiting.options.length) {
          resolvedInput = waiting.options[idx].value;
        }
      } else {
        // Match by label (user might have typed the exact button text)
        const byLabel = waiting.options.find(
          (o) => o.label.toLowerCase() === messageText.toLowerCase()
        );
        if (byLabel) resolvedInput = byLabel.value;
      }
    }

    console.info(`[MessageProcessor] Resuming conversation for ${contactPhone} (agent: ${existing.agentName}), input: "${resolvedInput}"`);
    return resumeConversation(existing, resolvedInput, waCredentials, testMode, send);
  }

  // ── 2. Route to agent ──────────────────────────────────────────────────────

  const bhConfig = customBHConfig ?? getBusinessHoursConfig();
  const msgContext: InboundMessageContext = {
    from: contactPhone,
    phoneNumberId: event.phoneNumberId,
    text: messageText,
  };

  const decision = resolveRoute(msgContext, routingConfig, agents, bhConfig);

  console.info(
    `[MessageProcessor] Routing decision: agent=${decision.agentId ?? "none"}, reason=${decision.reasonCode}`
  );

  if (!decision.agentId || !decision.flowId) {
    return {
      success: false,
      routingDecision: decision,
      error: "No agent/flow configured for this message",
      responseTexts: [],
    };
  }

  // ── 3. Find agent and flow ─────────────────────────────────────────────────

  const agent = agents.find((a) => a.id === decision.agentId);
  if (!agent) {
    return {
      success: false,
      routingDecision: decision,
      error: `Agent ${decision.agentId} not found`,
      responseTexts: [],
    };
  }

  const flow = flows.find((f) => f.id === decision.flowId);
  if (!flow) {
    return {
      success: false,
      routingDecision: decision,
      error: `Flow ${decision.flowId} not found`,
      responseTexts: [],
    };
  }

  const flowData = getFlowData(flow);
  if (!flowData) {
    return {
      success: false,
      routingDecision: decision,
      error: `Flow "${flow.name}" has no nodes`,
      responseTexts: [],
    };
  }

  // ── 4. Build simulation options ────────────────────────────────────────────

  const simOptions: SimulationOptions = {
    products: products.length > 0 ? products : undefined,
  };

  // Attach agent for LLM-powered message generation
  if (openaiApiKey && agent) {
    simOptions.agent = agent;
    simOptions.agentApiKey = openaiApiKey;
  }

  // Attach policies
  const flowPolicies = (flow.policyIds ?? [])
    .map((pid) => policies.find((p) => p.id === pid))
    .filter((p): p is Policy => !!p && p.active);

  if (flowPolicies.length > 0) {
    simOptions.responsePolicies = flowPolicies;
    simOptions.escalationPolicies = flowPolicies;
    simOptions.inputClassificationPolicies = flowPolicies;
  }

  // Attach tools
  if (tools.length > 0) {
    simOptions.toolDefinitions = tools;
    const schemas: Record<string, import("@/types/flow").ToolParamDef[]> = {};
    for (const t of tools) {
      schemas[t.id] = t.inputSchema;
    }
    simOptions.toolSchemas = schemas;
    if (flow.allowedToolIds && flow.allowedToolIds.length > 0) {
      simOptions.allowedToolIds = flow.allowedToolIds;
    }
  }

  // ── 5. Initialize simulation ───────────────────────────────────────────────

  const initialVars: Record<string, unknown> = {
    "contact.phone": contactPhone,
    "contact.name": event.contactName ?? "",
    "message.text": messageText,
    "message.timestamp": event.timestamp,
  };

  let simState = initSimulation(
    flowData.nodes,
    flowData.edges,
    flowData.variables,
    initialVars
  );

  // ── 6. Step through flow collecting bot messages ───────────────────────────

  const responseTexts: string[] = [];
  let steps = 0;

  while (simState.status === "running" && steps < MAX_STEPS_PER_MESSAGE) {
    const prevMsgCount = simState.messages.length;
    simState = await stepSimulation(
      simState,
      flowData.nodes,
      flowData.edges,
      flowData.variables,
      undefined, // no user input yet — first pass
      simOptions
    );
    steps++;

    // Collect new bot messages
    const newMessages = simState.messages.slice(prevMsgCount);
    for (const msg of newMessages) {
      if (msg.type === "bot" && msg.content) {
        responseTexts.push(msg.content);
      }
    }
  }

  // If the simulation is waiting for input (ask node), this is normal for
  // the first message — the flow asked a question. The responses collected
  // above are the bot's initial messages/questions.

  console.info(
    `[MessageProcessor] Flow executed: ${steps} steps, ${responseTexts.length} responses, status=${simState.status}`
  );

  // ── 7. Send responses via WhatsApp ─────────────────────────────────────────

  // Build interactive payload if the simulation is waiting for user selection
  const interactivePayload =
    simState.status === "waiting_input" && simState.waitingForInput
      ? buildInteractivePayload(simState.waitingForInput)
      : undefined;

  for (let i = 0; i < responseTexts.length; i++) {
    const text = responseTexts[i];
    // Attach interactive buttons/list to the LAST message only
    const isLast = i === responseTexts.length - 1;
    const interactive = isLast ? interactivePayload : undefined;

    const sendResult = await send(contactPhone, text, waCredentials, testMode, interactive);
    if (!sendResult.success) {
      console.error(`[MessageProcessor] Failed to send: ${sendResult.error}`);
    } else {
      console.info(`[MessageProcessor] Sent to ${contactPhone}: ${sendResult.messageId} (interactive=${interactive?.type ?? "none"})`);
    }
  }

  // ── 8. Build active conversation ───────────────────────────────────────────

  const now = new Date().toISOString();
  const conversationEnded = simState.status === "completed" || simState.status === "error";

  const updatedConversation: ActiveConversation | undefined = conversationEnded
    ? undefined
    : {
        contactPhone,
        contactName: event.contactName,
        agentId: agent.id,
        agentName: agent.name,
        flowId: flow.id,
        simulationState: simState,
        nodes: flowData.nodes,
        edges: flowData.edges,
        variables: flowData.variables,
        simulationOptions: simOptions,
        startedAt: now,
        lastActivityAt: now,
      };

  return {
    success: true,
    agentId: agent.id,
    flowId: flow.id,
    agentName: agent.name,
    responseTexts,
    routingDecision: decision,
    updatedConversation,
    conversationEnded,
  };
}

// ─── Resume existing conversation ────────────────────────────────────────────

async function resumeConversation(
  conversation: ActiveConversation,
  userInput: string,
  waCredentials: WACredentials | null,
  testMode: boolean,
  send: SendMessageFn = sendWhatsAppMessage
): Promise<ProcessMessageResult> {
  const { nodes, edges, variables, simulationOptions, agentId, agentName, flowId } = conversation;

  let simState = conversation.simulationState;
  const responseTexts: string[] = [];
  let steps = 0;

  // First step with user input (answers the waiting ask/interactive node)
  const prevMsgCount = simState.messages.length;
  simState = await stepSimulation(simState, nodes, edges, variables, userInput, simulationOptions);
  steps++;

  // Collect bot messages from this step
  let newMessages = simState.messages.slice(prevMsgCount);
  for (const msg of newMessages) {
    if (msg.type === "bot" && msg.content) {
      responseTexts.push(msg.content);
    }
  }

  // Continue stepping through auto-advance nodes (message, condition, etc.)
  while (simState.status === "running" && steps < MAX_STEPS_PER_MESSAGE) {
    const prevCount = simState.messages.length;
    simState = await stepSimulation(simState, nodes, edges, variables, undefined, simulationOptions);
    steps++;

    newMessages = simState.messages.slice(prevCount);
    for (const msg of newMessages) {
      if (msg.type === "bot" && msg.content) {
        responseTexts.push(msg.content);
      }
    }
  }

  console.info(
    `[MessageProcessor] Resumed: ${steps} steps, ${responseTexts.length} responses, status=${simState.status}`
  );

  // Send responses (with interactive payload on last message if applicable)
  const resumeInteractive =
    simState.status === "waiting_input" && simState.waitingForInput
      ? buildInteractivePayload(simState.waitingForInput)
      : undefined;

  for (let i = 0; i < responseTexts.length; i++) {
    const text = responseTexts[i];
    const isLast = i === responseTexts.length - 1;
    const interactive = isLast ? resumeInteractive : undefined;

    const sendResult = await send(conversation.contactPhone, text, waCredentials, testMode, interactive);
    if (!sendResult.success) {
      console.error(`[MessageProcessor] Failed to send: ${sendResult.error}`);
    }
  }

  const conversationEnded = simState.status === "completed" || simState.status === "error";
  const now = new Date().toISOString();

  const updatedConversation: ActiveConversation | undefined = conversationEnded
    ? undefined
    : {
        ...conversation,
        simulationState: simState,
        lastActivityAt: now,
      };

  return {
    success: true,
    agentId,
    flowId,
    agentName,
    responseTexts,
    updatedConversation,
    conversationEnded,
  };
}
