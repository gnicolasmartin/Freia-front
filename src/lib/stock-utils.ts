/** Generate a unique product SKU code in the format PROD-XXXXXX */
export function generateUniqueCode(existingSkus: string[]): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const skuSet = new Set(existingSkus.map((s) => s.toUpperCase()));
  let code: string;
  do {
    const suffix = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    code = `PROD-${suffix}`;
  } while (skuSet.has(code));
  return code;
}

/** Canonical string for variant duplicate detection: sorted key=value pairs. */
export function attrSignature(attrs: Record<string, string>): string {
  return Object.keys(attrs)
    .sort()
    .map((k) => `${k}=${attrs[k].trim().toLowerCase()}`)
    .join("|");
}

/** Converts a display name to a normalized internal key (lowercase, no accents, underscores). */
export function nameToKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
