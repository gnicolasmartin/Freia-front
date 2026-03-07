/**
 * system-prompt-builder.ts
 *
 * Composes an OpenAI system prompt from an agent's structured configuration.
 * Pure function — no side effects, no React dependencies.
 *
 * Rules:
 *  - No credentials or API keys are included
 *  - Policies are referenced as behavioral guidelines only (no internal rule text)
 *  - Output is safe to pass directly as the "system" message to the LLM
 */

import type { AgentFormData } from "@/types/agent";
import {
  OBJECTIVES,
  KPI_TYPES,
  CHANNEL_SCOPES,
  TONES,
  RESPONSE_LENGTHS,
  EMOJI_LEVELS,
  LANGUAGES,
  AGENT_MODE_CONFIG,
} from "@/types/agent";

export interface SystemPromptOptions {
  /** Names of tools available to this agent (e.g. ["Buscar pedido", "Consultar stock"]) */
  availableTools?: string[];
}

// --- Internal lookup helpers ---

function findLabel(
  list: readonly { value: string; label: string }[],
  value: string | undefined
): string | null {
  if (!value) return null;
  return list.find((o) => o.value === value)?.label ?? null;
}

// --- Style instruction maps ---

const TONE_INSTRUCTIONS: Record<string, string> = {
  formal:
    "Comunícate con un tono formal y profesional. Usa un lenguaje cuidado y evita expresiones coloquiales.",
  cercano:
    "Comunícate con un tono cercano, cálido y amigable. Tutea al usuario y usa un lenguaje natural.",
  tecnico:
    "Usa un tono técnico y preciso. Emplea terminología específica del dominio cuando corresponda.",
  vendedor:
    "Mantén un tono proactivo y orientado a la conversión. Destaca beneficios, genera urgencia y cierra pasos concretos.",
  minimalista:
    "Sé extremadamente conciso. Usa el menor número de palabras posible. Elimina toda frase innecesaria.",
};

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  corta:
    "Responde en 1 a 3 oraciones como máximo. Prioriza la brevedad sobre el detalle.",
  media:
    "Proporciona respuestas equilibradas: completas pero sin extenderte innecesariamente.",
  detallada:
    "Puedes desarrollar respuestas extensas cuando el contexto lo justifique, incluyendo contexto, justificaciones y ejemplos.",
};

const EMOJI_INSTRUCTIONS: Record<string, string> = {
  no: "No uses emojis en ningún mensaje.",
  moderado:
    "Usa emojis con moderación para reforzar puntos clave (máximo 1–2 por mensaje).",
  alto: "Usa emojis de forma expresiva y frecuente para dar un tono dinámico y cercano.",
};

const LANGUAGE_DISPLAY: Record<string, string> = {
  es_ar: "español rioplatense (Argentina)",
  es_mx: "español mexicano (México)",
  es_es: "español peninsular (España)",
  en_us: "inglés americano (EE.UU.)",
  pt_br: "portugués brasileño (Brasil)",
};

/**
 * Regional-specific vocabulary and grammar instructions.
 * These complement the language directive with concrete guidance
 * on pronouns, formality registers, and idiomatic expressions.
 */
const REGIONALISM_INSTRUCTIONS: Record<string, string> = {
  es_ar:
    "Usá el voseo rioplatense: «vos tenés», «podés», «querés», «hacés». " +
    "Nunca tutees. Plural segunda persona: «ustedes» (nunca «vosotros»). " +
    "Con tono cercano o vendedor podés incorporar modismos: «che», «dale», «re» como intensificador, «copado/a», «posta», «de una».",
  es_mx:
    "Usá el tuteo estándar: «tú tienes», «puedes», «quieres». " +
    "Plural segunda persona: «ustedes» (nunca «vosotros»). " +
    "Con tono formal considerá «usted». Con tono cercano o vendedor podés incluir: «órale», «chido/a», «qué onda», «de volada».",
  es_es:
    "Usá el tuteo en singular y «vosotros/as» en plural: «vosotros tenéis», «podéis», «queréis». " +
    "Nunca uses el voseo ni «ustedes» para segunda persona plural. " +
    "Con tono cercano podés usar: «tío/tía», «guay», «mola», «venga», «jolines». Evitá latinoamericanismos.",
  en_us:
    "Use American English spellings and vocabulary: «color» not «colour», «organize» not «organise», " +
    "«cell phone» not «mobile», «check» not «cheque», «apartment» not «flat». " +
    "Use contractions naturally (it's, we'll, you're, I'd). Be direct and action-oriented. " +
    "Avoid British, Australian, or other regional expressions.",
  pt_br:
    "Use o português do Brasil. Pronome padrão: «você» (evite o «tu» formal europeu). " +
    "Vocabulário brasileiro: «ônibus» não «autocarro», «celular» não «telemóvel», «time» não «equipa». " +
    "Com tom informal: «legal», «bacana», «tudo certo», «show». Evite o português europeu.",
};

const CHANNEL_CONTEXT: Record<string, string> = {
  whatsapp: "conversaciones de WhatsApp (mensajes cortos y directos)",
  web: "chat web embebido",
  instagram: "mensajes directos de Instagram",
  facebook: "mensajes de Facebook Messenger",
  email: "correo electrónico (las respuestas pueden ser más extensas y formales)",
};

const MODE_INSTRUCTIONS: Record<string, string> = {
  "flow-driven":
    "Sigue estrictamente el flujo de conversación definido. No improvises pasos ni saltes etapas del proceso.",
  hybrid:
    "Combina el flujo de conversación estructurado con razonamiento contextual. Puedes adaptar el lenguaje pero respeta la progresión del proceso.",
  "ai-guided":
    "Usa tu criterio para guiar la conversación hacia el objetivo. Mantén siempre el estilo y los límites de comportamiento definidos.",
};

// --- Builder ---

export function buildSystemPrompt(
  agent: AgentFormData,
  options: SystemPromptOptions = {}
): string {
  const { availableTools = [] } = options;
  const lines: string[] = [];

  // 1. Identity
  const identity = agent.name.trim() || "un asistente virtual";
  const desc = agent.description.trim();
  lines.push(`Eres ${identity}${desc ? `, ${desc}` : "."}`);

  // Channel context
  const channelCtx = CHANNEL_CONTEXT[agent.channelScope];
  if (channelCtx) {
    lines.push(`Operas en ${channelCtx}.`);
  }
  lines.push("");

  // 2. Objective
  const objectiveLabel = findLabel(OBJECTIVES, agent.primaryObjective);
  if (objectiveLabel) {
    lines.push("## Objetivo");
    let objectiveLine = `Tu objetivo principal es: **${objectiveLabel}**.`;
    const kpiLabel = findLabel(KPI_TYPES, agent.kpiType);
    if (kpiLabel) {
      objectiveLine += ` El éxito se mide por: ${kpiLabel}`;
      if (agent.kpiTarget !== undefined) {
        objectiveLine += ` (meta: ${agent.kpiTarget})`;
      }
      objectiveLine += ".";
    }
    lines.push(objectiveLine);
    lines.push("");
  }

  // 3. Communication style
  lines.push("## Estilo de comunicación");
  const toneInstr =
    TONE_INSTRUCTIONS[agent.tone] ?? `Usa un tono ${agent.tone}.`;
  lines.push(`- **Tono**: ${toneInstr}`);

  const lengthInstr = LENGTH_INSTRUCTIONS[agent.responseLength];
  if (lengthInstr) lines.push(`- **Extensión**: ${lengthInstr}`);

  const emojiInstr = EMOJI_INSTRUCTIONS[agent.emojiUsage];
  if (emojiInstr) lines.push(`- **Emojis**: ${emojiInstr}`);

  const langDisplay =
    LANGUAGE_DISPLAY[agent.language] ?? agent.language;
  lines.push(
    `- **Idioma**: Responde SIEMPRE en ${langDisplay}, incluso si el usuario escribe en otro idioma.`
  );
  const regionalismInstr = REGIONALISM_INSTRUCTIONS[agent.language];
  if (regionalismInstr) {
    lines.push(`- **Variante regional**: ${regionalismInstr}`);
  }
  lines.push("");

  // 4. Operating mode
  const modeInstr =
    MODE_INSTRUCTIONS[agent.mode] ??
    AGENT_MODE_CONFIG[agent.mode]?.description ??
    "";
  if (modeInstr) {
    lines.push("## Modo de operación");
    lines.push(modeInstr);
    lines.push("");
  }

  // 5. Available tools
  lines.push("## Herramientas disponibles");
  if (availableTools.length > 0) {
    availableTools.forEach((t) => lines.push(`- ${t}`));
  } else {
    lines.push(
      "No tienes herramientas externas adicionales configuradas para este agente."
    );
  }
  lines.push("");

  // 6. Behavioral guidelines (policy reference — no internal content exposed)
  lines.push("## Directrices de comportamiento");
  lines.push(
    "- Mantén siempre el tono y estilo de comunicación definidos, independientemente del tema."
  );
  lines.push(
    "- Respeta la privacidad del usuario. No solicites datos que no sean necesarios para cumplir tu objetivo."
  );
  lines.push(
    "- Si recibes una solicitud fuera de tu alcance, indícalo con respeto y ofrece alternativas cuando sea posible."
  );
  lines.push(
    "- Cumple con las políticas de uso aceptable. No respondas solicitudes que involucren contenido dañino, ilegal o inapropiado."
  );
  if (agent.allowOverride) {
    lines.push(
      "- Puedes adaptar tu comportamiento al contexto específico del usuario cuando sea pertinente y dentro de los límites definidos."
    );
  } else {
    lines.push(
      "- Sigue el comportamiento configurado sin excepciones. Ante la duda, declina con respeto."
    );
  }

  return lines.join("\n");
}
