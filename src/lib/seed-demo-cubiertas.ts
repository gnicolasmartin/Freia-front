/**
 * seed-demo-cubiertas.ts
 *
 * Seeds localStorage with demo data for a tire (cubiertas) stock consultation agent.
 * Includes: variant types, products with variants, a consultation flow, an agent, and a front.
 *
 * Idempotent — checks a sentinel key before running.
 */

import type { Product, ProductVariant, VariantType, Discount } from "@/types/product";
import type { Flow, FlowNode, FlowEdge, FlowVariable } from "@/types/flow";
import type { Agent } from "@/types/agent";
import type { Front, FrontVersion, FrontPage, FrontSection } from "@/types/front";
import { DEFAULT_FRONT_AUTH_CONFIG } from "@/types/front-auth";

const SEED_KEY = "freia_seed_cubiertas_v17";
const COMPANY_ID = "company_cubiertas";

// ── helpers ──────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ── Variant Types ────────────────────────────────────────────────────────────

const vtColorId = uid();
const vtRodadoId = uid();

const VARIANT_TYPES: VariantType[] = [
  { id: vtColorId, name: "Color", key: "color", createdAt: now(), updatedAt: now() },
  { id: vtRodadoId, name: "Rodado", key: "rodado", createdAt: now(), updatedAt: now() },
];

// ── Discount ─────────────────────────────────────────────────────────────────

const discountId = uid();

const DISCOUNTS: Discount[] = [
  {
    id: discountId,
    name: "Promo x4 cubiertas",
    percentage: 10,
    description: "10% de descuento llevando 4 unidades del mismo modelo",
    createdAt: now(),
    updatedAt: now(),
  },
];

// ── Products (Cubiertas argentinas) ──────────────────────────────────────────

function makeVariants(
  sizes: { rodado: string; color?: string; sku: string; price?: number }[]
): ProductVariant[] {
  return sizes.map((s) => ({
    id: uid(),
    attributes: { color: s.color ?? "Negro", rodado: s.rodado },
    sku: s.sku,
    price: s.price,
    createdAt: now(),
  }));
}

const ts = now();

const PRODUCTS: Product[] = [
  // ── Pirelli ──
  {
    id: uid(),
    name: "Pirelli Cinturato P1",
    sku: "PIR-CP1",
    description: "Cubierta turismo 185/65 R15 88H. Excelente agarre en mojado, baja resistencia al rodamiento. Ideal para autos medianos y compactos.",
    brand: "Pirelli",
    model: "Cinturato P1",
    price: 89900,
    stock: 24,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R15", sku: "PIR-CP1-15", price: 89900 },
      { rodado: "R16", sku: "PIR-CP1-16", price: 109900 },
      { rodado: "R17", sku: "PIR-CP1-17", price: 129900 },
    ]),
    discountIds: [discountId],
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: uid(),
    name: "Pirelli Scorpion ATR",
    sku: "PIR-SATR",
    description: "Cubierta all-terrain 245/70 R16 111T. Para camionetas y SUVs, uso mixto asfalto/tierra. Refuerzo lateral.",
    brand: "Pirelli",
    model: "Scorpion ATR",
    price: 159900,
    stock: 12,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R15", sku: "PIR-SATR-15", price: 139900 },
      { rodado: "R16", sku: "PIR-SATR-16", price: 159900 },
      { rodado: "R17", sku: "PIR-SATR-17", price: 179900 },
      { rodado: "R16", color: "Negro letras blancas", sku: "PIR-SATR-16-LB", price: 169900 },
    ]),
    discountIds: [discountId],
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: uid(),
    name: "Pirelli P7 EVO",
    sku: "PIR-P7E",
    description: "Cubierta touring 205/55 R16 91V. Alta performance en ruta, confort de marcha y larga duración.",
    brand: "Pirelli",
    model: "P7 EVO",
    price: 119900,
    stock: 16,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R15", sku: "PIR-P7E-15", price: 99900 },
      { rodado: "R16", sku: "PIR-P7E-16", price: 119900 },
      { rodado: "R17", sku: "PIR-P7E-17", price: 139900 },
    ]),
    discountIds: [],
    createdAt: ts,
    updatedAt: ts,
  },

  // ── Bridgestone ──
  {
    id: uid(),
    name: "Bridgestone Turanza ER300",
    sku: "BRI-TER300",
    description: "Cubierta premium 195/55 R15 85H. Excelente frenado y estabilidad. Ideal para sedanes medianos.",
    brand: "Bridgestone",
    model: "Turanza ER300",
    price: 94900,
    stock: 20,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R15", sku: "BRI-TER300-15", price: 94900 },
      { rodado: "R16", sku: "BRI-TER300-16", price: 114900 },
    ]),
    discountIds: [discountId],
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: uid(),
    name: "Bridgestone Dueler H/T 684",
    sku: "BRI-DHT684",
    description: "Cubierta highway terrain 255/65 R17 110T. Para camionetas, uso ruta. Confort y durabilidad.",
    brand: "Bridgestone",
    model: "Dueler H/T 684",
    price: 174900,
    stock: 8,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R16", sku: "BRI-DHT684-16", price: 154900 },
      { rodado: "R17", sku: "BRI-DHT684-17", price: 174900 },
    ]),
    discountIds: [],
    createdAt: ts,
    updatedAt: ts,
  },

  // ── Firestone ──
  {
    id: uid(),
    name: "Firestone F-600",
    sku: "FIR-F600",
    description: "Cubierta económica 175/65 R14 82T. Buena tracción, precio accesible. Para autos chicos y medianos.",
    brand: "Firestone",
    model: "F-600",
    price: 64900,
    stock: 32,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R13", sku: "FIR-F600-13", price: 54900 },
      { rodado: "R14", sku: "FIR-F600-14", price: 64900 },
      { rodado: "R15", sku: "FIR-F600-15", price: 74900 },
    ]),
    discountIds: [discountId],
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: uid(),
    name: "Firestone Destination LE",
    sku: "FIR-DLE",
    description: "Cubierta SUV 215/65 R16 98T. Uso urbano y ruta, bajo ruido y buen rendimiento kilométrico.",
    brand: "Firestone",
    model: "Destination LE",
    price: 109900,
    stock: 14,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R15", sku: "FIR-DLE-15", price: 94900 },
      { rodado: "R16", sku: "FIR-DLE-16", price: 109900 },
      { rodado: "R17", sku: "FIR-DLE-17", price: 124900 },
    ]),
    discountIds: [],
    createdAt: ts,
    updatedAt: ts,
  },

  // ── Continental ──
  {
    id: uid(),
    name: "Continental PowerContact 2",
    sku: "CON-PC2",
    description: "Cubierta 185/65 R15 88H. Diseño alemán, excelente agarre en seco y mojado. Larga vida útil.",
    brand: "Continental",
    model: "PowerContact 2",
    price: 99900,
    stock: 18,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R14", sku: "CON-PC2-14", price: 84900 },
      { rodado: "R15", sku: "CON-PC2-15", price: 99900 },
      { rodado: "R16", sku: "CON-PC2-16", price: 119900 },
    ]),
    discountIds: [discountId],
    createdAt: ts,
    updatedAt: ts,
  },

  // ── Fate (marca argentina) ──
  {
    id: uid(),
    name: "Fate Eximia Pininfarina",
    sku: "FAT-EXPIN",
    description: "Cubierta premium argentina 205/55 R16 91V. Diseño Pininfarina, alta velocidad, excelente en lluvia.",
    brand: "Fate",
    model: "Eximia Pininfarina",
    price: 84900,
    stock: 22,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R14", sku: "FAT-EXPIN-14", price: 69900 },
      { rodado: "R15", sku: "FAT-EXPIN-15", price: 79900 },
      { rodado: "R16", sku: "FAT-EXPIN-16", price: 84900 },
      { rodado: "R17", sku: "FAT-EXPIN-17", price: 99900 },
    ]),
    discountIds: [discountId],
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: uid(),
    name: "Fate AR-35 Advance",
    sku: "FAT-AR35",
    description: "Cubierta económica 175/70 R13 82T. La más vendida de Argentina. Rendimiento confiable y precio accesible.",
    brand: "Fate",
    model: "AR-35 Advance",
    price: 52900,
    stock: 40,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R13", sku: "FAT-AR35-13", price: 52900 },
      { rodado: "R14", sku: "FAT-AR35-14", price: 62900 },
    ]),
    discountIds: [discountId],
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: uid(),
    name: "Fate Sentiva AR-360",
    sku: "FAT-S360",
    description: "Cubierta touring 185/65 R15 88H. Confort, silenciosa, buen kilometraje. Para uso diario.",
    brand: "Fate",
    model: "Sentiva AR-360",
    price: 72900,
    stock: 26,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R14", sku: "FAT-S360-14", price: 64900 },
      { rodado: "R15", sku: "FAT-S360-15", price: 72900 },
      { rodado: "R16", sku: "FAT-S360-16", price: 84900 },
    ]),
    discountIds: [],
    createdAt: ts,
    updatedAt: ts,
  },

  // ── Goodyear ──
  {
    id: uid(),
    name: "Goodyear EfficientGrip",
    sku: "GDY-EG",
    description: "Cubierta 195/55 R16 87V. Ahorro de combustible, bajo desgaste, excelente tracción. Para autos y sedanes.",
    brand: "Goodyear",
    model: "EfficientGrip",
    price: 104900,
    stock: 15,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R15", sku: "GDY-EG-15", price: 89900 },
      { rodado: "R16", sku: "GDY-EG-16", price: 104900 },
      { rodado: "R17", sku: "GDY-EG-17", price: 124900 },
    ]),
    discountIds: [],
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: uid(),
    name: "Goodyear Wrangler SUV",
    sku: "GDY-WSUV",
    description: "Cubierta SUV/camioneta 225/65 R17 102H. All-season, uso mixto urbano/ruta. Resistente y silenciosa.",
    brand: "Goodyear",
    model: "Wrangler SUV",
    price: 144900,
    stock: 10,
    unit: "unidad",
    category: "Cubiertas",
    variantTypeIds: [vtColorId, vtRodadoId],
    variants: makeVariants([
      { rodado: "R16", sku: "GDY-WSUV-16", price: 129900 },
      { rodado: "R17", sku: "GDY-WSUV-17", price: 144900 },
      { rodado: "R18", sku: "GDY-WSUV-18", price: 164900 },
    ]),
    discountIds: [discountId],
    createdAt: ts,
    updatedAt: ts,
  },
];

// ── Flow ─────────────────────────────────────────────────────────────────────

const flowId = uid();

const FLOW_VARIABLES: FlowVariable[] = [
  { id: uid(), name: "consulta_cliente", type: "string", description: "Lo que el cliente busca (marca, medida, rodado, etc.)" },
  { id: uid(), name: "segunda_consulta", type: "string", description: "Segunda búsqueda del cliente" },
  { id: uid(), name: "quiere_seguir", type: "string", description: "Respuesta si quiere buscar otro producto o consultar descuento" },
  { id: uid(), name: "post_descuento", type: "string", description: "Respuesta después de ver el descuento (buscar otra o terminar)" },
];

const nodes: FlowNode[] = [
  // ── Start ──
  {
    id: "start",
    type: "start",
    position: { x: 400, y: 30 },
    data: { label: "Inicio" },
    deletable: false,
  },
  // 1. Greeting
  {
    id: "n_saludo",
    type: "message",
    position: { x: 400, y: 140 },
    data: {
      label: "Saludo",
      message:
        "¡Hola! 👋 Bienvenido a *Cubiertas Express*.\nSoy tu asistente, te ayudo a encontrar la cubierta que necesitás.\n\nPodés decirme la marca, el modelo, la medida o el rodado y te digo si la tenemos y a qué precio.",
    },
  },
  // 2. Ask what they need
  {
    id: "n_ask_producto",
    type: "ask",
    position: { x: 400, y: 290 },
    data: {
      label: "¿Qué cubierta buscás?",
      message: "¿Qué cubierta estás buscando?",
      responseType: "text",
      variable: "consulta_cliente",
      maxRetries: 3,
      retryMessage: "No te entendí. Decime la marca o medida de la cubierta que necesitás, por ejemplo: \"Pirelli R15\" o \"Fate 175/70\".",
    },
  },
  // 3. Stock lookup
  {
    id: "n_stock",
    type: "stocklookup",
    position: { x: 400, y: 450 },
    data: {
      label: "Buscar Producto",
      searchMode: "variable",
      searchVariable: "consulta_cliente",
      searchLiteral: "",
      saveProductId: "",
      saveProductName: "",
      saveVariantId: "",
      savePrice: "",
      saveFinalPrice: "",
      saveDiscounts: "",
    },
  },
  // 4a. Found — show product
  {
    id: "n_encontrado",
    type: "message",
    position: { x: 200, y: 640 },
    data: {
      label: "Producto encontrado",
      message:
        "✅ ¡Tenemos lo que buscás!\n\n*{{product.name}}*\nCódigo: {{product.sku}}\nPrecio: ${{product.price}}\nStock disponible: {{product.stock}} unidades\n\n¿Querés buscar otra cubierta, consultar por algún descuento, o eso es todo?",
    },
  },
  // 4b. Not found
  {
    id: "n_no_encontrado",
    type: "message",
    position: { x: 600, y: 640 },
    data: {
      label: "No encontrado",
      message:
        "😕 No encontré esa cubierta en nuestro stock.\n\nTenemos: Pirelli, Bridgestone, Firestone, Continental, Fate y Goodyear en rodados R13 a R18.\n\n¿Querés buscar otra cubierta o eso es todo?",
    },
  },
  // 5. Ask next action
  {
    id: "n_ask_seguir",
    type: "ask",
    position: { x: 400, y: 830 },
    data: {
      label: "¿Qué hacemos?",
      message: "",
      responseType: "text",
      variable: "quiere_seguir",
      maxRetries: 2,
      retryMessage: "Podés decirme \"otra\" para buscar otra cubierta, \"descuento\" para ver promos, o \"no\" para terminar.",
    },
  },
  // 6. Condition: descuento / no / sí / default=búsqueda directa
  {
    id: "n_cond_seguir",
    type: "condition",
    position: { x: 400, y: 990 },
    data: {
      label: "¿Qué quiere?",
      rules: [
        {
          id: uid(),
          label: "Pregunta descuento",
          variable: "quiere_seguir",
          operator: "matches",
          value: "descuento|promo|promocion|promoción|oferta|rebaja|precio especial|cuotas|financiación|financiacion|hay algo|tienen algo|precio|hacés|haces|bonificacion|bonificación|menos|baja|mejor precio|sale menos",
        },
        {
          id: uid(),
          label: "No / terminar",
          variable: "quiere_seguir",
          operator: "matches",
          value: "no|nah|nop|chau|listo|eso es todo|nada más|nada mas|gracias|terminar",
        },
        {
          id: uid(),
          label: "Buscar otra",
          variable: "quiere_seguir",
          operator: "matches",
          value: "si|sí|dale|va|ok|bueno|otra|yes|buscar",
        },
      ],
    },
  },

  // ── Branch A: Descuento ──
  {
    id: "n_descuento",
    type: "message",
    position: { x: 50, y: 1160 },
    data: {
      label: "Info descuento",
      message:
        "🏷️ ¡Tenemos una promo!\n\n*Promo x4 cubiertas*: llevando 4 unidades del mismo modelo te hacemos un *10% de descuento*.\n\nAplica para: Pirelli Cinturato P7, Continental PowerContact 2, Fate Eximia Pininfarina, Fate AR-35 Advance y Goodyear Wrangler SUV.\n\n¿Querés buscar otra cubierta o eso es todo?",
    },
  },
  {
    id: "n_ask_post_desc",
    type: "ask",
    position: { x: 50, y: 1340 },
    data: {
      label: "¿Buscar otra?",
      message: "",
      responseType: "text",
      variable: "post_descuento",
      maxRetries: 2,
      retryMessage: "Respondé \"sí\" para buscar otra cubierta o \"no\" para terminar.",
    },
  },
  {
    id: "n_cond_post_desc",
    type: "condition",
    position: { x: 50, y: 1500 },
    data: {
      label: "¿Sigue después del descuento?",
      rules: [
        {
          id: uid(),
          label: "No / terminar",
          variable: "post_descuento",
          operator: "matches",
          value: "no|nah|nop|chau|listo|eso es todo|nada más|nada mas|gracias|terminar",
        },
        {
          id: uid(),
          label: "Sí",
          variable: "post_descuento",
          operator: "matches",
          value: "si|sí|dale|va|ok|bueno|otra|yes|buscar",
        },
      ],
    },
  },

  // ── Branch B: Otra búsqueda (explícita con "sí") ──
  {
    id: "n_ask_producto2",
    type: "ask",
    position: { x: 300, y: 1680 },
    data: {
      label: "Segunda búsqueda",
      message: "Dale, decime qué otra cubierta buscás:",
      responseType: "text",
      variable: "segunda_consulta",
      maxRetries: 3,
      retryMessage: "Decime la marca o medida, ej: \"Bridgestone R16\" o \"Fate 175/70\".",
    },
  },
  {
    id: "n_stock2",
    type: "stocklookup",
    position: { x: 300, y: 1840 },
    data: {
      label: "Buscar Producto (2)",
      searchMode: "variable",
      searchVariable: "segunda_consulta",
      searchLiteral: "",
      saveProductId: "",
      saveProductName: "",
      saveVariantId: "",
      savePrice: "",
      saveFinalPrice: "",
      saveDiscounts: "",
    },
  },

  // ── Branch D: Búsqueda directa (el usuario ya escribió el producto) ──
  {
    id: "n_stock_direct",
    type: "stocklookup",
    position: { x: 600, y: 1680 },
    data: {
      label: "Búsqueda directa",
      searchMode: "variable",
      searchVariable: "quiere_seguir",
      searchLiteral: "",
      saveProductId: "",
      saveProductName: "",
      saveVariantId: "",
      savePrice: "",
      saveFinalPrice: "",
      saveDiscounts: "",
    },
  },
  // Búsqueda directa desde post-descuento
  {
    id: "n_stock_post_desc_direct",
    type: "stocklookup",
    position: { x: -150, y: 1680 },
    data: {
      label: "Búsqueda directa (post desc)",
      searchMode: "variable",
      searchVariable: "post_descuento",
      searchLiteral: "",
      saveProductId: "",
      saveProductName: "",
      saveVariantId: "",
      savePrice: "",
      saveFinalPrice: "",
      saveDiscounts: "",
    },
  },

  // ── Resultados compartidos ──
  {
    id: "n_encontrado2",
    type: "message",
    position: { x: 250, y: 2020 },
    data: {
      label: "Encontrado (2)",
      message:
        "✅ ¡También tenemos esta!\n\n*{{product.name}}*\nCódigo: {{product.sku}}\nPrecio: ${{product.price}}\nStock: {{product.stock}} unidades\n\nSi necesitás más info, escribinos de nuevo. ¡Buenas rutas! 🙌",
    },
  },
  {
    id: "n_no_encontrado2",
    type: "message",
    position: { x: 550, y: 2020 },
    data: {
      label: "No encontrado (2)",
      message:
        "😕 Tampoco encontré esa. Probá consultarnos de nuevo con otra marca o medida.\n\n¡Gracias por consultarnos! 🙌",
    },
  },

  // ── Branch C: No / Despedida ──
  {
    id: "n_despedida",
    type: "message",
    position: { x: 650, y: 1340 },
    data: {
      label: "Despedida",
      message: "¡Gracias por consultarnos! 🙌\nCualquier cosa, escribinos de nuevo. ¡Buenas rutas!",
    },
  },

  // ── End nodes ──
  {
    id: "n_end",
    type: "end",
    position: { x: 650, y: 1500 },
    data: { label: "Fin", outcome: "resolved" },
  },
  {
    id: "n_end2",
    type: "end",
    position: { x: 250, y: 2180 },
    data: { label: "Fin (encontrado)", outcome: "resolved" },
  },
  {
    id: "n_end3",
    type: "end",
    position: { x: 550, y: 2180 },
    data: { label: "Fin (no encontrado)", outcome: "resolved" },
  },
];

const edges: FlowEdge[] = [
  // Main trunk
  { id: uid(), source: "start", target: "n_saludo", type: "smoothstep" },
  { id: uid(), source: "n_saludo", target: "n_ask_producto", type: "smoothstep" },
  { id: uid(), source: "n_ask_producto", target: "n_stock", type: "smoothstep" },
  // Stock lookup → found / not found
  { id: uid(), source: "n_stock", sourceHandle: "found", target: "n_encontrado", type: "smoothstep" },
  { id: uid(), source: "n_stock", sourceHandle: "not_found", target: "n_no_encontrado", type: "smoothstep" },
  // Both paths → ask next action
  { id: uid(), source: "n_encontrado", target: "n_ask_seguir", type: "smoothstep" },
  { id: uid(), source: "n_no_encontrado", target: "n_ask_seguir", type: "smoothstep" },
  // Ask → condition
  { id: uid(), source: "n_ask_seguir", target: "n_cond_seguir", type: "smoothstep" },

  // ── n_cond_seguir branches ──
  // rule-0: descuento
  { id: uid(), source: "n_cond_seguir", sourceHandle: "rule-0", target: "n_descuento", type: "smoothstep" },
  // rule-1: no / terminar → despedida
  { id: uid(), source: "n_cond_seguir", sourceHandle: "rule-1", target: "n_despedida", type: "smoothstep" },
  // rule-2: sí → ask segunda búsqueda
  { id: uid(), source: "n_cond_seguir", sourceHandle: "rule-2", target: "n_ask_producto2", type: "smoothstep" },
  // default: direct search (user typed a product name)
  { id: uid(), source: "n_cond_seguir", sourceHandle: "default", target: "n_stock_direct", type: "smoothstep" },

  // ── Branch A: Descuento flow ──
  { id: uid(), source: "n_descuento", target: "n_ask_post_desc", type: "smoothstep" },
  { id: uid(), source: "n_ask_post_desc", target: "n_cond_post_desc", type: "smoothstep" },
  // n_cond_post_desc: rule-0=no → despedida, rule-1=sí → ask_producto2, default=direct search
  { id: uid(), source: "n_cond_post_desc", sourceHandle: "rule-0", target: "n_despedida", type: "smoothstep" },
  { id: uid(), source: "n_cond_post_desc", sourceHandle: "rule-1", target: "n_ask_producto2", type: "smoothstep" },
  { id: uid(), source: "n_cond_post_desc", sourceHandle: "default", target: "n_stock_post_desc_direct", type: "smoothstep" },

  // ── Branch B: Explicit second search ──
  { id: uid(), source: "n_ask_producto2", target: "n_stock2", type: "smoothstep" },
  { id: uid(), source: "n_stock2", sourceHandle: "found", target: "n_encontrado2", type: "smoothstep" },
  { id: uid(), source: "n_stock2", sourceHandle: "not_found", target: "n_no_encontrado2", type: "smoothstep" },

  // ── Branch D: Direct search from main condition ──
  { id: uid(), source: "n_stock_direct", sourceHandle: "found", target: "n_encontrado2", type: "smoothstep" },
  { id: uid(), source: "n_stock_direct", sourceHandle: "not_found", target: "n_no_encontrado2", type: "smoothstep" },

  // ── Branch E: Direct search from post-discount ──
  { id: uid(), source: "n_stock_post_desc_direct", sourceHandle: "found", target: "n_encontrado2", type: "smoothstep" },
  { id: uid(), source: "n_stock_post_desc_direct", sourceHandle: "not_found", target: "n_no_encontrado2", type: "smoothstep" },

  // ── Shared endings ──
  { id: uid(), source: "n_encontrado2", target: "n_end2", type: "smoothstep" },
  { id: uid(), source: "n_no_encontrado2", target: "n_end3", type: "smoothstep" },
  { id: uid(), source: "n_despedida", target: "n_end", type: "smoothstep" },
];

const FLOW: Flow = {
  id: flowId,
  companyId: COMPANY_ID,
  name: "Consulta de Stock — Cubiertas",
  description: "Flujo de atención para consulta de stock y precios de cubiertas. El agente saluda, pregunta qué cubierta busca el cliente, consulta el catálogo y responde con precio y disponibilidad.",
  status: "active",
  nodes,
  edges,
  variables: FLOW_VARIABLES,
  policyIds: [],
  allowedToolIds: [],
  useStock: true,
  createdAt: ts,
  updatedAt: ts,
  versions: [],
  testPresets: [],
};

// ── Agent ────────────────────────────────────────────────────────────────────

const agentId = uid();

const AGENT: Agent = {
  id: agentId,
  companyId: COMPANY_ID,
  name: "Asistente Cubiertas Express",
  description: "Agente de atención por web chat para consulta de stock y precios de cubiertas. Entiende lenguaje coloquial argentino y responde rápido con info de producto.",
  status: "active",
  channelScope: "web",
  flowId,
  mode: "flow-driven",
  primaryObjective: "resolver_consulta",
  kpiType: "tiempo_respuesta",
  kpiTarget: 15,
  llmProvider: "openai",
  modelName: "gpt-4o",
  temperature: 0.5,
  maxTokens: 512,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  tone: "cercano",
  responseLength: "corta",
  emojiUsage: "moderado",
  language: "es_ar",
  policyScope: "inherited",
  allowOverride: false,
  whatsappOutbound: false,
  createdAt: ts,
  updatedAt: ts,
};

// ── Front ─────────────────────────────────────────────────────────────────────

const frontId = uid();

const consultasPorModelo: { label: string; value: number }[] = [
  { label: "Cinturato P1", value: 18 },
  { label: "Scorpion ATR", value: 12 },
  { label: "P7 EVO", value: 9 },
  { label: "Turanza ER300", value: 14 },
  { label: "F-600", value: 22 },
  { label: "Eximia Pin.", value: 16 },
  { label: "AR-35 Adv.", value: 25 },
  { label: "Sentiva 360", value: 11 },
  { label: "EfficientGrip", value: 8 },
  { label: "Wrangler SUV", value: 13 },
];

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
        title: "Cubiertas Express",
        content: "Gestioná tu stock de cubiertas y consultá disponibilidad en tiempo real.",
      },
      {
        id: uid(),
        type: "chat",
        title: "Consulta de Stock",
        agentId,
      },
      {
        id: uid(),
        type: "chart_bar",
        title: "Consultas del día por modelo",
        config: {
          data: consultasPorModelo,
          _chart: {
            xAxisLabel: "Modelo",
            yAxisLabel: "Consultas",
            showLegend: false,
          },
        },
      },
    ],
  },
  {
    id: uid(),
    slug: "stock",
    title: "Stock",
    order: 1,
    sections: [
      {
        id: uid(),
        type: "stock_list",
        title: "Catálogo de cubiertas",
      },
      {
        id: uid(),
        type: "stock_form",
        title: "Agregar producto",
        requiredPermission: "operate_stock",
        config: {
          _stockForm: {
            autoGenerateSku: false,
            showOptionalFields: true,
            successMessage: "Cubierta agregada al catálogo.",
          },
        },
      },
    ],
  },
];

const frontVersionId = uid();

const frontSnapshot = {
  name: "Cubiertas Express",
  description: "Front de gestión de stock y consulta de cubiertas para Cubiertas Express.",
  subdomain: "cubiertas",
  branding: { primaryColor: "#dd7430" } as Front["branding"],
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
  publishedBy: "demo@freia.ai",
};

const FRONT: Front = {
  id: frontId,
  companyId: COMPANY_ID,
  name: "Cubiertas Express",
  description: "Front de gestión de stock y consulta de cubiertas para Cubiertas Express.",
  status: "published",
  subdomain: "cubiertas",
  branding: { primaryColor: "#dd7430" },
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

// All past sentinel keys — clean them up so the latest seed always runs
const OLD_SEED_KEYS = [
  "freia_seed_cubiertas_v1",
  "freia_seed_cubiertas_v2",
  "freia_seed_cubiertas_v3",
  "freia_seed_cubiertas_v4",
  "freia_seed_cubiertas_v5",
  "freia_seed_cubiertas_v6",
  "freia_seed_cubiertas_v7",
  "freia_seed_cubiertas_v8",
  "freia_seed_cubiertas_v9",
  "freia_seed_cubiertas_v10",
  "freia_seed_cubiertas_v11",
  "freia_seed_cubiertas_v12",
  "freia_seed_cubiertas_v13",
  "freia_seed_cubiertas_v14",
  "freia_seed_cubiertas_v15",
  "freia_seed_cubiertas_v16",
];

export function seedDemoCubiertas(): boolean {
  if (typeof window === "undefined") return false;

  // Clean up old sentinels so version bump forces re-seed
  for (const k of OLD_SEED_KEYS) localStorage.removeItem(k);

  // Invalidate other demos' sentinels so they can re-seed when switching back
  localStorage.removeItem("freia_seed_importador_v3");
  localStorage.removeItem("freia_seed_rincon_v1");
  localStorage.removeItem("freia_seed_rincon_v2");
  localStorage.removeItem("freia_seed_rincon_v3");
  localStorage.removeItem("freia_seed_rincon_v4");
  localStorage.removeItem("freia_seed_rincon_v5");
  localStorage.removeItem("freia_seed_rincon_v6");
  localStorage.removeItem("freia_seed_rincon_v7");
  localStorage.removeItem("freia_seed_rincon_v8");
  localStorage.removeItem("freia_seed_rincon_v9");
  localStorage.removeItem("freia_seed_rincon_v10");

  // ALWAYS clean other demo's data (runs even if already seeded)
  let cleaned = false;
  try {
    const products = JSON.parse(localStorage.getItem("freia_products") ?? "[]");
    const filtered = products.filter((p: Record<string, unknown>) => typeof p.sku !== "string" || !(p.sku as string).startsWith("IMP-"));
    if (filtered.length !== products.length) { cleaned = true; localStorage.setItem("freia_products", JSON.stringify(filtered)); }
  } catch { /* ignore */ }
  try {
    const flows0 = JSON.parse(localStorage.getItem("freia_flows") ?? "[]");
    const filtered = flows0.filter((f: Record<string, unknown>) => f.name !== "Extracción de Precios — Importaciones");
    if (filtered.length !== flows0.length) { cleaned = true; localStorage.setItem("freia_flows", JSON.stringify(filtered)); }
  } catch { /* ignore */ }
  try {
    const agents0 = JSON.parse(localStorage.getItem("freia_agents") ?? "[]");
    const filtered = agents0.filter((a: Record<string, unknown>) => a.name !== "Agente de Importaciones");
    if (filtered.length !== agents0.length) { cleaned = true; localStorage.setItem("freia_agents", JSON.stringify(filtered)); }
  } catch { /* ignore */ }
  try {
    const fronts0 = JSON.parse(localStorage.getItem("freia_fronts") ?? "[]");
    const filtered = fronts0.filter((f: Record<string, unknown>) => f.name !== "Panel de Importaciones");
    if (filtered.length !== fronts0.length) { cleaned = true; localStorage.setItem("freia_fronts", JSON.stringify(filtered)); }
  } catch { /* ignore */ }
  if (localStorage.getItem("freia_import_messages")) { cleaned = true; localStorage.removeItem("freia_import_messages"); }

  // Clean rincon demo data (by companyId + name fallback for legacy data)
  const RINCON_NAMES = [
    "Asistente Quintas El Rincón", "Consulta de Disponibilidad — Quintas",
    "Quintas El Rincón de Mi Mundo", "Quintas El Rincón",
  ];
  try {
    const rinconCompanyId = "company_rincon";
    // Collect calendar IDs BEFORE cleaning calendars
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rinconCalendarIds = new Set((JSON.parse(localStorage.getItem("freia_calendars") ?? "[]") as any[]).filter((c) => c.companyId === rinconCompanyId || (!c.companyId && RINCON_NAMES.includes(c.name))).map((c) => c.id));

    for (const key of ["freia_flows", "freia_agents", "freia_fronts", "freia_calendars"]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arr: any[] = JSON.parse(localStorage.getItem(key) ?? "[]");
      const filtered = arr.filter((item) => item.companyId !== rinconCompanyId && !((!item.companyId) && RINCON_NAMES.includes(item.name)));
      if (filtered.length !== arr.length) { cleaned = true; localStorage.setItem(key, JSON.stringify(filtered)); }
    }
    if (rinconCalendarIds.size > 0) {
      for (const key of ["freia_calendar_resources", "freia_calendar_blocks", "freia_calendar_min_stay_rules", "freia_bookings"]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arr: any[] = JSON.parse(localStorage.getItem(key) ?? "[]");
        const filtered = arr.filter((item) => !rinconCalendarIds.has(item.calendarId));
        if (filtered.length !== arr.length) { cleaned = true; localStorage.setItem(key, JSON.stringify(filtered)); }
      }
    }
  } catch { /* ignore */ }

  // Already seeded with current version — reload if we cleaned other data
  if (localStorage.getItem(SEED_KEY)) {
    if (cleaned) console.log("[seed-demo] cleaned other demo data");
    return cleaned;
  }
  console.log("[seed-demo] seeding v16 data...");

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

    // Remove old flow/agent/front by name first (from previous versions with cycles)
    try {
      const flows = JSON.parse(localStorage.getItem("freia_flows") ?? "[]");
      localStorage.setItem("freia_flows", JSON.stringify(
        flows.filter((f: Record<string, unknown>) => f.name !== "Consulta de Stock — Cubiertas")
      ));
    } catch { /* ignore */ }
    try {
      const agents = JSON.parse(localStorage.getItem("freia_agents") ?? "[]");
      localStorage.setItem("freia_agents", JSON.stringify(
        agents.filter((a: Record<string, unknown>) => a.name !== "Asistente Cubiertas Express")
      ));
    } catch { /* ignore */ }
    try {
      const fronts = JSON.parse(localStorage.getItem("freia_fronts") ?? "[]");
      localStorage.setItem("freia_fronts", JSON.stringify(
        fronts.filter((f: Record<string, unknown>) => f.name !== "Cubiertas Express")
      ));
    } catch { /* ignore */ }

    // Seed all data (stamp companyId on products)
    upsert("freia_variant_types", VARIANT_TYPES, "key");
    upsert("freia_discounts", DISCOUNTS, "name");
    upsert("freia_products", PRODUCTS.map((p) => ({ ...p, companyId: COMPANY_ID })), "sku");
    upsert("freia_flows", [FLOW], "name");
    upsert("freia_agents", [AGENT], "name");
    upsert("freia_fronts", [FRONT], "name");

    // Seed demo conversations for dashboard metrics
    const now = new Date();
    const ago = (mins: number) => new Date(now.getTime() - mins * 60000).toISOString();
    const demoConversations = [
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_end", vars: { "contact.phone": "+5491155550001", "contact.name": "María López", channel: "whatsapp", "message.text": "Hola, busco una cubierta 205/55 R16", consulta_cliente: "cubierta 205/55 R16", "product.name": "Cubierta Bridgestone Turanza T005 205/55 R16", "product.brand": "Bridgestone", "product.price": "89500" }, varTimestamps: {}, status: "completed" as const, startedAt: ago(180), lastActivityAt: ago(175), retryCount: {}, toolExecutionLogs: [{ nodeId: "n_stock", tool: "stock_lookup", timestamp: ago(178), request: { query: "205/55 R16" }, response: { status: "found" }, durationMs: 120 }], messages: [] },
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_end", vars: { "contact.phone": "+5491155550002", "contact.name": "Carlos Ruiz", channel: "whatsapp", "message.text": "Necesito cubiertas para mi camioneta", consulta_cliente: "cubiertas camioneta", "product.name": "Cubierta Pirelli Scorpion ATR 245/70 R16", "product.brand": "Pirelli" }, varTimestamps: {}, status: "completed" as const, startedAt: ago(300), lastActivityAt: ago(288), retryCount: {}, toolExecutionLogs: [{ nodeId: "n_stock", tool: "stock_lookup", timestamp: ago(298), request: { query: "camioneta 245/70" }, response: { status: "found" }, durationMs: 95 }], messages: [] },
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_end", vars: { "contact.phone": "+5491155550003", "contact.name": "Ana García", channel: "whatsapp", "message.text": "Precio de Michelin 195/65 R15?", consulta_cliente: "michelin 195/65 R15" }, varTimestamps: {}, status: "completed" as const, startedAt: ago(420), lastActivityAt: ago(414), retryCount: {}, toolExecutionLogs: [{ nodeId: "n_stock", tool: "stock_lookup", timestamp: ago(418), request: { query: "Michelin 195/65 R15" }, response: { status: "found" }, durationMs: 110 }], messages: [] },
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_ask_consulta", vars: { "contact.phone": "+5491155550004", "contact.name": "Roberto Díaz", channel: "whatsapp", "message.text": "Hola buenas tardes" }, varTimestamps: {}, status: "abandoned" as const, startedAt: ago(150), lastActivityAt: ago(145), retryCount: {}, toolExecutionLogs: [], messages: [] },
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_stock", vars: { "contact.phone": "+5491155550005", "contact.name": "", channel: "whatsapp", "message.text": "Tienen cubiertas baratas?", consulta_cliente: "cubiertas baratas" }, varTimestamps: {}, status: "abandoned" as const, startedAt: ago(500), lastActivityAt: ago(490), retryCount: {}, toolExecutionLogs: [], messages: [] },
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_saludo", vars: { "contact.phone": "+5491155550006", "contact.name": "Laura Fernández", channel: "whatsapp", "message.text": "Hola!", consulta_cliente: "bridgestone" }, varTimestamps: {}, status: "active" as const, startedAt: ago(5), lastActivityAt: ago(2), retryCount: {}, toolExecutionLogs: [], messages: [] },
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_end", vars: { "contact.phone": "+5491155550007", "contact.name": "Pedro Gómez", channel: "whatsapp", "message.text": "Busco run flat 225/45 R17", consulta_cliente: "run flat 225/45 R17", "product.name": "Cubierta Continental ContiSportContact 5 225/45 R17" }, varTimestamps: {}, status: "completed" as const, startedAt: ago(60), lastActivityAt: ago(52), retryCount: {}, toolExecutionLogs: [{ nodeId: "n_stock", tool: "stock_lookup", timestamp: ago(58), request: { query: "run flat 225/45 R17" }, response: { status: "found" }, durationMs: 88 }], messages: [] },
    ];
    upsert("freia_conversations", demoConversations);

    // Seed demo audit log entries
    const demoAudit = [
      { id: uid(), timestamp: ago(2), type: "agent_status_change", agentId, agentName: AGENT.name, previousStatus: "paused", newStatus: "active" },
      { id: uid(), timestamp: ago(30), type: "front_published", frontId: uid(), frontName: FRONT.name, subdomain: FRONT.subdomain, version: 1, performedBy: "admin" },
      { id: uid(), timestamp: ago(120), type: "agent_status_change", agentId, agentName: AGENT.name, previousStatus: "draft", newStatus: "active" },
    ];
    upsert("freia_audit_log", demoAudit);

    localStorage.setItem(SEED_KEY, "1");
    console.log("[seed-demo] v16 done. flows:", JSON.parse(localStorage.getItem("freia_flows") ?? "[]").length, "agents:", JSON.parse(localStorage.getItem("freia_agents") ?? "[]").length, "fronts:", JSON.parse(localStorage.getItem("freia_fronts") ?? "[]").length);
    return true;
  } catch (err) {
    console.error("[seed-demo] error:", err);
    return false;
  }
}
