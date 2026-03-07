// Front entity — dedicated web access configuration

import type { FrontAuthConfig, FrontRole, FrontPermission } from "./front-auth";
import { DEFAULT_FRONT_AUTH_CONFIG } from "./front-auth";

// --- Enums ---

export type FrontStatus = "draft" | "published";

// --- Branding ---

export type FrontTemplate = "aurora" | "ember" | "moss";

export interface FrontBranding {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  template?: FrontTemplate;
}

export interface FrontTemplateConfig {
  label: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headerStyle: "solid" | "gradient" | "blur";
  cardStyle: "flat" | "glass" | "bordered";
  sectionSpacing: "compact" | "normal" | "spacious";
  borderRadius: "sm" | "md" | "lg" | "xl";
}

export const FRONT_TEMPLATES: Record<FrontTemplate, FrontTemplateConfig> = {
  aurora: {
    label: "Aurora",
    description: "Moderno y luminoso con gradientes sutiles",
    primaryColor: "#6366f1",
    secondaryColor: "#1a1a2e",
    accentColor: "#a78bfa",
    headerStyle: "gradient",
    cardStyle: "glass",
    sectionSpacing: "spacious",
    borderRadius: "xl",
  },
  ember: {
    label: "Ember",
    description: "Industrial, directo y de alto contraste",
    primaryColor: "#f59e0b",
    secondaryColor: "#111827",
    accentColor: "#fb923c",
    headerStyle: "solid",
    cardStyle: "bordered",
    sectionSpacing: "compact",
    borderRadius: "md",
  },
  moss: {
    label: "Moss",
    description: "Natural, orgánico y confiable",
    primaryColor: "#10b981",
    secondaryColor: "#0f1f1a",
    accentColor: "#34d399",
    headerStyle: "blur",
    cardStyle: "glass",
    sectionSpacing: "normal",
    borderRadius: "lg",
  },
};

// --- Pages & Sections ---

export type FrontSectionType =
  | "hero" | "chat" | "info" | "faq"
  | "chart_line" | "chart_bar" | "chart_pie" | "chart_kpi"
  | "table_data" | "table_stock"
  | "form_contact" | "button_cta"
  | "stock_list" | "stock_form";

export interface FrontSection {
  id: string;
  type: FrontSectionType;
  title?: string;
  content?: string;
  agentId?: string;
  config?: Record<string, unknown>;
  allowedRoles?: FrontRole[];
  requiredPermission?: FrontPermission;
}

export interface FrontPage {
  id: string;
  slug: string;
  title: string;
  sections: FrontSection[];
  order: number;
  allowedRoles?: FrontRole[];
}

export const SECTION_TYPE_CONFIG: Record<FrontSectionType, { label: string; description: string }> = {
  hero: { label: "Hero", description: "Encabezado con título y descripción" },
  chat: { label: "Chat", description: "Widget de conversación con un agente" },
  info: { label: "Información", description: "Bloque de texto libre" },
  faq: { label: "FAQ", description: "Preguntas frecuentes" },
  chart_line: { label: "Gráfico de línea", description: "Gráfico temporal con datos" },
  chart_bar: { label: "Gráfico de barras", description: "Barras verticales para comparar categorías" },
  chart_pie: { label: "Torta / Donut", description: "Gráfico circular con segmentos" },
  chart_kpi: { label: "Indicador KPI", description: "Tarjeta de métrica con valor y variación" },
  table_data: { label: "Tabla de datos", description: "Tabla configurable con columnas y filas" },
  table_stock: { label: "Tabla de stock", description: "Tabla con productos del catálogo" },
  form_contact: { label: "Formulario", description: "Formulario de contacto configurable" },
  button_cta: { label: "Botón CTA", description: "Botón de acción con enlace" },
  stock_list: { label: "Listado de stock", description: "Catálogo de productos con búsqueda" },
  stock_form: { label: "Formulario de stock", description: "Alta/edición de producto" },
};

export const EMPTY_FRONT_PAGE: Omit<FrontPage, "id"> = {
  slug: "",
  title: "",
  sections: [],
  order: 0,
};

// --- Versioning ---

export interface FrontVersion {
  id: string;
  frontId: string;
  version: number;
  snapshot: {
    name: string;
    description: string;
    subdomain: string;
    branding: FrontBranding;
    agentIds: string[];
    flowIds: string[];
    pages: FrontPage[];
    authConfig: FrontAuthConfig;
  };
  publishedAt: string;
  publishedBy: string;
  unpublishedAt?: string;
  unpublishedBy?: string;
}

// --- Core entity ---

export interface Front {
  id: string;
  name: string;
  description: string;
  status: FrontStatus;
  subdomain: string;
  branding: FrontBranding;
  agentIds: string[];
  flowIds: string[];
  pages: FrontPage[];
  authConfig: FrontAuthConfig;
  publishedVersionId?: string;
  versions: FrontVersion[];
  createdAt: string;
  updatedAt: string;
}

export type FrontFormData = Omit<Front, "id" | "createdAt" | "updatedAt" | "publishedVersionId" | "versions" | "pages" | "authConfig">;

// --- Constants ---

export const FRONT_STATUS_CONFIG: Record<
  FrontStatus,
  { label: string; color: string; bgColor: string }
> = {
  draft: {
    label: "Borrador",
    color: "text-slate-400",
    bgColor: "bg-slate-700/50",
  },
  published: {
    label: "Publicado",
    color: "text-emerald-400",
    bgColor: "bg-emerald-900/30",
  },
};

export const RESERVED_SUBDOMAINS = ["www", "api", "app", "admin", "mail", "ftp", "smtp", "pop", "imap"] as const;

const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/;

export function isValidSubdomainFormat(value: string): boolean {
  if (value.length < 3 || value.length > 63) return false;
  return SUBDOMAIN_REGEX.test(value);
}

export function isReservedSubdomain(value: string): boolean {
  return (RESERVED_SUBDOMAINS as readonly string[]).includes(value);
}

export function validateSubdomain(value: string): string | null {
  if (!value) return "El subdominio es obligatorio";
  const lower = value.toLowerCase();
  if (!isValidSubdomainFormat(lower))
    return "Mínimo 3 caracteres, solo minúsculas, números y guiones. No puede empezar o terminar con guión.";
  if (isReservedSubdomain(lower))
    return `"${lower}" es un subdominio reservado`;
  return null;
}

export const EMPTY_FRONT_FORM: FrontFormData = {
  name: "",
  description: "",
  status: "draft",
  subdomain: "",
  branding: {},
  agentIds: [],
  flowIds: [],
};

// --- Publish action type (for audit) ---

export type FrontPublishAction = "front_published" | "front_unpublished" | "front_version_restored";
