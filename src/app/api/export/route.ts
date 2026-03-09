/**
 * /api/export
 *
 * Client-side helper page that exports all localStorage keys as JSON.
 * This is a GET endpoint that returns a script — actual export happens
 * in the browser since localStorage is client-side only.
 *
 * Usage: Open /api/export/page in the browser.
 */

import { NextResponse } from "next/server";

// The localStorage keys that map to database tables
const EXPORTABLE_KEYS = [
  "freia_companies",
  "freia_system_users",
  "freia_profiles",
  "freia_agents",
  "freia_flows",
  "freia_products",
  "freia_variant_types",
  "freia_discounts",
  "freia_policies",
  "freia_channels",
  "freia_tool_registry",
  "freia_integrations",
  "freia_conversations",
];

export async function GET(): Promise<Response> {
  return NextResponse.json({
    message:
      "Use the /export-db page in the browser to export localStorage data. This endpoint cannot access localStorage directly (server-side).",
    keys: EXPORTABLE_KEYS,
  });
}
