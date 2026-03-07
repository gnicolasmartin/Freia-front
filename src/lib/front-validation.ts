/**
 * front-validation.ts
 *
 * Validates a Front before publishing.
 * Pure function — no React dependency.
 */

import type { Front } from "@/types/front";
import type { Flow } from "@/types/flow";
import type { WidgetDataBinding } from "@/types/front-widgets";

export interface FrontValidationError {
  pageId: string;
  pageTitle: string;
  sectionId: string;
  sectionLabel: string;
  field: string;
  message: string;
}

export function validateFrontForPublish(
  front: Front,
  flows: Flow[]
): FrontValidationError[] {
  const errors: FrontValidationError[] = [];

  for (const page of front.pages) {
    for (const section of page.sections) {
      const sectionLabel = section.title || section.type;

      // Chat widget: verify agentId is assigned to front
      if (section.type === "chat" && section.agentId) {
        if (!front.agentIds.includes(section.agentId)) {
          errors.push({
            pageId: page.id,
            pageTitle: page.title,
            sectionId: section.id,
            sectionLabel,
            field: "agentId",
            message: `El agente asignado ya no pertenece a este front.`,
          });
        }
      }

      // Data bindings validation
      const bindings = (section.config?._bindings as WidgetDataBinding[]) ?? [];
      for (const binding of bindings) {
        if (!binding.flowId || !binding.variableName) {
          errors.push({
            pageId: page.id,
            pageTitle: page.title,
            sectionId: section.id,
            sectionLabel,
            field: "binding",
            message: `Binding incompleto — falta flujo o variable.`,
          });
          continue;
        }

        // Flow must be assigned to front
        if (!front.flowIds.includes(binding.flowId)) {
          const flow = flows.find((f) => f.id === binding.flowId);
          errors.push({
            pageId: page.id,
            pageTitle: page.title,
            sectionId: section.id,
            sectionLabel,
            field: "binding.flowId",
            message: `El flujo "${flow?.name ?? binding.flowId}" no está asignado a este front.`,
          });
          continue;
        }

        // Variable must exist in flow
        const flow = flows.find((f) => f.id === binding.flowId);
        if (flow) {
          const variable = flow.variables.find(
            (v) => v.name === binding.variableName
          );
          if (!variable) {
            errors.push({
              pageId: page.id,
              pageTitle: page.title,
              sectionId: section.id,
              sectionLabel,
              field: "binding.variableName",
              message: `La variable "${binding.variableName}" no existe en el flujo "${flow.name}".`,
            });
            continue;
          }

          // Transform compatibility: sum/avg only on number variables
          if (
            (binding.transform === "sum" || binding.transform === "avg") &&
            variable.type !== "number"
          ) {
            errors.push({
              pageId: page.id,
              pageTitle: page.title,
              sectionId: section.id,
              sectionLabel,
              field: "binding.transform",
              message: `La transformación "${binding.transform}" requiere una variable numérica, pero "${variable.name}" es de tipo "${variable.type}".`,
            });
          }
        }
      }
    }
  }

  return errors;
}
