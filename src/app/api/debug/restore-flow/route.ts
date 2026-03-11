/**
 * POST /api/debug/restore-flow
 *
 * Restores the original toolcall nodes in the synced config blob.
 * The browser modified them to message nodes with static text.
 * This patches only the affected nodes without touching anything else.
 */

import { NextResponse } from "next/server";

const API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// Original toolcall node definitions from seed-demo-rincon.ts
const ORIGINAL_NODES: Record<string, { type: string; data: Record<string, unknown> }> = {
  n_check_calendar: {
    type: "toolcall",
    data: {
      label: "Consultar disponibilidad",
      tool: "calendar_check",
      parameterMapping: [
        { id: "p1", paramName: "calendarId", variableName: "" },
        { id: "p2", paramName: "startDate", variableName: "" },
        { id: "p3", paramName: "endDate", variableName: "" },
        { id: "p4", paramName: "resourceId", variableName: "" },
      ],
    },
  },
  n_search_resources: {
    type: "toolcall",
    data: {
      label: "Buscar quinta",
      tool: "search_resources",
      parameterMapping: [
        { id: "p5", paramName: "calendarId", variableName: "" },
        { id: "p6", paramName: "query", variableName: "consulta_cliente" },
        { id: "p7", paramName: "minCapacity", variableName: "" },
        { id: "p8", paramName: "startDate", variableName: "" },
        { id: "p9", paramName: "endDate", variableName: "" },
        { id: "p10", paramName: "requiredFeatures", variableName: "" },
      ],
    },
  },
  n_reservar: {
    type: "toolcall",
    data: {
      label: "Crear reserva",
      tool: "create_booking",
      parameterMapping: [
        { id: "p11", paramName: "calendarId", variableName: "" },
        { id: "p12", paramName: "resourceId", variableName: "" },
        { id: "p13", paramName: "date", variableName: "" },
        { id: "p14", paramName: "endDate", variableName: "" },
        { id: "p15", paramName: "contactName", variableName: "" },
        { id: "p16", paramName: "notes", variableName: "" },
      ],
    },
  },
  n_reservar_2: {
    type: "toolcall",
    data: {
      label: "Crear reserva (2)",
      tool: "create_booking",
      parameterMapping: [
        { id: "p17", paramName: "calendarId", variableName: "" },
        { id: "p18", paramName: "resourceId", variableName: "" },
        { id: "p19", paramName: "date", variableName: "" },
        { id: "p20", paramName: "endDate", variableName: "" },
        { id: "p21", paramName: "contactName", variableName: "" },
        { id: "p22", paramName: "notes", variableName: "" },
      ],
    },
  },
  // Also restore n_ask_seguir to empty message (was changed to have static text)
  n_ask_seguir: {
    type: "ask",
    data: {
      label: "¿Seguimos?",
      message: "",
      responseType: "text",
      variable: "consulta_cliente",
      maxRetries: 2,
      retryMessage: "Podés hacerme otra consulta, decir \"reservar\" para coordinar una reserva, o \"no\" si eso es todo.",
    },
  },
};

export async function POST(): Promise<Response> {
  const companyIdsToTry = ["company_rincon", process.env.FREIA_COMPANY_ID ?? "default", "default"];
  const seen = new Set<string>();
  const results: Record<string, unknown> = {};

  for (const tryId of companyIdsToTry) {
    if (seen.has(tryId)) continue;
    seen.add(tryId);

    try {
      // Fetch current config
      const configRes = await fetch(
        `${API_URL}/processing-config/${encodeURIComponent(tryId)}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!configRes.ok) continue;

      const configData = (await configRes.json()) as { config: Record<string, unknown> | null };
      if (!configData.config) continue;

      const blob = configData.config;
      const flows = blob.flows as Array<{
        id: string;
        name: string;
        nodes: Array<{ id: string; type: string; position: unknown; data: Record<string, unknown> }>;
        [key: string]: unknown;
      }>;

      if (!flows || flows.length === 0) {
        results[tryId] = { error: "No flows found" };
        continue;
      }

      // Patch each flow
      let patched = 0;
      const patchDetails: string[] = [];

      for (const flow of flows) {
        for (const node of flow.nodes) {
          const original = ORIGINAL_NODES[node.id];
          if (!original) continue;

          const wasType = node.type;
          node.type = original.type;
          node.data = { ...original.data };

          patchDetails.push(`${node.id}: ${wasType} → ${original.type}`);
          patched++;
        }
      }

      if (patched === 0) {
        results[tryId] = { message: "No nodes needed patching" };
        continue;
      }

      // Save updated config
      blob.flows = flows;

      const saveRes = await fetch(
        `${API_URL}/processing-config/${encodeURIComponent(tryId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: blob }),
          signal: AbortSignal.timeout(10_000),
        }
      );

      results[tryId] = {
        saved: saveRes.ok,
        patchedNodes: patched,
        details: patchDetails,
      };
    } catch (err) {
      results[tryId] = { error: String(err) };
    }
  }

  // Also clear any active conversations so stale state doesn't interfere
  for (const tryId of seen) {
    try {
      await fetch(
        `${API_URL}/conversations/active/${encodeURIComponent(tryId)}`,
        { method: "DELETE", signal: AbortSignal.timeout(5_000) }
      );
      results[`${tryId}_conversations`] = "cleared";
    } catch {
      // Best effort
    }
  }

  return NextResponse.json({ message: "Flow restoration complete", results });
}
