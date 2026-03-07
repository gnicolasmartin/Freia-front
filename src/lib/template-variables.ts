import type { FlowVariable } from "@/types/flow";

export type VariableCategory =
  | "user"
  | "system"
  | "contact"
  | "channel"
  | "conversation"
  | "lead"
  | "product";

export interface AutocompleteVariable {
  name: string;
  type: string;
  description?: string;
  category: VariableCategory;
  builtin?: boolean;
}

// --- Built-in context variables (read-only, always available) ---

const CONTACT_VARIABLES: AutocompleteVariable[] = [
  { name: "contact.firstName", type: "string", description: "Nombre del contacto", category: "contact", builtin: true },
  { name: "contact.lastName", type: "string", description: "Apellido del contacto", category: "contact", builtin: true },
  { name: "contact.email", type: "string", description: "Email del contacto", category: "contact", builtin: true },
  { name: "contact.phone", type: "string", description: "Teléfono del contacto", category: "contact", builtin: true },
];

const CHANNEL_VARIABLES: AutocompleteVariable[] = [
  { name: "channel.type", type: "string", description: "Tipo de canal (web, whatsapp, email)", category: "channel", builtin: true },
];

const CONVERSATION_VARIABLES: AutocompleteVariable[] = [
  { name: "conversation.id", type: "string", description: "ID único de la conversación", category: "conversation", builtin: true },
];

const LEAD_VARIABLES: AutocompleteVariable[] = [
  { name: "lead.stage", type: "enum", description: "Etapa del lead", category: "lead", builtin: true },
  { name: "lead.score", type: "number", description: "Puntuación del lead", category: "lead", builtin: true },
  { name: "lead.source", type: "string", description: "Origen del lead", category: "lead", builtin: true },
];

const SYSTEM_VARIABLES: AutocompleteVariable[] = [
  { name: "system.time", type: "string", description: "Hora actual (HH:mm)", category: "system", builtin: true },
  { name: "system.dayOfWeek", type: "string", description: "Día de la semana (lunes, martes...)", category: "system", builtin: true },
  { name: "system.currentDate", type: "date", description: "Fecha actual", category: "system", builtin: true },
  { name: "system.flowName", type: "string", description: "Nombre del flujo", category: "system", builtin: true },
  { name: "system.isBusinessHours", type: "boolean", description: "¿Dentro de horario de atención?", category: "system", builtin: true },
  { name: "system.outOfHoursMessage", type: "string", description: "Mensaje para fuera de horario", category: "system", builtin: true },
  { name: "system.bookingUrl", type: "string", description: "Link de reserva (si configurado)", category: "system", builtin: true },
];

// --- Product variables (available when useStock=true) ---

export const PRODUCT_VARIABLES: AutocompleteVariable[] = [
  { name: "product.id", type: "string", description: "ID del producto seleccionado", category: "product", builtin: true },
  { name: "product.name", type: "string", description: "Nombre del producto", category: "product", builtin: true },
  { name: "product.sku", type: "string", description: "Código SKU del producto", category: "product", builtin: true },
  { name: "product.price", type: "number", description: "Precio base del producto", category: "product", builtin: true },
  { name: "product.final_price", type: "number", description: "Precio con descuentos aplicados", category: "product", builtin: true },
  { name: "product.discounts", type: "string", description: "Descuentos aplicados (lista)", category: "product", builtin: true },
  { name: "product.variant_id", type: "string", description: "ID de la variante seleccionada", category: "product", builtin: true },
  { name: "product.variant_attrs", type: "string", description: "Atributos de la variante (color, talle...)", category: "product", builtin: true },
  { name: "product.stock", type: "number", description: "Stock disponible del producto", category: "product", builtin: true },
];

export const BUILTIN_VARIABLES: AutocompleteVariable[] = [
  ...CONTACT_VARIABLES,
  ...CHANNEL_VARIABLES,
  ...CONVERSATION_VARIABLES,
  ...LEAD_VARIABLES,
  ...SYSTEM_VARIABLES,
];

export const CATEGORY_LABELS: Record<VariableCategory, string> = {
  user: "Variables del flujo",
  contact: "Contacto",
  channel: "Canal",
  conversation: "Conversación",
  lead: "Lead",
  system: "Sistema",
  product: "Producto",
};

// --- Public API ---

interface BuildOpts {
  useStock?: boolean;
}

export function buildAutocompleteList(
  flowVariables: FlowVariable[],
  opts: BuildOpts = {}
): AutocompleteVariable[] {
  const userVars: AutocompleteVariable[] = flowVariables
    .filter((v) => v.name.trim() !== "")
    .map((v) => ({
      name: v.name,
      type: v.type,
      description: v.description,
      category: "user" as const,
    }));

  const builtins = opts.useStock
    ? [...BUILTIN_VARIABLES, ...PRODUCT_VARIABLES]
    : BUILTIN_VARIABLES;

  return [...userVars, ...builtins];
}

export function filterAutocomplete(
  allVars: AutocompleteVariable[],
  query: string
): AutocompleteVariable[] {
  const lower = query.toLowerCase();
  if (!lower) return allVars;
  return allVars.filter(
    (v) =>
      v.name.toLowerCase().includes(lower) ||
      (v.description?.toLowerCase().includes(lower) ?? false)
  );
}

export function isKnownVariable(
  name: string,
  flowVariables: FlowVariable[],
  opts: BuildOpts = {}
): boolean {
  const allVars = buildAutocompleteList(flowVariables, opts);
  return allVars.some((v) => v.name === name);
}

export function getSampleValue(variable: AutocompleteVariable): string {
  const SAMPLES: Record<string, string> = {
    "contact.firstName": "Juan",
    "contact.lastName": "Pérez",
    "contact.email": "juan@mail.com",
    "contact.phone": "+54 11 1234-5678",
    "channel.type": "whatsapp",
    "conversation.id": "conv-abc123",
    "lead.stage": "calificado",
    "lead.score": "85",
    "lead.source": "web",
    "system.time": "14:30",
    "system.dayOfWeek": "martes",
    "system.currentDate": "25/02/2026",
    "system.flowName": "Atención al cliente",
    "system.isBusinessHours": "true",
    "system.outOfHoursMessage": "Estamos fuera de horario. Te respondemos pronto.",
    "system.bookingUrl": "https://tu-empresa.com/reservas",
    // Product samples
    "product.id": "prod-abc123",
    "product.name": "Zapatillas Urbanas",
    "product.sku": "ZAP-URB-001",
    "product.price": "12500",
    "product.final_price": "10625",
    "product.discounts": "15% descuento temporada",
    "product.variant_id": "var-xyz456",
    "product.variant_attrs": "Color: Negro, Talle: 42",
    "product.stock": "8",
  };

  if (SAMPLES[variable.name]) return SAMPLES[variable.name];

  switch (variable.type) {
    case "string":
      return "texto";
    case "number":
      return "42";
    case "boolean":
      return "true";
    case "date":
      return "25/02/2026";
    case "enum":
      return "opcion_1";
    default:
      return "...";
  }
}
