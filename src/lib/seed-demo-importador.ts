/**
 * seed-demo-importador.ts
 *
 * Seeds localStorage with demo data for an import business user.
 * Includes: products (no price/stock), supplier WhatsApp messages,
 * a price extraction agent, a minimal flow, and a front with price comparison table.
 *
 * Idempotent — checks a sentinel key before running.
 */

import type { Product } from "@/types/product";
import type { Flow, FlowNode, FlowEdge, FlowVariable } from "@/types/flow";
import type { Agent } from "@/types/agent";
import type { Front, FrontVersion, FrontPage, FrontSection } from "@/types/front";
import { DEFAULT_FRONT_AUTH_CONFIG } from "@/types/front-auth";

const SEED_KEY = "freia_seed_importador_v2";

// ── helpers ──────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ── Products (componentes electrónicos, sin precio ni stock) ────────────────

const ts = now();

const PRODUCTS: Product[] = [
  {
    id: uid(), name: "Resistencia 470 Ohm 1/4W", sku: "IMP-R470",
    description: "Resistencia de carbón 470 Ohm 1/4W, tolerancia 5%",
    brand: "Genérica", model: "R470-1/4W",
    price: 0, stock: 0, unit: "unidad", category: "Componentes Electrónicos",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), name: "Capacitor Cerámico 100uF", sku: "IMP-C100UF",
    description: "Capacitor cerámico 100 microfaradios 25V",
    brand: "Genérica", model: "C100UF-25V",
    price: 0, stock: 0, unit: "unidad", category: "Componentes Electrónicos",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), name: "Transistor BC548", sku: "IMP-BC548",
    description: "Transistor NPN de uso general BC548",
    brand: "Genérica", model: "BC548",
    price: 0, stock: 0, unit: "unidad", category: "Componentes Electrónicos",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), name: "LED Rojo 5mm", sku: "IMP-LED5R",
    description: "LED rojo difuso 5mm, 20mA, 2V",
    brand: "Genérica", model: "LED-5R",
    price: 0, stock: 0, unit: "unidad", category: "Componentes Electrónicos",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), name: "Relay 12V 10A", sku: "IMP-RLY12",
    description: "Relay electromagnético 12V DC, 10A contacto",
    brand: "Songle", model: "SRD-12VDC",
    price: 0, stock: 0, unit: "unidad", category: "Componentes Electrónicos",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), name: "Fusible 10A 250V", sku: "IMP-FUS10",
    description: "Fusible de vidrio 5x20mm, 10A 250V",
    brand: "Genérica", model: "F10A-250V",
    price: 0, stock: 0, unit: "unidad", category: "Componentes Electrónicos",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), name: "Cable UTP Cat6 (metro)", sku: "IMP-UTP6",
    description: "Cable UTP categoría 6, cobre puro, por metro",
    brand: "Furukawa", model: "CAT6-UTP",
    price: 0, stock: 0, unit: "metro", category: "Cables y Conectores",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), name: "Transformador 220/12V 1A", sku: "IMP-TRF12",
    description: "Transformador de línea 220V a 12V, 1 Ampere",
    brand: "Genérica", model: "TRF-220-12-1A",
    price: 0, stock: 0, unit: "unidad", category: "Fuentes y Transformadores",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), name: "Arduino Nano V3", sku: "IMP-ARDNANO",
    description: "Placa Arduino Nano V3 compatible, ATmega328P, USB Mini-B",
    brand: "Compatible", model: "Nano-V3",
    price: 0, stock: 0, unit: "unidad", category: "Placas de Desarrollo",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), name: "Sensor DHT22", sku: "IMP-DHT22",
    description: "Sensor digital de temperatura y humedad DHT22/AM2302",
    brand: "Aosong", model: "DHT22",
    price: 0, stock: 0, unit: "unidad", category: "Sensores",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), name: "Display OLED 0.96\" I2C", sku: "IMP-OLED096",
    description: "Display OLED 128x64 0.96 pulgadas, interfaz I2C, SSD1306",
    brand: "Genérica", model: "SSD1306-096",
    price: 0, stock: 0, unit: "unidad", category: "Displays",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), name: "Módulo WiFi ESP32", sku: "IMP-ESP32",
    description: "Módulo ESP32 DevKit V1, WiFi + Bluetooth, dual-core",
    brand: "Espressif", model: "ESP32-WROOM-32",
    price: 0, stock: 0, unit: "unidad", category: "Placas de Desarrollo",
    createdAt: ts, updatedAt: ts,
  },
];

// ── Supplier WhatsApp messages (unstructured pricing) ───────────────────────

interface ImportSupplierMessage {
  id: string;
  supplierName: string;
  supplierPhone: string;
  text: string;
  receivedAt: string;
}

const SUPPLIER_MESSAGES: ImportSupplierMessage[] = [
  {
    id: uid(),
    supplierName: "Electrónica Shenzhen",
    supplierPhone: "+8613800138001",
    text: "Hola! Te paso los precios actualizados FOB:\n- Resistencia 470ohm: USD 0.02 c/u (min 1000)\n- Capacitor 100uF: USD 0.15 c/u\n- LED rojo 5mm: USD 0.03 c/u\n- Arduino Nano: USD 4.50 c/u\n- ESP32 módulo: USD 3.20 c/u\n- Sensor DHT22: USD 1.80\nTodos con entrega 30 días. Saludos!",
    receivedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: uid(),
    supplierName: "TechParts Global",
    supplierPhone: "+8613900139002",
    text: "Buenos días, acá van los precios:\nResistencia 470 ohm $0.025\nCapacitor ceramico 100uf $0.12\nTransistor BC548 $0.08\nRelay 12v $0.95\nFusible 10A $0.05\nCable UTP cat6 por metro $0.18\nTransformador 220 a 12v $2.40\nDisplay OLED 0.96 pulgadas $2.85\nSaludos",
    receivedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: uid(),
    supplierName: "ComponentesBA Import",
    supplierPhone: "+5491155001234",
    text: "Che, te mando la lista actualizada:\nResistencias 470ohm: USD 0.03 x unidad\nCapacitor 100uf: 0.18 USD\nLED rojo: 0.04 dólar\nBC548 transistor: 0.10\nArduino Nano compatible: 5.20 USD\nESP32: 3.80\nDHT22 sensor temp/humedad: 2.10 USD\nOLED display: 3.10\nEntrega inmediata desde depósito Dock Sud",
    receivedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
  },
  {
    id: uid(),
    supplierName: "MicroElec Asia",
    supplierPhone: "+8618500185003",
    text: "Price list March 2026:\nR470 ohm 1/4w = 0.018 usd\nCap 100uF = 0.11\nTransistor BC548 = 0.07\nRelay 12V = 0.85\nFuse 10A = 0.04\nArduino Nano = 4.20\nESP32 WiFi = 2.90\nSensor DHT22 = 1.65\nOLED 0.96 = 2.50\nCable UTP Cat6 = 0.15/m\nTransformador 220/12V = 2.10",
    receivedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
];

// ── Flow (decorativo) ───────────────────────────────────────────────────────

const flowId = uid();

const flowNodes: FlowNode[] = [
  {
    id: "start",
    type: "start",
    position: { x: 250, y: 50 },
    data: { label: "Inicio" },
    deletable: false,
  },
  {
    id: "n_procesar",
    type: "message",
    position: { x: 250, y: 180 },
    data: {
      label: "Procesar mensajes",
      message: "Analizando mensajes de proveedores y extrayendo precios de productos...",
    },
  },
  {
    id: "n_resultado",
    type: "message",
    position: { x: 250, y: 310 },
    data: {
      label: "Resultado",
      message: "Se actualizó la matriz de precios con {productos_actualizados} productos de {proveedores_procesados} proveedores.",
    },
  },
  {
    id: "n_end",
    type: "end",
    position: { x: 250, y: 440 },
    data: { label: "Fin", outcome: "resolved" },
  },
];

const flowEdges: FlowEdge[] = [
  { id: "e_start_proc", source: "start", target: "n_procesar" },
  { id: "e_proc_res", source: "n_procesar", target: "n_resultado" },
  { id: "e_res_end", source: "n_resultado", target: "n_end" },
];

const flowVars: FlowVariable[] = [
  { id: uid(), name: "productos_actualizados", type: "number", description: "Cantidad de productos con precios actualizados" },
  { id: uid(), name: "proveedores_procesados", type: "number", description: "Cantidad de proveedores procesados" },
  { id: uid(), name: "mensaje_raw", type: "string", description: "Texto crudo del mensaje del proveedor" },
];

const FLOW: Flow = {
  id: flowId,
  name: "Extracción de Precios — Importaciones",
  description: "Flujo de extracción automática de precios desde mensajes de WhatsApp de proveedores.",
  status: "active",
  nodes: flowNodes,
  edges: flowEdges,
  variables: flowVars,
  policyIds: [],
  allowedToolIds: [],
  useStock: true,
  versions: [],
  createdAt: ts,
  updatedAt: ts,
};

// ── Agent ───────────────────────────────────────────────────────────────────

const agentId = uid();

const AGENT: Agent = {
  id: agentId,
  name: "Agente de Importaciones",
  description: "Lee mensajes de WhatsApp de proveedores, extrae precios y actualiza la matriz de comparación de precios.",
  status: "active",
  channelScope: "whatsapp",
  flowId,
  mode: "ai-guided",
  primaryObjective: "resolver_consulta",
  kpiType: "conversion",
  kpiTarget: 95,
  llmProvider: "openai",
  modelName: "gpt-4o",
  temperature: 0.3,
  maxTokens: 2048,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  tone: "tecnico",
  responseLength: "corta",
  emojiUsage: "no",
  language: "es_ar",
  policyScope: "inherited",
  allowOverride: false,
  whatsappOutbound: false,
  createdAt: ts,
  updatedAt: ts,
};

// ── Front ───────────────────────────────────────────────────────────────────

const frontId = uid();

// Price comparison table data: rows = products, columns = suppliers + best price
// "-" means the supplier did not quote that product
const priceTableRows: string[][] = [
  ["Resistencia 470 Ohm 1/4W",   "0.020", "0.025", "0.030", "0.018", "0.018"],
  ["Capacitor Cerámico 100uF",    "0.150", "0.120", "0.180", "0.110", "0.110"],
  ["Transistor BC548",             "-",     "0.080", "0.100", "0.070", "0.070"],
  ["LED Rojo 5mm",                "0.030", "-",     "0.040", "-",     "0.030"],
  ["Relay 12V 10A",               "-",     "0.950", "-",     "0.850", "0.850"],
  ["Fusible 10A 250V",            "-",     "0.050", "-",     "0.040", "0.040"],
  ["Cable UTP Cat6 (metro)",      "-",     "0.180", "-",     "0.150", "0.150"],
  ["Transformador 220/12V 1A",    "-",     "2.400", "-",     "2.100", "2.100"],
  ["Arduino Nano V3",            "4.500",  "-",     "5.200", "4.200", "4.200"],
  ["Sensor DHT22",               "1.800",  "-",     "2.100", "1.650", "1.650"],
  ["Display OLED 0.96\" I2C",     "-",     "2.850", "3.100", "2.500", "2.500"],
  ["Módulo WiFi ESP32",          "3.200",  "-",     "3.800", "2.900", "2.900"],
];

// Supplier messages table data for the "Mensajes" page
const mensajesRows: string[][] = SUPPLIER_MESSAGES.map((m) => [
  m.supplierName,
  m.supplierPhone,
  m.text.replace(/\n/g, " "),
  new Date(m.receivedAt).toLocaleString("es-AR"),
]);

const frontPages: FrontPage[] = [
  {
    id: uid(),
    slug: "inicio",
    title: "Inicio",
    order: 0,
    sections: [
      {
        id: uid(),
        type: "hero",
        title: "Panel de Importaciones",
        content: "Gestioná tus productos importados y compará precios de proveedores en tiempo real.",
      } as FrontSection,
      {
        id: uid(),
        type: "chart_kpi",
        title: "Proveedores activos",
        config: {
          data: [{ label: "Proveedores", value: 4 }],
        },
      } as FrontSection,
      {
        id: uid(),
        type: "chart_kpi",
        title: "Productos gestionados",
        config: {
          data: [{ label: "Productos", value: 12 }],
        },
      } as FrontSection,
    ],
  },
  {
    id: uid(),
    slug: "productos",
    title: "Productos",
    order: 1,
    sections: [
      {
        id: uid(),
        type: "stock_list",
        title: "Catálogo de productos importados",
      } as FrontSection,
      {
        id: uid(),
        type: "stock_form",
        title: "Agregar producto",
        requiredPermission: "operate_stock",
        config: {
          _stockForm: {
            autoGenerateSku: false,
            showOptionalFields: true,
            successMessage: "Producto agregado al catálogo de importación.",
          },
        },
      } as FrontSection,
    ],
  },
  {
    id: uid(),
    slug: "precios",
    title: "Comparativa de Precios",
    order: 2,
    sections: [
      {
        id: uid(),
        type: "table_data",
        title: "Precios por proveedor (USD)",
        config: {
          _table: {
            columnDefs: [
              { id: uid(), header: "Producto", type: "string", format: "text", sortable: true, filterable: true, align: "left" },
              { id: uid(), header: "Electrónica Shenzhen", type: "number", format: "currency", sortable: true, filterable: false, align: "right" },
              { id: uid(), header: "TechParts Global", type: "number", format: "currency", sortable: true, filterable: false, align: "right" },
              { id: uid(), header: "ComponentesBA Import", type: "number", format: "currency", sortable: true, filterable: false, align: "right" },
              { id: uid(), header: "MicroElec Asia", type: "number", format: "currency", sortable: true, filterable: false, align: "right" },
              { id: uid(), header: "Mejor precio", type: "number", format: "currency", sortable: true, filterable: false, align: "right" },
            ],
            pageSize: 15,
            searchable: true,
          },
          rows: priceTableRows,
        },
      } as FrontSection,
    ],
  },
  {
    id: uid(),
    slug: "mensajes",
    title: "Mensajes de Proveedores",
    order: 3,
    sections: [
      {
        id: uid(),
        type: "table_data",
        title: "Mensajes recibidos por WhatsApp",
        config: {
          _table: {
            columnDefs: [
              { id: uid(), header: "Proveedor", type: "string", format: "text", sortable: true, filterable: true, align: "left" },
              { id: uid(), header: "Teléfono", type: "string", format: "text", sortable: false, filterable: false, align: "left" },
              { id: uid(), header: "Mensaje", type: "string", format: "text", sortable: false, filterable: true, align: "left" },
              { id: uid(), header: "Recibido", type: "string", format: "text", sortable: true, filterable: false, align: "left" },
            ],
            pageSize: 10,
            searchable: true,
          },
          rows: mensajesRows,
        },
      } as FrontSection,
    ],
  },
];

const frontVersionId = uid();

const frontSnapshot = {
  name: "Panel de Importaciones",
  description: "Front de gestión de importaciones con comparativa de precios de proveedores.",
  subdomain: "importaciones",
  branding: { primaryColor: "#6366f1", secondaryColor: "#1a1a2e", template: "aurora" } as Front["branding"],
  agentIds: [agentId],
  flowIds: [flowId],
  pages: frontPages,
  authConfig: { ...DEFAULT_FRONT_AUTH_CONFIG },
};

const frontVersion: FrontVersion = {
  id: frontVersionId,
  frontId,
  version: 1,
  snapshot: frontSnapshot,
  publishedAt: ts,
  publishedBy: "importador@freia.ai",
};

const FRONT: Front = {
  id: frontId,
  name: "Panel de Importaciones",
  description: "Front de gestión de importaciones con comparativa de precios de proveedores.",
  status: "published",
  subdomain: "importaciones",
  branding: { primaryColor: "#6366f1", secondaryColor: "#1a1a2e", template: "aurora" },
  agentIds: [agentId],
  flowIds: [flowId],
  pages: frontPages,
  authConfig: { ...DEFAULT_FRONT_AUTH_CONFIG },
  publishedVersionId: frontVersionId,
  versions: [frontVersion],
  createdAt: ts,
  updatedAt: ts,
};

// ── Seed function ────────────────────────────────────────────────────────────

const OLD_SEED_KEYS: string[] = ["freia_seed_importador_v1"];

export function seedDemoImportador(): boolean {
  if (typeof window === "undefined") return false;

  // Clean up old sentinels so version bump forces re-seed
  for (const k of OLD_SEED_KEYS) localStorage.removeItem(k);

  // Invalidate other demo's sentinel so it can re-seed when switching back
  localStorage.removeItem("freia_seed_cubiertas_v15");

  // ALWAYS clean other demo's data (runs even if already seeded)
  let cleaned = false;
  try {
    const products = JSON.parse(localStorage.getItem("freia_products") ?? "[]");
    const filtered = products.filter((p: Record<string, unknown>) => typeof p.sku !== "string" || (p.sku as string).startsWith("IMP-"));
    if (filtered.length !== products.length) { cleaned = true; localStorage.setItem("freia_products", JSON.stringify(filtered)); }
  } catch { /* ignore */ }
  try {
    const flows = JSON.parse(localStorage.getItem("freia_flows") ?? "[]");
    const filtered = flows.filter((f: Record<string, unknown>) => f.name !== "Consulta de Stock — Cubiertas");
    if (filtered.length !== flows.length) { cleaned = true; localStorage.setItem("freia_flows", JSON.stringify(filtered)); }
  } catch { /* ignore */ }
  try {
    const agents = JSON.parse(localStorage.getItem("freia_agents") ?? "[]");
    const filtered = agents.filter((a: Record<string, unknown>) => a.name !== "Asistente Cubiertas Express");
    if (filtered.length !== agents.length) { cleaned = true; localStorage.setItem("freia_agents", JSON.stringify(filtered)); }
  } catch { /* ignore */ }
  try {
    const fronts = JSON.parse(localStorage.getItem("freia_fronts") ?? "[]");
    const filtered = fronts.filter((f: Record<string, unknown>) => f.name !== "Cubiertas Express");
    if (filtered.length !== fronts.length) { cleaned = true; localStorage.setItem("freia_fronts", JSON.stringify(filtered)); }
  } catch { /* ignore */ }
  if (localStorage.getItem("freia_variant_types")) { cleaned = true; localStorage.removeItem("freia_variant_types"); }
  if (localStorage.getItem("freia_discounts")) { cleaned = true; localStorage.removeItem("freia_discounts"); }

  // Already seeded with current version — reload if we cleaned other data
  if (localStorage.getItem(SEED_KEY)) {
    if (cleaned) console.log("[seed-importador] cleaned other demo data");
    return cleaned;
  }
  console.log("[seed-importador] seeding v2 data...");

  try {
    // Upsert: remove items matching dedup key, then append fresh ones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsert = <T extends Record<string, any>>(
      key: string,
      items: T[],
      dedupField: keyof T = "id" as keyof T
    ) => {
      const existing: T[] = (() => {
        try {
          return JSON.parse(localStorage.getItem(key) ?? "[]");
        } catch {
          return [];
        }
      })();
      const seedKeys = new Set(items.map((i) => String(i[dedupField])));
      const kept = existing.filter((e) => !seedKeys.has(String(e[dedupField])));
      localStorage.setItem(key, JSON.stringify([...kept, ...items]));
    };

    // Remove old importador data by name (from previous versions)
    try {
      const flows = JSON.parse(localStorage.getItem("freia_flows") ?? "[]");
      localStorage.setItem("freia_flows", JSON.stringify(
        flows.filter((f: Record<string, unknown>) => f.name !== "Extracción de Precios — Importaciones")
      ));
    } catch { /* ignore */ }
    try {
      const agents = JSON.parse(localStorage.getItem("freia_agents") ?? "[]");
      localStorage.setItem("freia_agents", JSON.stringify(
        agents.filter((a: Record<string, unknown>) => a.name !== "Agente de Importaciones")
      ));
    } catch { /* ignore */ }
    try {
      const fronts = JSON.parse(localStorage.getItem("freia_fronts") ?? "[]");
      localStorage.setItem("freia_fronts", JSON.stringify(
        fronts.filter((f: Record<string, unknown>) => f.name !== "Panel de Importaciones")
      ));
    } catch { /* ignore */ }

    // Seed all data
    upsert("freia_products", PRODUCTS, "sku");
    upsert("freia_flows", [FLOW], "name");
    upsert("freia_agents", [AGENT], "name");
    upsert("freia_fronts", [FRONT], "name");

    // Seed supplier messages (separate key to avoid polluting WhatsApp outbound)
    localStorage.setItem("freia_import_messages", JSON.stringify(SUPPLIER_MESSAGES));

    localStorage.setItem(SEED_KEY, "1");
    console.log("[seed-importador] v2 done.");
    return true;
  } catch (err) {
    console.error("[seed-importador] error:", err);
    return false;
  }
}
