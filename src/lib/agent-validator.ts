/**
 * agent-validator.ts
 *
 * Pure validation module for AgentFormData.
 * No React, no side effects — safe to call from anywhere.
 *
 * Returns two categories:
 *  - errors:   blocking issues that prevent saving / activating the agent
 *  - warnings: non-blocking issues that signal incomplete or risky configuration
 */

import type { AgentFormData, AgentStatus } from "@/types/agent";
import type { Flow } from "@/types/flow";
import type { Policy } from "@/types/policy";

// --- Public types ---

export interface ValidationIssue {
  /** Logical field or area this issue relates to */
  field?: string;
  message: string;
}

export interface AgentValidationResult {
  /** Blocking issues — prevent saving when present */
  errors: ValidationIssue[];
  /** Non-blocking issues — shown as warnings but don't block save */
  warnings: ValidationIssue[];
  /** true iff errors is empty */
  isValid: boolean;
}

export interface AgentValidationContext {
  flows: Flow[];
  isApiKeyConfigured: boolean;
  /** All policies in the system — used to check ai-guided strict-policy coverage */
  policies?: Policy[];
}

// --- Validator ---

/**
 * Validate an agent's form data against the current system context.
 *
 * Blocking errors:
 *  1. No associated flow
 *  2. No model configured
 *  3. No valid API Key (only enforced when trying to activate)
 *  4. Associated flow has no published version (only enforced when trying to activate)
 *
 * Warnings (non-blocking):
 *  1. No KPI defined
 *  2. No primary objective set
 *  3. Mode = ai-guided without any active strict policy
 */
export function validateAgent(
  formData: AgentFormData,
  ctx: AgentValidationContext
): AgentValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const isActivating: boolean = formData.status === ("active" as AgentStatus);

  // ── Blocking errors ──────────────────────────────────────────────────────

  // 1. No flow associated
  if (!formData.flowId) {
    errors.push({
      field: "flowId",
      message: "El agente debe tener un flujo asociado.",
    });
  }

  // 2. No model configured
  if (!formData.modelName.trim()) {
    errors.push({
      field: "modelName",
      message: "Debe seleccionar un modelo de lenguaje.",
    });
  }

  // 3. No valid API Key — only blocking when activating
  if (isActivating && !ctx.isApiKeyConfigured) {
    errors.push({
      field: "apiKey",
      message:
        "No hay API Key de OpenAI configurada. " +
        "Ve a Configuraciones para agregar tu clave.",
    });
  }

  // 4. Flow in Draft state — only blocking when activating
  if (isActivating && formData.flowId) {
    const flow = ctx.flows.find((f) => f.id === formData.flowId);
    if (flow && !flow.publishedVersionId) {
      errors.push({
        field: "flowId",
        message:
          `El flujo "${flow.name}" no tiene versión publicada. ` +
          "Publica el flujo antes de activar el agente.",
      });
    }
  }

  // ── Warnings ─────────────────────────────────────────────────────────────

  // 1. No KPI defined
  if (!formData.kpiType) {
    warnings.push({
      field: "kpiType",
      message:
        "Sin KPI definido. Será difícil medir el rendimiento del agente.",
    });
  }

  // 2. No primary objective
  if (!formData.primaryObjective) {
    warnings.push({
      field: "primaryObjective",
      message:
        "Sin objetivo claro. Define el propósito principal del agente para " +
        "que el sistema prompt sea más efectivo.",
    });
  }

  // 3. AI-guided mode without any active strict policy
  if (formData.mode === "ai-guided") {
    const hasStrictPolicy =
      ctx.policies?.some(
        (p) => p.active && p.enforcementMode === "strict"
      ) ?? false;
    if (!hasStrictPolicy) {
      warnings.push({
        field: "mode",
        message:
          "Modo AI-guided sin policies estrictas activas. " +
          "El agente podría actuar fuera de los límites esperados. " +
          "Considera activar al menos una política con enforcement estricto.",
      });
    }
  }

  return { errors, warnings, isValid: errors.length === 0 };
}
