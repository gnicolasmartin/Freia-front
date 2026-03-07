/**
 * whatsapp-agent-check.ts
 *
 * Pure, side-effect-free module that evaluates whether an agent configured
 * for the WhatsApp channel meets all operational requirements.
 *
 * Called by AgentForm when channelScope === "whatsapp".
 * No React, no side effects — safe to call on every render.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type WACheckStatus = "ok" | "warning" | "error" | "skipped";

export interface WACheck {
  /** Unique identifier for the check */
  id: string;
  /** Short human-readable label shown in the panel header */
  label: string;
  /** Result of the check */
  status: WACheckStatus;
  /** One-line description of the result */
  message: string;
  /**
   * Ordered list of actionable steps to resolve an error or warning.
   * Shown inline when the admin expands the check row.
   */
  resolution?: string[];
}

export interface WAAgentCheckResult {
  checks: WACheck[];
  /**
   * false when at least one check has status === "error".
   * Used to gate the "Activo" status button.
   */
  canActivate: boolean;
}

export interface WACheckParams {
  /** Whether the WhatsApp channel is connected (connectionStatus === "connected") */
  isConnected: boolean;
  /** Number of templates with status === "approved" in the registry */
  approvedTemplateCount: number;
  /** True when the agent's whatsappOutbound field is enabled */
  outboundEnabled: boolean;
  /**
   * Number of active policies that apply to this channel:
   * scope === "global" OR (scope === "channel" AND channelIds includes "whatsapp")
   */
  activePolicyCount: number;
  /** True when identity.businessName is non-empty */
  hasIdentityConfigured: boolean;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Evaluate all WhatsApp readiness checks and return a structured result.
 *
 * Blocking checks (status === "error" → canActivate = false):
 *  1. channel_connected  — always evaluated
 *  2. templates_ready    — only when outboundEnabled is true
 *
 * Non-blocking checks (status === "warning" — informational):
 *  3. policies_active    — always evaluated
 *  4. identity_configured — always evaluated
 */
export function runWhatsAppAgentChecks(
  params: WACheckParams
): WAAgentCheckResult {
  const checks: WACheck[] = [];

  // ── 1. Canal conectado ────────────────────────────────────────────────────
  if (params.isConnected) {
    checks.push({
      id: "channel_connected",
      label: "Canal conectado",
      status: "ok",
      message: "Canal WhatsApp conectado y activo.",
    });
  } else {
    checks.push({
      id: "channel_connected",
      label: "Canal conectado",
      status: "error",
      message: "El canal WhatsApp no está conectado.",
      resolution: [
        "Ve a Canales en el menú lateral.",
        "Introduce las credenciales de WhatsApp Business Platform (Phone Number ID y Access Token).",
        "Haz clic en Conectar y verifica que el estado cambia a Conectado.",
      ],
    });
  }

  // ── 2. Templates aprobados (solo si outbound está habilitado) ─────────────
  if (!params.outboundEnabled) {
    checks.push({
      id: "templates_ready",
      label: "Templates aprobados",
      status: "skipped",
      message: "No requerido (outbound deshabilitado).",
    });
  } else if (params.approvedTemplateCount >= 1) {
    const t = params.approvedTemplateCount;
    checks.push({
      id: "templates_ready",
      label: "Templates aprobados",
      status: "ok",
      message: `${t} template${t === 1 ? "" : "s"} aprobado${t === 1 ? "" : "s"} disponible${t === 1 ? "" : "s"}.`,
    });
  } else {
    checks.push({
      id: "templates_ready",
      label: "Templates aprobados",
      status: "error",
      message:
        "No hay templates aprobados. Son obligatorios para mensajes outbound.",
      resolution: [
        "Ve a Canales → panel de WhatsApp → sección Plantillas.",
        "Crea al menos un template de categoría UTILITY o MARKETING.",
        "Espera la aprobación de Meta (simulada automáticamente en el entorno de pruebas).",
      ],
    });
  }

  // ── 3. Políticas activas ──────────────────────────────────────────────────
  if (params.activePolicyCount >= 1) {
    const p = params.activePolicyCount;
    checks.push({
      id: "policies_active",
      label: "Políticas activas",
      status: "ok",
      message: `${p} política${p === 1 ? "" : "s"} activa${p === 1 ? "" : "s"} cubre${p === 1 ? "" : "n"} este canal.`,
    });
  } else {
    checks.push({
      id: "policies_active",
      label: "Políticas activas",
      status: "warning",
      message:
        "Ninguna política activa cubre este canal. El agente operará sin restricciones de contenido.",
      resolution: [
        "Ve a Políticas en el menú lateral.",
        "Crea o activa una política con alcance Global o Canal=WhatsApp.",
        "Selecciona el modo de enforcement (Estricto recomendado para producción).",
      ],
    });
  }

  // ── 4. Identidad del canal ────────────────────────────────────────────────
  if (params.hasIdentityConfigured) {
    checks.push({
      id: "identity_configured",
      label: "Identidad configurada",
      status: "ok",
      message: "El canal tiene nombre de negocio y estilo definidos.",
    });
  } else {
    checks.push({
      id: "identity_configured",
      label: "Identidad configurada",
      status: "warning",
      message:
        "Sin nombre de negocio — los mensajes no incluirán firma de marca.",
      resolution: [
        "Ve a Canales → panel de WhatsApp → Identidad del canal.",
        "Define el nombre del negocio y la firma (opcional).",
        "Guarda los cambios.",
      ],
    });
  }

  const canActivate = !checks.some((c) => c.status === "error");

  return { checks, canActivate };
}
