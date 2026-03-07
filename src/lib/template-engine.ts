// Template engine — pure utility, zero React dependency.
// Supports: {{varName}}, {{contact.firstName}}, {{name | 'fallback'}}

// --- Regex ---

/** Matches a single template variable expression including optional pipe fallback. */
const TEMPLATE_VAR_REGEX =
  /\{\{\s*([\w]+(?:\.[\w]+)*)\s*(?:\|\s*'([^']*)')?\s*\}\}/g;

/** Splitting regex (capturing) — keeps delimiters in the result array. */
const TEMPLATE_SPLIT_REGEX =
  /(\{\{\s*[\w]+(?:\.[\w]+)*\s*(?:\|\s*'[^']*')?\s*\}\})/g;

/** Single-match version for testing individual tokens. */
const TEMPLATE_TOKEN_REGEX =
  /^\{\{\s*([\w]+(?:\.[\w]+)*)\s*(?:\|\s*'([^']*)')?\s*\}\}$/;

// --- XSS sanitization ---

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Deep property access ---

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current !== null && current !== undefined && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// --- Main render function ---

export function renderTemplate(
  template: string,
  vars: Record<string, unknown>
): string {
  return template.replace(
    TEMPLATE_VAR_REGEX,
    (_match, path: string, fallback?: string) => {
      const value = getNestedValue(vars, path);
      if (value !== undefined && value !== null) {
        return escapeHtml(String(value));
      }
      if (fallback !== undefined) {
        return escapeHtml(fallback);
      }
      return "";
    }
  );
}

// --- Token types ---

export interface TemplateToken {
  type: "text" | "variable";
  raw: string;
  path?: string;
  fallback?: string;
}

// --- Parse template into tokens ---

export function parseTemplate(template: string): TemplateToken[] {
  const parts = template.split(TEMPLATE_SPLIT_REGEX);
  return parts
    .filter((p) => p !== "")
    .map((part) => {
      const match = TEMPLATE_TOKEN_REGEX.exec(part);
      if (match) {
        return {
          type: "variable" as const,
          raw: part,
          path: match[1],
          fallback: match[2],
        };
      }
      return { type: "text" as const, raw: part };
    });
}

// --- Extract variable names ---

export function extractVariables(template: string): string[] {
  const vars: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(TEMPLATE_VAR_REGEX.source, "g");
  while ((match = regex.exec(template)) !== null) {
    vars.push(match[1]);
  }
  return [...new Set(vars)];
}
