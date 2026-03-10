/**
 * seed-demo-rincon.ts
 *
 * Seeds localStorage with demo data for "Quintas El Rincón de Mi Mundo",
 * a vacation rental business with 3 quintas near Buenos Aires.
 *
 * Includes: calendars + resources + blocked periods + min stay rules,
 * an availability consultation flow, an agent, FAQ policies, and a front
 * with calendar booking widget.
 *
 * Idempotent — checks a sentinel key before running.
 */

import type { Flow, FlowNode, FlowEdge, FlowVariable } from "@/types/flow";
import type { Agent } from "@/types/agent";
import type { Front, FrontVersion, FrontPage } from "@/types/front";
import { DEFAULT_FRONT_AUTH_CONFIG } from "@/types/front-auth";
import type {
  Calendar,
  CalendarResource,
  BlockedPeriod,
  MinimumStayRule,
  Booking,
} from "@/types/calendar";
import { DEFAULT_SCHEDULE } from "@/types/calendar";

const SEED_KEY = "freia_seed_rincon_v10";
const COMPANY_ID = "company_rincon";

// ── helpers ──────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const ts = now();

// ── Calendars ────────────────────────────────────────────────────────────────

const calendarId = uid();

const CALENDAR: Calendar = {
  id: calendarId,
  companyId: COMPANY_ID,
  name: "Quintas El Rincón",
  description: "Calendario de disponibilidad para las 3 quintas de alquiler temporario",
  bookingMode: "daily",
  timezone: "America/Argentina/Buenos_Aires",
  slotDurationMinutes: 60,
  bufferMinutes: 0,
  maxAdvanceDays: 180,
  schedule: {
    ...DEFAULT_SCHEDULE,
    monday:    { enabled: true, start: "10:00", end: "22:00" },
    tuesday:   { enabled: true, start: "10:00", end: "22:00" },
    wednesday: { enabled: true, start: "10:00", end: "22:00" },
    thursday:  { enabled: true, start: "10:00", end: "22:00" },
    friday:    { enabled: true, start: "10:00", end: "22:00" },
    saturday:  { enabled: true, start: "10:00", end: "22:00" },
    sunday:    { enabled: true, start: "10:00", end: "22:00" },
  },
  active: true,
  createdAt: ts,
  updatedAt: ts,
};

// ── Resources (3 quintas) ────────────────────────────────────────────────────

const resRincon1Id = uid();
const resRincon2Id = uid();
const resAmorosaId = uid();

const RESOURCES: CalendarResource[] = [
  {
    id: resRincon1Id,
    calendarId,
    name: "El Rincón de Mi Mundo",
    description: "Quinta principal. 3 habitaciones (2 matrimoniales en suite + 1 con 5 plazas). Pileta 12x4m, parque 3.500m², quincho cerrado con cocina completa y parrilla, quincho abierto, cancha de fútbol y vóley. DirecTV, WiFi, vajilla para 10, mobiliario para 30.",
    capacity: 1,
    metadata: {
      capacidad_personas: "10",
      pileta: "12m x 4m",
      parque: "3.500 m²",
      habitaciones: "3 (2 matrimoniales en suite + 1 con 5 plazas)",
      mascotas: "Sí (excepto razas agresivas)",
      musica: "Hasta las 21hs, volumen moderado",
    },
    active: true,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: resRincon2Id,
    calendarId,
    name: "El Rincón II",
    description: "Segunda quinta. 3 dormitorios (2 matrimoniales en suite + 1 con camas marineras). Pileta 8x4m, parque 3.500m², quincho techado con parrilla, 4 baños. DirecTV con fútbol, WiFi, vajilla para 10, espacio para 30 personas.",
    capacity: 1,
    metadata: {
      capacidad_personas: "10",
      pileta: "8m x 4m",
      parque: "3.500 m²",
      habitaciones: "3 (2 matrimoniales en suite + 1 marineras)",
      banos: "4 (incluido exterior para bañistas)",
      mascotas: "Sí (excepto razas agresivas)",
      musica: "Hasta las 21hs, volumen moderado",
    },
    active: true,
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: resAmorosaId,
    calendarId,
    name: "La Amorosa",
    description: "Quinta premium a 30 minutos de CABA. Refugio de paz y belleza para momentos especiales. Ideal para visitas de día, celebraciones íntimas, escapadas de fin de semana y estadías vacacionales.",
    capacity: 1,
    metadata: {
      ubicacion: "30 minutos de Buenos Aires (CABA)",
      ideal_para: "Visitas de día, celebraciones, fines de semana, vacaciones",
      mascotas: "Consultar",
    },
    active: true,
    createdAt: ts,
    updatedAt: ts,
  },
];

// ── Blocked Periods (feriados 2026) ──────────────────────────────────────────

const BLOCKED_PERIODS: BlockedPeriod[] = [
  {
    id: uid(), calendarId, resourceId: null,
    name: "Navidad y Año Nuevo",
    startDate: "2026-12-24", endDate: "2026-12-26",
    recurring: true,
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), calendarId, resourceId: null,
    name: "Carnaval",
    startDate: "2026-02-16", endDate: "2026-02-17",
    recurring: false,
    createdAt: ts, updatedAt: ts,
  },
];

// ── Min Stay Rules ───────────────────────────────────────────────────────────

const MIN_STAY_RULES: MinimumStayRule[] = [
  {
    id: uid(), calendarId,
    name: "Temporada alta verano — mínimo 7 días",
    startDate: "2026-12-15", endDate: "2027-02-28",
    minimumUnits: 7, unitType: "days",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), calendarId,
    name: "Semana Santa — mínimo 3 días",
    startDate: "2026-03-29", endDate: "2026-04-05",
    minimumUnits: 3, unitType: "days",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), calendarId,
    name: "Fines de semana largo — mínimo 2 días",
    startDate: "2026-01-01", endDate: "2026-12-31",
    minimumUnits: 2, unitType: "days",
    createdAt: ts, updatedAt: ts,
  },
];

// ── Sample Bookings ──────────────────────────────────────────────────────────

const BOOKINGS: Booking[] = [
  {
    id: uid(), calendarId, resourceId: resRincon1Id,
    startDate: "2026-03-20", endDate: "2026-03-25",
    contactName: "Familia González", contactPhone: "+54 9 11 5555-1234",
    contactEmail: "gonzalez.fam@gmail.com",
    notes: "Llegan a las 14hs. 2 adultos + 3 niños.",
    status: "confirmed", confirmationCode: "BK-R1A3",
    source: "manual",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), calendarId, resourceId: resRincon2Id,
    startDate: "2026-03-15", endDate: "2026-03-17",
    contactName: "Carlos Pérez", contactPhone: "+54 9 11 4444-5678",
    status: "confirmed", confirmationCode: "BK-R2B7",
    source: "front",
    createdAt: ts, updatedAt: ts,
  },
  {
    id: uid(), calendarId, resourceId: resAmorosaId,
    startDate: "2026-04-01", endDate: "2026-04-05",
    contactName: "María Rodríguez", contactEmail: "maria.r@hotmail.com",
    notes: "Celebración de cumpleaños. 8 personas.",
    status: "pending", confirmationCode: "BK-LA1F",
    source: "flow",
    createdAt: ts, updatedAt: ts,
  },
];

// ── Flow ─────────────────────────────────────────────────────────────────────

const flowId = uid();

const FLOW_VARIABLES: FlowVariable[] = [
  { id: uid(), name: "consulta_cliente", type: "string", description: "Lo que el cliente pregunta o necesita (disponibilidad, búsqueda, fechas, etc.). Se reutiliza en cada turno de conversación." },
];

const nodes: FlowNode[] = [
  {
    id: "start",
    type: "start",
    position: { x: 400, y: 30 },
    data: { label: "Inicio" },
    deletable: false,
  },
  {
    id: "n_saludo",
    type: "message",
    position: { x: 400, y: 140 },
    data: {
      label: "Saludo",
      message:
        "¡Hola! 🏡 Bienvenido a *Quintas El Rincón de Mi Mundo*.\nSoy tu asistente virtual.\n\nTenemos 3 quintas hermosas para alquilar:\n\n🌳 *El Rincón de Mi Mundo*\nPileta grande (12x4m), 3 habitaciones, parque de 3.500m²\n\n🏊 *El Rincón II*\nIdeal para dos familias, 4 baños, pileta 8x4m\n\n✨ *La Amorosa*\nA 30 min de CABA, ideal para celebraciones íntimas\n\nPodés preguntarme por disponibilidad, buscar una quinta según lo que necesitás, o consultar sobre amenities y reglas. ¿En qué te puedo ayudar?",
    },
  },
  // ── Consulta abierta ──
  {
    id: "n_ask_consulta",
    type: "ask",
    position: { x: 400, y: 340 },
    data: {
      label: "¿Qué necesitás?",
      message: "",
      responseType: "text",
      variable: "consulta_cliente",
      maxRetries: 3,
      retryMessage: "Podés preguntarme cosas como:\n• \"¿Hay disponibilidad en febrero?\"\n• \"Busco una quinta con pileta grande para 15 personas\"\n• \"¿Qué quintas tienen para fines de semana largo?\"\n• \"Quiero reservar\"\n\n¿Qué te gustaría saber?",
    },
  },
  // ── Clasificar intención ──
  {
    id: "n_cond_intent",
    type: "condition",
    position: { x: 400, y: 500 },
    data: {
      label: "¿Qué intención?",
      rules: [
        {
          id: uid(),
          label: "Consulta disponibilidad",
          variable: "consulta_cliente",
          operator: "matches",
          value: "disponib|fecha|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|quincena|fines de|fin de semana|semana santa|vacacion|temporada|libre|ocupad|cuando|hay lugar|cercano|próximo|proximo|siguiente|anterior|antes|después|despues|otra fecha|otras fechas|alternativa|opcion|opción|qué tenés|que tenes|qué hay|que hay|cuándo|más cerca",
        },
        {
          id: uid(),
          label: "Buscar quinta por specs",
          variable: "consulta_cliente",
          operator: "matches",
          value: "busco|necesito|quiero una|para \\d+ persona|pileta grande|con pileta|familias|celebraci|evento|capacidad|cerca de|lejos|caba|buenos aires|habitacion|baño|interesa|me gusta|prefiero|elijo|elegir|amorosa|rincón de mi mundo|rincón ii|rincon|la quinta|cuál|cual es mejor|recomendar|recomendás|diferencia",
        },
        {
          id: uid(),
          label: "Quiere reservar/visita",
          variable: "consulta_cliente",
          operator: "matches",
          value: "reservar|reserva|visita|ver la quinta|conocer|ir a ver|agendar|coordinar|booking|quiero ir|quiero reservar|quiero visitar",
        },
      ],
    },
  },
  // ── Rama: Disponibilidad (calendar_check con rangos) ──
  {
    id: "n_check_calendar",
    type: "toolcall",
    position: { x: 100, y: 700 },
    data: {
      label: "Consultar disponibilidad",
      tool: "calendar_check",
      parameterMapping: [
        { id: uid(), paramName: "calendarId", variableName: "" },
        { id: uid(), paramName: "startDate", variableName: "" },
        { id: uid(), paramName: "endDate", variableName: "" },
        { id: uid(), paramName: "resourceId", variableName: "" },
      ],
    },
  },
  // ── Rama: Búsqueda por especificaciones ──
  {
    id: "n_search_resources",
    type: "toolcall",
    position: { x: 400, y: 700 },
    data: {
      label: "Buscar quinta",
      tool: "search_resources",
      parameterMapping: [
        { id: uid(), paramName: "calendarId", variableName: "" },
        { id: uid(), paramName: "query", variableName: "consulta_cliente" },
        { id: uid(), paramName: "minCapacity", variableName: "" },
        { id: uid(), paramName: "startDate", variableName: "" },
        { id: uid(), paramName: "endDate", variableName: "" },
        { id: uid(), paramName: "requiredFeatures", variableName: "" },
      ],
    },
  },
  // ── Rama: Reservar/visita ──
  {
    id: "n_reservar",
    type: "toolcall",
    position: { x: 700, y: 700 },
    data: {
      label: "Crear reserva",
      tool: "create_booking",
      parameterMapping: [
        { id: uid(), paramName: "calendarId", variableName: "" },
        { id: uid(), paramName: "resourceId", variableName: "" },
        { id: uid(), paramName: "date", variableName: "" },
        { id: uid(), paramName: "endDate", variableName: "" },
        { id: uid(), paramName: "contactName", variableName: "" },
        { id: uid(), paramName: "notes", variableName: "" },
      ],
    },
  },
  // ── Info general (default) ──
  {
    id: "n_info_general",
    type: "message",
    position: { x: 700, y: 500 },
    data: {
      label: "Info general",
      message:
        "Tenemos tres quintas: *El Rincón de Mi Mundo*, *El Rincón II* y *La Amorosa*. Todas incluyen pileta, parque con parrilla, DirecTV, WiFi y vajilla.\n\n¿Querés que te cuente sobre alguna en particular, o preferís consultar disponibilidad para alguna fecha?",
    },
  },
  // ── Convergencia: ¿Seguimos? ──
  {
    id: "n_ask_seguir",
    type: "ask",
    position: { x: 400, y: 920 },
    data: {
      label: "¿Seguimos?",
      message: "",
      responseType: "text",
      variable: "consulta_cliente",
      maxRetries: 2,
      retryMessage: "Podés hacerme otra consulta, decir \"reservar\" para coordinar una reserva, o \"no\" si eso es todo.",
    },
  },
  {
    id: "n_cond_seguir",
    type: "condition",
    position: { x: 400, y: 1080 },
    data: {
      label: "¿Seguir?",
      rules: [
        {
          id: uid(),
          label: "Quiere reservar / visita",
          variable: "consulta_cliente",
          operator: "matches",
          value: "reservar|reserva|visita|ver la quinta|conocer|quiero ir|coordinar|agendar|booking|quiero reservar|quiero reservarla|la quiero|me la quedo|confirmar",
        },
        {
          id: uid(),
          label: "No / terminar",
          variable: "consulta_cliente",
          operator: "matches",
          value: "no|nah|nop|chau|listo|eso es todo|nada más|nada mas|gracias|terminar|hasta luego|nos vemos",
        },
      ],
    },
  },
  // ── Nodo reservar desde seguir ──
  {
    id: "n_reservar_2",
    type: "toolcall",
    position: { x: 100, y: 1260 },
    data: {
      label: "Crear reserva (2)",
      tool: "create_booking",
      parameterMapping: [
        { id: uid(), paramName: "calendarId", variableName: "" },
        { id: uid(), paramName: "resourceId", variableName: "" },
        { id: uid(), paramName: "date", variableName: "" },
        { id: uid(), paramName: "endDate", variableName: "" },
        { id: uid(), paramName: "contactName", variableName: "" },
        { id: uid(), paramName: "notes", variableName: "" },
      ],
    },
  },
  {
    id: "n_despedida",
    type: "message",
    position: { x: 400, y: 1260 },
    data: {
      label: "Despedida",
      message: "¡Gracias por consultarnos! 🙌\nCualquier cosa, escribinos de nuevo. ¡Los esperamos en las quintas! 🏡",
    },
  },
  // ── Ends ──
  {
    id: "n_end",
    type: "end",
    position: { x: 400, y: 1420 },
    data: { label: "Fin", outcome: "resolved" },
  },
];

const edges: FlowEdge[] = [
  { id: uid(), source: "start", target: "n_saludo", type: "smoothstep" },
  { id: uid(), source: "n_saludo", target: "n_ask_consulta", type: "smoothstep" },
  { id: uid(), source: "n_ask_consulta", target: "n_cond_intent", type: "smoothstep" },
  // Intent routing
  { id: uid(), source: "n_cond_intent", sourceHandle: "rule-0", target: "n_check_calendar", type: "smoothstep" },
  { id: uid(), source: "n_cond_intent", sourceHandle: "rule-1", target: "n_search_resources", type: "smoothstep" },
  { id: uid(), source: "n_cond_intent", sourceHandle: "rule-2", target: "n_reservar", type: "smoothstep" },
  { id: uid(), source: "n_cond_intent", sourceHandle: "default", target: "n_info_general", type: "smoothstep" },
  // Converge to "seguir"
  { id: uid(), source: "n_check_calendar", target: "n_ask_seguir", type: "smoothstep" },
  { id: uid(), source: "n_search_resources", target: "n_ask_seguir", type: "smoothstep" },
  { id: uid(), source: "n_info_general", target: "n_ask_seguir", type: "smoothstep" },
  // Reservar converges to "seguir" (so user can provide missing info or continue)
  { id: uid(), source: "n_reservar", target: "n_ask_seguir", type: "smoothstep" },
  // Seguir routing
  { id: uid(), source: "n_ask_seguir", target: "n_cond_seguir", type: "smoothstep" },
  { id: uid(), source: "n_cond_seguir", sourceHandle: "rule-0", target: "n_reservar_2", type: "smoothstep" },
  { id: uid(), source: "n_cond_seguir", sourceHandle: "rule-1", target: "n_despedida", type: "smoothstep" },
  { id: uid(), source: "n_cond_seguir", sourceHandle: "default", target: "n_cond_intent", type: "smoothstep" },
  // Reservar 2 also converges back (user may still provide more info)
  { id: uid(), source: "n_reservar_2", target: "n_ask_seguir", type: "smoothstep" },
  // Endings
  { id: uid(), source: "n_despedida", target: "n_end", type: "smoothstep" },
];

const FLOW: Flow = {
  id: flowId,
  companyId: COMPANY_ID,
  name: "Consulta de Disponibilidad — Quintas",
  description: "Flujo de atención para consultas de disponibilidad y reservas de quintas. Soporta búsqueda flexible por fechas (rangos, meses, quincenas) y por especificaciones (capacidad, amenities). En modo hybrid el LLM interpreta las fechas naturalmente.",
  status: "active",
  nodes,
  edges,
  variables: FLOW_VARIABLES,
  policyIds: [],
  allowedToolIds: ["calendar_check", "create_booking", "search_resources"],
  useStock: false,
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
  name: "Asistente Quintas El Rincón",
  description: "Agente de atención para consultas de disponibilidad y reservas de quintas de alquiler temporario. Responde preguntas sobre amenities, reglas, precios y coordina visitas. Tono amable, cercano y familiar.",
  status: "active",
  channelScope: "whatsapp",
  flowId,
  mode: "hybrid",
  primaryObjective: "resolver_consulta",
  kpiType: "tiempo_respuesta",
  kpiTarget: 30,
  llmProvider: "openai",
  modelName: "gpt-4o",
  temperature: 0.6,
  maxTokens: 512,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  tone: "cercano",
  responseLength: "media",
  emojiUsage: "moderado",
  language: "es_ar",
  policyScope: "inherited",
  allowOverride: false,
  whatsappOutbound: true,
  createdAt: ts,
  updatedAt: ts,
};

// ── Front ─────────────────────────────────────────────────────────────────────

const frontId = uid();

const faqItems = [
  { question: "¿Se aceptan mascotas?", answer: "Sí, se aceptan mascotas en todas las quintas. La única excepción son las razas consideradas agresivas." },
  { question: "¿Se puede poner música?", answer: "Sí, pero con restricciones: la música solo se permite hasta las 21hs y siempre a volumen moderado." },
  { question: "¿Tienen seguro de lluvia?", answer: "No, lamentablemente no ofrecemos seguro de lluvia." },
  { question: "¿Hay aire acondicionado?", answer: "Las quintas cuentan con ventiladores en todas las habitaciones. No disponen de aire acondicionado." },
  { question: "¿Cuánto tiempo antes hay que pagar?", answer: "Se debe abonar con anticipación para confirmar la reserva. Consultá con nosotros las condiciones de pago según las fechas elegidas." },
  { question: "¿Puedo ir a ver la quinta antes de reservar?", answer: "¡Por supuesto! Podés coordinar una visita con nosotros. Nos acomodamos a tu disponibilidad." },
  { question: "¿Hay mínimo de días para alquilar?", answer: "Sí. En temporada alta (diciembre a febrero) el mínimo es de 7 días. En fines de semana largo, mínimo 2 días. El resto del año, mínimo 2 días." },
  { question: "¿Hacen descuentos?", answer: "Solo realizamos descuentos a clientes habituales y puntuales. No se negocia el precio en la primera consulta." },
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
        title: "Quintas El Rincón de Mi Mundo",
        content: "Por los momentos en familia 🏡 — Alquiler temporario de quintas con pileta, parque y parrilla cerca de Buenos Aires.",
      },
      {
        id: uid(),
        type: "chat",
        title: "Consultá disponibilidad",
        content: "Preguntale a nuestro asistente sobre las quintas, fechas y precios.",
        agentId,
      },
      {
        id: uid(),
        type: "faq",
        title: "Preguntas Frecuentes",
        config: {
          items: faqItems,
        },
      },
    ],
  },
  {
    id: uid(),
    slug: "reservar",
    title: "Reservar",
    order: 1,
    sections: [
      {
        id: uid(),
        type: "hero",
        title: "Reservá tu quinta",
        content: "Seleccioná la quinta, elegí tus fechas y confirmá tu reserva online.",
      },
      {
        id: uid(),
        type: "calendar_booking",
        title: "Calendario de disponibilidad",
        content: "Elegí la quinta y las fechas para ver disponibilidad y reservar.",
        config: {
          calendarId,
          showResourceSelector: true,
          allowNotes: true,
          successMessage: "¡Reserva confirmada! 🎉 Tu código de confirmación es: {{confirmationCode}}. Te contactaremos a la brevedad para coordinar los detalles.",
        },
      },
    ],
  },
  {
    id: uid(),
    slug: "quintas",
    title: "Nuestras Quintas",
    order: 2,
    sections: [
      {
        id: uid(),
        type: "hero",
        title: "Nuestras Quintas",
        content: "Conocé cada una de nuestras 3 quintas y sus comodidades.",
      },
      {
        id: uid(),
        type: "info",
        title: "El Rincón de Mi Mundo",
        content: "🏡 **Nuestra quinta principal desde 2015.**\n\n- 3 habitaciones: 2 matrimoniales con baño privado + 1 con 5 plazas\n- Pileta de 12m x 4m\n- Parque de 3.500m²\n- Quincho cerrado con cocina completa, parrilla, TV Smart, heladera y freezer\n- Quincho abierto con parrillas adicionales\n- Cancha de fútbol y vóley\n- DirecTV con canales deportivos, WiFi\n- Vajilla para 10 personas, mobiliario para 30\n- Estacionamiento amplio\n- Se aceptan mascotas (excepto razas agresivas)",
      },
      {
        id: uid(),
        type: "info",
        title: "El Rincón II",
        content: "🏊 **Ideal para dos familias.**\n\n- 3 dormitorios: 2 matrimoniales en suite + 1 con camas marineras\n- 4 baños (incluido uno exterior para bañistas)\n- Pileta 8m x 4m\n- Parque de 3.500m²\n- Quincho techado con parrilla\n- Cocina comedor abierta equipada\n- Cancha de fútbol y vóley\n- DirecTV con fútbol, WiFi\n- Vajilla para 10, espacio para 30 personas\n- Gas de garrafa, termotanque\n- Se aceptan mascotas (excepto razas agresivas)",
      },
      {
        id: uid(),
        type: "info",
        title: "La Amorosa",
        content: "✨ **A solo 30 minutos de Buenos Aires.**\n\nUn refugio de paz y belleza diseñado para ser el escenario de tus momentos más preciados.\n\nIdeal para:\n- Visitas de día\n- Celebraciones íntimas\n- Escapadas de fin de semana\n- Estadías vacacionales\n\n¡Consultanos para más detalles!",
      },
    ],
  },
];

const frontVersionId = uid();

const frontSnapshot = {
  name: "Quintas El Rincón de Mi Mundo",
  description: "Sitio web de consulta de disponibilidad y reservas de quintas de alquiler temporario.",
  subdomain: "quintas",
  branding: { primaryColor: "#16a34a", template: "moss" as const },
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
  publishedBy: "quintas@freia.ai",
};

const FRONT: Front = {
  id: frontId,
  companyId: COMPANY_ID,
  name: "Quintas El Rincón de Mi Mundo",
  description: "Sitio web de consulta de disponibilidad y reservas de quintas de alquiler temporario.",
  status: "published",
  subdomain: "quintas",
  branding: { primaryColor: "#16a34a", template: "moss" },
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

// IDs of other demo companies — used to clean their data on switch
const OTHER_COMPANY_IDS = ["company_cubiertas", "company_importador"];

/** Names of entities belonging to other demos — used as fallback when companyId is missing */
const OTHER_DEMO_NAMES = [
  "Asistente Cubiertas Express", "Consulta de Stock — Cubiertas", "Cubiertas Express",
  "Asistente Importador ACME", "Importador ACME",
];

function cleanOtherDemoData(): boolean {
  let cleaned = false;
  const filterByCompany = (key: string) => {
    try {
      const arr = JSON.parse(localStorage.getItem(key) ?? "[]");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filtered = arr.filter((item: any) => {
        // Remove if companyId matches another demo
        if (OTHER_COMPANY_IDS.includes(item.companyId)) return false;
        // Remove if no companyId but name matches another demo (legacy data)
        if (!item.companyId && OTHER_DEMO_NAMES.includes(item.name)) return false;
        return true;
      });
      if (filtered.length !== arr.length) { cleaned = true; localStorage.setItem(key, JSON.stringify(filtered)); }
    } catch { /* ignore */ }
  };

  filterByCompany("freia_products");
  filterByCompany("freia_flows");
  filterByCompany("freia_agents");
  filterByCompany("freia_fronts");
  // Also clean importador-specific data
  if (localStorage.getItem("freia_import_messages")) { cleaned = true; localStorage.removeItem("freia_import_messages"); }

  // Invalidate other demo sentinels so they re-seed when switching back
  localStorage.removeItem("freia_seed_cubiertas_v16");
  localStorage.removeItem("freia_seed_cubiertas_v17");
  localStorage.removeItem("freia_seed_importador_v3");

  return cleaned;
}

export function seedDemoRincon(): boolean {
  if (typeof window === "undefined") return false;

  // Clean old sentinels
  localStorage.removeItem("freia_seed_rincon_v1");
  localStorage.removeItem("freia_seed_rincon_v2");
  localStorage.removeItem("freia_seed_rincon_v3");
  localStorage.removeItem("freia_seed_rincon_v4");
  localStorage.removeItem("freia_seed_rincon_v5");
  localStorage.removeItem("freia_seed_rincon_v6");
  localStorage.removeItem("freia_seed_rincon_v7");
  localStorage.removeItem("freia_seed_rincon_v8");
  localStorage.removeItem("freia_seed_rincon_v9");

  // ALWAYS clean other demo data (runs even if already seeded)
  const cleaned = cleanOtherDemoData();

  // Already seeded with current version
  if (localStorage.getItem(SEED_KEY)) {
    if (cleaned) console.log("[seed-demo-rincon] cleaned other demo data");
    return cleaned;
  }

  console.log("[seed-demo-rincon] seeding v5 data...");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsert = <T extends Record<string, any>>(
      key: string,
      items: T[],
      dedupField: keyof T = "id" as keyof T,
    ) => {
      const existing: T[] = (() => {
        try { return JSON.parse(localStorage.getItem(key) ?? "[]"); }
        catch { return []; }
      })();
      const seedKeys = new Set(items.map((i) => String(i[dedupField])));
      const kept = existing.filter((e) => !seedKeys.has(String(e[dedupField])));
      localStorage.setItem(key, JSON.stringify([...kept, ...items]));
    };

    // Remove old data by name (idempotent re-seed)
    const cleanByName = (key: string, name: string) => {
      try {
        const arr = JSON.parse(localStorage.getItem(key) ?? "[]");
        const filtered = arr.filter((item: Record<string, unknown>) => item.name !== name);
        if (filtered.length !== arr.length) localStorage.setItem(key, JSON.stringify(filtered));
      } catch { /* ignore */ }
    };

    cleanByName("freia_flows", "Consulta de Disponibilidad — Quintas");
    cleanByName("freia_agents", "Asistente Quintas El Rincón");
    cleanByName("freia_fronts", "Quintas El Rincón de Mi Mundo");
    cleanByName("freia_calendars", "Quintas El Rincón");

    // Seed calendar data
    upsert("freia_calendars", [CALENDAR]);
    upsert("freia_calendar_resources", RESOURCES);
    upsert("freia_calendar_blocks", BLOCKED_PERIODS);
    upsert("freia_calendar_min_stay_rules", MIN_STAY_RULES);
    upsert("freia_bookings", BOOKINGS);

    // Seed flow, agent, front
    upsert("freia_flows", [FLOW], "name");
    upsert("freia_agents", [AGENT], "name");
    upsert("freia_fronts", [FRONT], "name");

    // Seed demo conversations for dashboard metrics
    const now = new Date();
    const ago = (mins: number) => new Date(now.getTime() - mins * 60000).toISOString();
    const calId = CALENDAR.id;
    const res0 = RESOURCES[0].id; // El Rincón de Mi Mundo
    const res2 = RESOURCES[2].id; // La Amorosa
    const demoConversations = [
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_end", vars: { "contact.phone": "+5491166660001", "contact.name": "Sofía Martínez", channel: "whatsapp", "message.text": "Hola, quiero consultar disponibilidad para marzo", consulta_cliente: "disponibilidad marzo" }, varTimestamps: {}, status: "completed" as const, startedAt: ago(200), lastActivityAt: ago(190), retryCount: {}, toolExecutionLogs: [{ nodeId: "n_check_calendar", tool: "calendar_check", timestamp: ago(198), request: { calendarId: calId, startDate: "2026-03-13", endDate: "2026-03-16" }, response: { status: "available" }, durationMs: 150 }, { nodeId: "n_reservar", tool: "create_booking", timestamp: ago(192), request: { calendarId: calId, resourceId: res2, date: "2026-03-13", endDate: "2026-03-16", contactName: "Sofía Martínez" }, response: { status: "confirmed", data: { confirmationCode: "BK-M7K2" } }, durationMs: 80 }] },
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_end", vars: { "contact.phone": "+5491166660002", "contact.name": "Marcos Pérez", channel: "whatsapp", "message.text": "Tienen quinta con pileta para 20 personas?", consulta_cliente: "quinta con pileta 20 personas" }, varTimestamps: {}, status: "completed" as const, startedAt: ago(350), lastActivityAt: ago(340), retryCount: {}, toolExecutionLogs: [{ nodeId: "n_search_resources", tool: "search_resources", timestamp: ago(348), request: { calendarId: calId, query: "pileta grande 20 personas", minCapacity: 20 }, response: { status: "found" }, durationMs: 130 }] },
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_end", vars: { "contact.phone": "+5491166660003", "contact.name": "Luciana Torres", channel: "whatsapp", "message.text": "Disponibilidad para semana santa", consulta_cliente: "semana santa" }, varTimestamps: {}, status: "completed" as const, startedAt: ago(500), lastActivityAt: ago(492), retryCount: {}, toolExecutionLogs: [{ nodeId: "n_check_calendar", tool: "calendar_check", timestamp: ago(498), request: { calendarId: calId, startDate: "2026-03-29", endDate: "2026-04-05" }, response: { status: "available" }, durationMs: 140 }] },
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_ask_consulta", vars: { "contact.phone": "+5491166660004", "contact.name": "", channel: "whatsapp", "message.text": "Hola buen día" }, varTimestamps: {}, status: "abandoned" as const, startedAt: ago(100), lastActivityAt: ago(95), retryCount: {}, toolExecutionLogs: [] },
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_cond_intent", vars: { "contact.phone": "+5491166660005", "contact.name": "Diego Romero", channel: "whatsapp", "message.text": "Me interesa El Rincón de Mi Mundo", consulta_cliente: "el rincón de mi mundo" }, varTimestamps: {}, status: "abandoned" as const, startedAt: ago(250), lastActivityAt: ago(242), retryCount: {}, toolExecutionLogs: [] },
      { id: uid(), flowId, versionId: "", agentId, currentNodeId: "n_saludo", vars: { "contact.phone": "+5491166660006", "contact.name": "Valeria Sosa", channel: "whatsapp", "message.text": "Hola! Quiero info de La Amorosa", consulta_cliente: "la amorosa" }, varTimestamps: {}, status: "active" as const, startedAt: ago(3), lastActivityAt: ago(1), retryCount: {}, toolExecutionLogs: [] },
    ];
    upsert("freia_conversations", demoConversations);

    // Seed demo audit log entries
    const demoAudit = [
      { id: uid(), timestamp: ago(1), type: "agent_status_change", agentId, agentName: AGENT.name, previousStatus: "paused", newStatus: "active" },
      { id: uid(), timestamp: ago(60), type: "front_published", frontId: uid(), frontName: FRONT.name, subdomain: FRONT.subdomain, version: 1, performedBy: "admin" },
    ];
    upsert("freia_audit_log", demoAudit);

    localStorage.setItem(SEED_KEY, "1");
    console.log("[seed-demo-rincon] v9 done.");
    return true;
  } catch (err) {
    console.error("[seed-demo-rincon] error:", err);
    return false;
  }
}
