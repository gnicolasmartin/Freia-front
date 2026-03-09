export type PolicyScope = "global" | "flow" | "channel";

// --- Forbidden data categories (input restrictions — what the agent cannot ASK) ---

export const FORBIDDEN_CATEGORIES = [
  { value: "dni", label: "DNI / Documento de identidad", keywords: ["dni", "documento", "identidad", "cédula", "número de documento"] },
  { value: "credit_card", label: "Tarjeta de crédito", keywords: ["tarjeta", "crédito", "débito", "número de tarjeta", "cvv", "vencimiento tarjeta"] },
  { value: "medical", label: "Información médica", keywords: ["diagnóstico", "enfermedad", "medicamento", "historia clínica", "tratamiento médico", "salud"] },
  { value: "financial", label: "Datos financieros", keywords: ["cuenta bancaria", "cbu", "sueldo", "ingreso", "deuda"] },
  { value: "password", label: "Contraseñas / Credenciales", keywords: ["contraseña", "password", "clave", "pin", "token"] },
] as const;

export type ForbiddenCategory = typeof FORBIDDEN_CATEGORIES[number]["value"];

// --- Forbidden response categories (output restrictions — what the agent cannot RESPOND about) ---

export const FORBIDDEN_RESPONSE_CATEGORIES = [
  { value: "internal_policy", label: "Políticas internas", keywords: ["política interna", "procedimiento interno", "protocolo interno", "normativa interna"] },
  { value: "margins", label: "Márgenes de ganancia", keywords: ["margen", "markup", "costo real", "precio de costo", "ganancia"] },
  { value: "competition", label: "Competencia", keywords: ["competencia", "competidor", "rival", "otra empresa", "otra marca"] },
  { value: "unauthorized_discounts", label: "Descuentos no autorizados", keywords: ["descuento especial", "precio especial", "oferta exclusiva", "rebaja"] },
] as const;

export type ForbiddenResponseCategory = typeof FORBIDDEN_RESPONSE_CATEGORIES[number]["value"];
export type ResponseViolationAction = "block" | "escalate" | "reformulate";

// --- Authority rules (tool execution limits) ---

export interface AuthorityRule {
  id: string;
  type: "forbidden" | "limit";
  toolName: string;
  paramName?: string;
  maxValue?: number;
  description: string;
}

export type AuthorityViolationAction = "block" | "escalate";

// --- Escalation triggers (auto-escalation based on keywords, intents, confidence) ---

export const ESCALATION_TRIGGER_CATEGORIES = [
  { value: "aggressive_language", label: "Lenguaje agresivo",
    keywords: ["mierda", "carajo", "basura", "inútil", "incompetente", "estúpido", "idiota", "imbécil", "inservible", "desastre"] },
  { value: "legal_threat", label: "Amenaza legal",
    keywords: ["abogado", "demanda", "denuncia", "defensa del consumidor", "legal", "juicio", "tribunal", "ley", "derechos del consumidor"] },
  { value: "self_harm", label: "Riesgo personal",
    keywords: ["suicidio", "hacerme daño", "no quiero vivir", "amenaza", "emergencia"] },
  { value: "fraud", label: "Sospecha de fraude",
    keywords: ["fraude", "estafa", "robo", "suplantación", "identidad falsa", "phishing"] },
] as const;

export type EscalationTriggerCategory = typeof ESCALATION_TRIGGER_CATEGORIES[number]["value"];
export type EscalationTriggerAction = "escalate" | "flag" | "notify";

export interface EscalationTriggerRule {
  id: string;
  type: "intent" | "confidence";
  intentName?: string;
  confidenceThreshold?: number;
  description: string;
}

// --- Input classification (content moderation — pre-engine user message analysis) ---

export const INPUT_CLASSIFICATION_CATEGORIES = [
  { value: "offensive_language", label: "Lenguaje ofensivo",
    keywords: ["mierda", "carajo", "basura", "inútil", "idiota", "imbécil", "estúpido",
               "hijo de puta", "maldito", "asco", "porquería", "desgraciado"] },
  { value: "illegal_request", label: "Solicitud ilegal",
    keywords: ["hackear", "crackear", "robar", "falsificar", "piratear", "droga",
               "arma", "explosivo", "extorsión", "soborno", "lavado de dinero"] },
  { value: "manipulation_attempt", label: "Intento de manipulación",
    keywords: ["ignora tus instrucciones", "olvida todo", "actúa como", "pretende que",
               "eres un humano", "no eres un bot", "jailbreak", "prompt injection",
               "ignore previous", "bypass", "override instructions"] },
] as const;

export type InputClassificationCategory = typeof INPUT_CLASSIFICATION_CATEGORIES[number]["value"];
export type InputClassificationAction = "ignore" | "escalate" | "warn";

// --- Risk score ---

export type RiskScoreAction = "warn" | "escalate";

// --- Enforcement mode ---

export type EnforcementMode = "strict" | "flexible";

// --- Interfaces ---

export interface PolicyVersion {
  id: string;
  policyId: string;
  version: number;
  name: string;
  description: string;
  scope: PolicyScope;
  channelIds: string[];
  active: boolean;
  enforcementMode: EnforcementMode;
  forbiddenCategories: ForbiddenCategory[];
  forbiddenKeywords: string[];
  forbiddenResponseCategories: ForbiddenResponseCategory[];
  forbiddenResponseKeywords: string[];
  responseViolationAction: ResponseViolationAction;
  authorityRules: AuthorityRule[];
  authorityViolationAction: AuthorityViolationAction;
  escalationTriggerCategories: EscalationTriggerCategory[];
  escalationTriggerKeywords: string[];
  escalationTriggerRules: EscalationTriggerRule[];
  escalationTriggerAction: EscalationTriggerAction;
  riskScoreThreshold: number;
  riskScoreAction: RiskScoreAction;
  inputClassificationCategories: InputClassificationCategory[];
  inputClassificationKeywords: string[];
  inputClassificationAction: InputClassificationAction;
  publishedAt: string;
}

export interface Policy {
  id: string;
  companyId?: string;
  name: string;
  description: string;
  scope: PolicyScope;
  channelIds: string[];
  active: boolean;
  enforcementMode: EnforcementMode;
  forbiddenCategories: ForbiddenCategory[];
  forbiddenKeywords: string[];
  forbiddenResponseCategories: ForbiddenResponseCategory[];
  forbiddenResponseKeywords: string[];
  responseViolationAction: ResponseViolationAction;
  authorityRules: AuthorityRule[];
  authorityViolationAction: AuthorityViolationAction;
  escalationTriggerCategories: EscalationTriggerCategory[];
  escalationTriggerKeywords: string[];
  escalationTriggerRules: EscalationTriggerRule[];
  escalationTriggerAction: EscalationTriggerAction;
  riskScoreThreshold: number;
  riskScoreAction: RiskScoreAction;
  inputClassificationCategories: InputClassificationCategory[];
  inputClassificationKeywords: string[];
  inputClassificationAction: InputClassificationAction;
  createdAt: string;
  updatedAt: string;
  versions: PolicyVersion[];
}

export type PolicyFormData = Omit<
  Policy,
  "id" | "createdAt" | "updatedAt" | "versions"
>;

export const EMPTY_POLICY_FORM: PolicyFormData = {
  name: "",
  description: "",
  scope: "global",
  channelIds: [],
  active: true,
  enforcementMode: "strict",
  forbiddenCategories: [],
  forbiddenKeywords: [],
  forbiddenResponseCategories: [],
  forbiddenResponseKeywords: [],
  responseViolationAction: "block",
  authorityRules: [],
  authorityViolationAction: "block",
  escalationTriggerCategories: [],
  escalationTriggerKeywords: [],
  escalationTriggerRules: [],
  escalationTriggerAction: "escalate",
  riskScoreThreshold: 0,
  riskScoreAction: "warn",
  inputClassificationCategories: [],
  inputClassificationKeywords: [],
  inputClassificationAction: "escalate",
};

export const POLICY_SCOPES = [
  { value: "global", label: "Global" },
  { value: "flow", label: "Por flujo" },
  { value: "channel", label: "Por canal" },
] as const;

export function getEffectiveKeywords(policy: Pick<Policy, "forbiddenCategories" | "forbiddenKeywords">): string[] {
  const categoryKeywords = (policy.forbiddenCategories ?? []).flatMap(
    cat => FORBIDDEN_CATEGORIES.find(c => c.value === cat)?.keywords ?? []
  );
  return [...categoryKeywords, ...(policy.forbiddenKeywords ?? [])];
}

export function getEffectiveResponseKeywords(policy: Pick<Policy, "forbiddenResponseCategories" | "forbiddenResponseKeywords">): string[] {
  const categoryKeywords = (policy.forbiddenResponseCategories ?? []).flatMap(
    cat => FORBIDDEN_RESPONSE_CATEGORIES.find(c => c.value === cat)?.keywords ?? []
  );
  return [...categoryKeywords, ...(policy.forbiddenResponseKeywords ?? [])];
}

export function getEffectiveEscalationKeywords(policy: Pick<Policy, "escalationTriggerCategories" | "escalationTriggerKeywords">): string[] {
  const categoryKeywords = (policy.escalationTriggerCategories ?? []).flatMap(
    cat => ESCALATION_TRIGGER_CATEGORIES.find(c => c.value === cat)?.keywords ?? []
  );
  return [...categoryKeywords, ...(policy.escalationTriggerKeywords ?? [])];
}

export function getEffectiveClassificationKeywords(policy: Pick<Policy, "inputClassificationCategories" | "inputClassificationKeywords">): string[] {
  const categoryKeywords = (policy.inputClassificationCategories ?? []).flatMap(
    cat => INPUT_CLASSIFICATION_CATEGORIES.find(c => c.value === cat)?.keywords ?? []
  );
  return [...categoryKeywords, ...(policy.inputClassificationKeywords ?? [])];
}

export function resolveEnforcementActions(mode: EnforcementMode = "strict") {
  if (mode === "flexible") {
    return {
      responseViolationAction: "reformulate" as const,
      authorityViolationAction: "block" as const,
      escalationTriggerAction: "flag" as const,
      riskScoreAction: "warn" as const,
      inputClassificationAction: "warn" as const,
    };
  }
  return {
    responseViolationAction: "block" as const,
    authorityViolationAction: "block" as const,
    escalationTriggerAction: "escalate" as const,
    riskScoreAction: "escalate" as const,
    inputClassificationAction: "escalate" as const,
  };
}
