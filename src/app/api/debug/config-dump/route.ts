/**
 * GET /api/debug/config-dump
 * Dumps the processing config blob to inspect flow nodes, agent settings, etc.
 */

import { NextResponse } from "next/server";

const API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function GET(): Promise<Response> {
  const companyId = process.env.FREIA_COMPANY_ID ?? "default";

  // Try multiple company IDs like the webhook does
  const companyIdsToTry = [companyId];
  if (!companyIdsToTry.includes("company_rincon")) companyIdsToTry.push("company_rincon");
  if (!companyIdsToTry.includes("default")) companyIdsToTry.push("default");

  for (const tryId of companyIdsToTry) {
    try {
      const res = await fetch(
        `${API_URL}/processing-config/${encodeURIComponent(tryId)}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!res.ok) continue;

      const data = (await res.json()) as { config: Record<string, unknown> | null };
      if (!data.config) continue;

      const blob = data.config;

      // Extract key info without dumping everything
      const flows = (blob.flows ?? []) as Array<{
        id: string;
        name: string;
        nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
        edges: Array<{ source: string; target: string; sourceHandle?: string }>;
      }>;

      const agents = (blob.agents ?? []) as Array<{
        id: string;
        name: string;
        mode: string;
        llmProvider: string;
        modelName: string;
      }>;

      // Summarize flow nodes
      const flowSummaries = flows.map((f) => ({
        id: f.id.slice(0, 12),
        name: f.name,
        nodeCount: f.nodes?.length ?? 0,
        nodes: (f.nodes ?? []).map((n) => ({
          id: n.id,
          type: n.type,
          label: n.data?.label,
          // For message nodes, show the template
          message: n.type === "message" || n.type === "ask"
            ? (n.data?.message as string)?.slice(0, 120)
            : undefined,
          // For toolcall nodes, show the tool
          tool: n.type === "toolcall" ? n.data?.tool : undefined,
          paramMapping: n.type === "toolcall" ? n.data?.parameterMapping : undefined,
          // For condition nodes, show rules
          rules: n.type === "condition"
            ? (n.data?.rules as Array<{ label: string; variable: string; operator: string; value: string }>)?.map(
                (r) => ({ label: r.label, var: r.variable, op: r.operator, val: (r.value ?? "").slice(0, 60) })
              )
            : undefined,
        })),
        edges: (f.edges ?? []).map((e) => ({
          from: e.source,
          to: e.target,
          handle: e.sourceHandle,
        })),
      }));

      return NextResponse.json({
        companyId: tryId,
        hasOpenaiApiKey: !!blob.openaiApiKey,
        openaiApiKeyPreview: blob.openaiApiKey
          ? String(blob.openaiApiKey).slice(0, 8) + "..."
          : null,
        agentCount: agents.length,
        agents: agents.map((a) => ({
          id: a.id.slice(0, 12),
          name: a.name,
          mode: a.mode,
          llm: `${a.llmProvider}/${a.modelName}`,
        })),
        flowCount: flows.length,
        flows: flowSummaries,
        hasRouting: !!blob.routingConfig,
        hasBusinessHours: !!blob.businessHoursConfig,
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "No config found" }, { status: 404 });
}
