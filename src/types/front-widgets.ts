// Widget catalog for Front page builder

import type { FrontSectionType } from "./front";
import type { FrontPermission } from "./front-auth";

export type WidgetCategory = "general" | "graficos" | "tablas" | "inputs" | "stock";

// --- Widget configuration types ---

export type WidgetSize = "small" | "medium" | "large" | "full";
export type DataTransform = "none" | "sum" | "avg" | "count" | "last";

export const WIDGET_SIZE_LABELS: Record<WidgetSize, string> = {
  small: "Pequeño",
  medium: "Mediano",
  large: "Grande",
  full: "Completo",
};

export const DATA_TRANSFORM_LABELS: Record<DataTransform, string> = {
  none: "Sin transformación",
  sum: "Suma",
  avg: "Promedio",
  count: "Conteo",
  last: "Último valor",
};

export interface WidgetDataBinding {
  id: string;
  flowId: string;
  variableName: string;
  transform: DataTransform;
  label?: string;
}

export interface WidgetGeneralConfig {
  description?: string;
  size: WidgetSize;
  refreshSeconds: number;
}

export const DEFAULT_GENERAL_CONFIG: WidgetGeneralConfig = {
  size: "medium",
  refreshSeconds: 0,
};

// --- Chart configuration ---

export type ChartTimeRange = "1h" | "6h" | "24h" | "7d" | "30d" | "all";

export const CHART_TIME_RANGE_LABELS: Record<ChartTimeRange, string> = {
  "1h": "1 hora",
  "6h": "6 horas",
  "24h": "24 horas",
  "7d": "7 días",
  "30d": "30 días",
  all: "Todo",
};

export interface ChartConfig {
  xAxisLabel?: string;
  yAxisLabel?: string;
  groupBy?: string;
  timeRange?: ChartTimeRange;
  showLegend?: boolean;
  donut?: boolean;
}

// --- Table configuration ---

export type TableColumnType = "string" | "number" | "date" | "boolean";
export type TableColumnFormat = "text" | "currency" | "percent" | "date_short" | "date_long" | "badge";

export const TABLE_COLUMN_TYPE_LABELS: Record<TableColumnType, string> = {
  string: "Texto",
  number: "Número",
  date: "Fecha",
  boolean: "Booleano",
};

export const TABLE_COLUMN_FORMAT_LABELS: Record<TableColumnFormat, string> = {
  text: "Texto plano",
  currency: "Moneda ($)",
  percent: "Porcentaje (%)",
  date_short: "Fecha corta",
  date_long: "Fecha larga",
  badge: "Etiqueta",
};

export interface TableColumnDef {
  id: string;
  header: string;
  variableName?: string;   // binding to flow variable
  type: TableColumnType;
  format: TableColumnFormat;
  sortable: boolean;
  filterable: boolean;
  align?: "left" | "center" | "right";
}

export type TableRowAction = "send_to_flow" | "open_detail";

export const TABLE_ROW_ACTION_LABELS: Record<TableRowAction, string> = {
  send_to_flow: "Enviar a flujo",
  open_detail: "Abrir detalle",
};

export interface TableConfig {
  columnDefs: TableColumnDef[];
  pageSize: number;
  searchable: boolean;
  rowActions?: TableRowAction[];
}

export const DEFAULT_TABLE_CONFIG: TableConfig = {
  columnDefs: [],
  pageSize: 10,
  searchable: true,
  rowActions: [],
};

// --- Form configuration ---

export type FormFieldType = "text" | "email" | "number" | "date" | "select" | "textarea" | "checkbox";

export const FORM_FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Texto",
  email: "Email",
  number: "Número",
  date: "Fecha",
  select: "Selección",
  textarea: "Texto largo",
  checkbox: "Checkbox",
};

export interface FormFieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface FormFieldDef {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  variableMapping?: string;  // flow variable name to map to
  options?: string[];        // for select type
  validation?: FormFieldValidation;
}

export interface FormConfig {
  targetFlowId?: string;
  fields: FormFieldDef[];
  submitLabel?: string;
  successMessage?: string;
}

export const DEFAULT_FORM_CONFIG: FormConfig = {
  fields: [],
  submitLabel: "Enviar",
  successMessage: "Formulario enviado correctamente.",
};

// --- Form submission event (traceability) ---

export interface FormSubmissionEvent {
  id: string;
  frontId: string;
  sectionId: string;
  targetFlowId?: string;
  submittedBy: {
    visitorId?: string;
    email?: string;
    name?: string;
    role?: string;
  };
  payload: Record<string, unknown>;
  variableMappings: Record<string, string>;  // fieldLabel → variableName
  status: "success" | "error";
  errorMessage?: string;
  submittedAt: string;
}

// --- Button action configuration ---

export type ButtonActionMode = "link" | "flow";

export const BUTTON_ACTION_MODE_LABELS: Record<ButtonActionMode, string> = {
  link: "Abrir enlace",
  flow: "Disparar flujo",
};

export interface ButtonActionConfig {
  mode: ButtonActionMode;
  targetFlowId?: string;
  payload?: Record<string, unknown>;  // fixed or partial payload
  confirmationMessage?: string;       // if set, show confirmation dialog
}

export interface ButtonActionEvent {
  id: string;
  frontId: string;
  sectionId: string;
  targetFlowId: string;
  payload: Record<string, unknown>;
  triggeredBy: {
    visitorId?: string;
    email?: string;
    name?: string;
    role?: string;
  };
  status: "success" | "error";
  errorMessage?: string;
  triggeredAt: string;
}

// --- Stock form configuration ---

export interface StockFormConfig {
  autoGenerateSku: boolean;
  showOptionalFields: boolean;
  successMessage?: string;
}

export const DEFAULT_STOCK_FORM_CONFIG: StockFormConfig = {
  autoGenerateSku: true,
  showOptionalFields: false,
  successMessage: "Producto creado correctamente.",
};

// --- Catalog entry ---

export interface WidgetCatalogEntry {
  type: FrontSectionType;
  category: WidgetCategory;
  label: string;
  description: string;
  icon: string; // Lucide icon name
  requiredPermission?: FrontPermission;
  requirements?: string[];
  bindableSlots?: string[];
}

export const WIDGET_CATEGORY_LABELS: Record<WidgetCategory, { label: string; description: string }> = {
  general: { label: "General", description: "Widgets básicos de contenido" },
  graficos: { label: "Gráficos", description: "Visualización de datos" },
  tablas: { label: "Tablas", description: "Datos tabulares" },
  inputs: { label: "Inputs / Acciones", description: "Formularios y botones" },
  stock: { label: "Stock (ABM)", description: "Gestión de productos" },
};

export const WIDGET_CATEGORIES: WidgetCategory[] = [
  "general",
  "graficos",
  "tablas",
  "inputs",
  "stock",
];

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  // --- General ---
  {
    type: "hero",
    category: "general",
    label: "Hero",
    description: "Encabezado con título y descripción destacada",
    icon: "Sparkles",
  },
  {
    type: "info",
    category: "general",
    label: "Información",
    description: "Bloque de texto libre con formato",
    icon: "Info",
  },
  {
    type: "faq",
    category: "general",
    label: "FAQ",
    description: "Preguntas frecuentes con acordeón",
    icon: "HelpCircle",
  },
  {
    type: "chat",
    category: "general",
    label: "Chat",
    description: "Widget de conversación con un agente IA",
    icon: "MessageCircle",
    requiredPermission: "interact",
    requirements: ["Agente asignado al front"],
  },
  // --- Gráficos ---
  {
    type: "chart_line",
    category: "graficos",
    label: "Gráfico de línea",
    description: "Gráfico temporal con datos numéricos",
    icon: "TrendingUp",
    requiredPermission: "view_widget",
    bindableSlots: ["data"],
  },
  {
    type: "chart_bar",
    category: "graficos",
    label: "Gráfico de barras",
    description: "Barras verticales para comparar categorías",
    icon: "BarChart",
    requiredPermission: "view_widget",
    bindableSlots: ["data"],
  },
  {
    type: "chart_pie",
    category: "graficos",
    label: "Torta / Donut",
    description: "Gráfico circular para distribución porcentual",
    icon: "PieChart",
    requiredPermission: "view_widget",
    bindableSlots: ["data"],
  },
  {
    type: "chart_kpi",
    category: "graficos",
    label: "Indicador KPI",
    description: "Tarjeta de métrica con valor destacado y variación porcentual",
    icon: "BarChart3",
    requiredPermission: "view_widget",
    bindableSlots: ["value"],
  },
  // --- Tablas ---
  {
    type: "table_data",
    category: "tablas",
    label: "Tabla de datos",
    description: "Tabla configurable con columnas y filas personalizables",
    icon: "Table",
    requiredPermission: "view_widget",
    bindableSlots: ["rows"],
  },
  {
    type: "table_stock",
    category: "tablas",
    label: "Tabla de stock",
    description: "Tabla con productos del catálogo de stock",
    icon: "ClipboardList",
    requiredPermission: "operate_stock",
    requirements: ["Productos cargados en stock"],
  },
  // --- Inputs / Acciones ---
  {
    type: "form_contact",
    category: "inputs",
    label: "Formulario",
    description: "Formulario de contacto con campos configurables",
    icon: "FileInput",
    requiredPermission: "interact",
  },
  {
    type: "button_cta",
    category: "inputs",
    label: "Botón CTA",
    description: "Botón de acción o disparador de flujo configurable",
    icon: "MousePointerClick",
    requiredPermission: "interact",
  },
  // --- Stock (ABM) ---
  {
    type: "stock_list",
    category: "stock",
    label: "Listado de stock",
    description: "Catálogo de productos con búsqueda y filtros",
    icon: "Package",
    requiredPermission: "operate_stock",
    requirements: ["Productos cargados en stock"],
  },
  {
    type: "stock_form",
    category: "stock",
    label: "Formulario de stock",
    description: "Formulario de alta y edición de producto",
    icon: "PackagePlus",
    requiredPermission: "operate_stock",
    requirements: ["Productos cargados en stock"],
  },
];

export function getWidgetsByCategory(category: WidgetCategory): WidgetCatalogEntry[] {
  return WIDGET_CATALOG.filter((w) => w.category === category);
}

export function getWidgetEntry(type: FrontSectionType): WidgetCatalogEntry | undefined {
  return WIDGET_CATALOG.find((w) => w.type === type);
}
