/**
 * config-sync.ts
 *
 * Syncs the frontend processing config (agents, flows, routing, etc.)
 * to the backend so the server-side webhook processor can access it.
 *
 * Pure utility — no React.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessingConfigBlob {
  agents: unknown[];
  flows: unknown[];
  policies: unknown[];
  tools: unknown[];
  products: unknown[];
  variantTypes: unknown[];
  discounts: unknown[];
  routingConfig: unknown;
  businessHoursConfig: unknown;
  openaiApiKey?: string;
  /** WhatsApp credentials for server-side sending (multi-tenant). */
  waCredentials?: {
    phoneNumberId: string;
    accessToken: string;
  };
}

// ─── Hash ─────────────────────────────────────────────────────────────────────

let lastSyncedHash = "";

async function computeHash(data: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buffer = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback: simple string hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export async function syncConfigToBackend(
  companyId: string,
  config: ProcessingConfigBlob
): Promise<{ synced: boolean; error?: string }> {
  try {
    const json = JSON.stringify(config);
    const hash = await computeHash(json);

    // Skip if config hasn't changed
    if (hash === lastSyncedHash) {
      return { synced: false };
    }

    const res = await fetch(`/api/processing-config/${encodeURIComponent(companyId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, configHash: hash }),
    });

    if (!res.ok) {
      return { synced: false, error: `HTTP ${res.status}` };
    }

    lastSyncedHash = hash;
    return { synced: true };
  } catch (err) {
    return { synced: false, error: String(err) };
  }
}

/** Reset the cached hash (e.g., on company change). */
export function resetSyncHash(): void {
  lastSyncedHash = "";
}
