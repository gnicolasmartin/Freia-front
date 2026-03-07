/**
 * business-hours.ts
 *
 * Pure, side-effect-free utilities for business hours configuration.
 * No React, no side effects — safe to call from any context.
 *
 * localStorage key: "freia_business_hours"
 */

import type { BusinessHoursConfig, DayOfWeek } from "@/types/business-hours";

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "freia_business_hours";

/** Maps JS Date.getDay() (0=Sun) to DayOfWeek */
const DAY_INDEX_TO_NAME: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (ART, UTC-3)" },
  { value: "America/Sao_Paulo",             label: "São Paulo (BRT, UTC-3)" },
  { value: "America/Mexico_City",           label: "Ciudad de México (CST, UTC-6)" },
  { value: "America/Bogota",                label: "Bogotá (COT, UTC-5)" },
  { value: "America/Lima",                  label: "Lima (PET, UTC-5)" },
  { value: "America/Santiago",              label: "Santiago (CLT, UTC-3/-4)" },
  { value: "America/New_York",              label: "Nueva York (EST, UTC-5)" },
  { value: "Europe/Madrid",                 label: "Madrid (CET, UTC+1)" },
  { value: "UTC",                           label: "UTC" },
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday:    "Lunes",
  tuesday:   "Martes",
  wednesday: "Miércoles",
  thursday:  "Jueves",
  friday:    "Viernes",
  saturday:  "Sábado",
  sunday:    "Domingo",
};

export const DAYS_ORDER: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  enabled: false,
  timezone: "America/Argentina/Buenos_Aires",
  schedule: {
    monday:    { enabled: true,  start: "09:00", end: "18:00" },
    tuesday:   { enabled: true,  start: "09:00", end: "18:00" },
    wednesday: { enabled: true,  start: "09:00", end: "18:00" },
    thursday:  { enabled: true,  start: "09:00", end: "18:00" },
    friday:    { enabled: true,  start: "09:00", end: "18:00" },
    saturday:  { enabled: false, start: "09:00", end: "13:00" },
    sunday:    { enabled: false, start: "09:00", end: "13:00" },
  },
  updatedAt: new Date().toISOString(),
};

// ─── localStorage helpers ──────────────────────────────────────────────────────

export function getBusinessHoursConfig(): BusinessHoursConfig {
  if (typeof window === "undefined") return DEFAULT_BUSINESS_HOURS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BUSINESS_HOURS;
    const parsed = JSON.parse(raw) as Partial<BusinessHoursConfig>;
    // Merge with defaults so new fields added later are always present
    return {
      ...DEFAULT_BUSINESS_HOURS,
      ...parsed,
      schedule: {
        ...DEFAULT_BUSINESS_HOURS.schedule,
        ...(parsed.schedule ?? {}),
      },
    };
  } catch {
    return DEFAULT_BUSINESS_HOURS;
  }
}

export function saveBusinessHoursConfig(config: BusinessHoursConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// ─── Time logic ───────────────────────────────────────────────────────────────

/**
 * Returns true when the current moment falls within an enabled day+time window.
 *
 * If config.enabled === false → always returns true (no gating).
 *
 * Uses Intl.DateTimeFormat.formatToParts() for timezone-aware evaluation
 * without any external dependencies.
 */
export function isCurrentlyBusinessHours(config?: BusinessHoursConfig): boolean {
  const cfg = config ?? getBusinessHoursConfig();
  if (!cfg.enabled) return true;

  try {
    const now = new Date();
    const tz = cfg.timezone || "UTC";

    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = fmt.formatToParts(now);
    const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hourPart    = parts.find((p) => p.type === "hour")?.value   ?? "00";
    const minutePart  = parts.find((p) => p.type === "minute")?.value ?? "00";

    // Map English weekday name → DayOfWeek
    const weekdayMap: Record<string, DayOfWeek> = {
      Monday: "monday", Tuesday: "tuesday", Wednesday: "wednesday",
      Thursday: "thursday", Friday: "friday", Saturday: "saturday",
      Sunday: "sunday",
    };
    const day = weekdayMap[weekdayPart];
    if (!day) return false;

    const daySchedule = cfg.schedule[day];
    if (!daySchedule.enabled) return false;

    // Normalize hour — Intl sometimes returns "24" for midnight
    const h = parseInt(hourPart, 10) % 24;
    const m = parseInt(minutePart, 10);
    const currentMinutes = h * 60 + m;

    const [startH, startM] = daySchedule.start.split(":").map(Number);
    const [endH,   endM  ] = daySchedule.end.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes   = endH   * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch {
    // If Intl fails for any reason, default to open
    return true;
  }
}

/**
 * Returns a human-readable string describing the next opening time,
 * e.g. "Abrimos el lunes a las 09:00".
 * Returns "" when config.enabled === false.
 */
export function getNextOpenDescription(config?: BusinessHoursConfig): string {
  const cfg = config ?? getBusinessHoursConfig();
  if (!cfg.enabled) return "";

  try {
    const now = new Date();
    const tz = cfg.timezone || "UTC";

    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = fmt.formatToParts(now);
    const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "";

    const weekdayMap: Record<string, DayOfWeek> = {
      Monday: "monday", Tuesday: "tuesday", Wednesday: "wednesday",
      Thursday: "thursday", Friday: "friday", Saturday: "saturday",
      Sunday: "sunday",
    };
    const todayKey = weekdayMap[weekdayPart];
    if (!todayKey) return "";

    const todayIndex = DAY_INDEX_TO_NAME.indexOf(todayKey);

    // Search for the next enabled day starting from today+1
    for (let offset = 1; offset <= 7; offset++) {
      const idx = (todayIndex + offset) % 7;
      const dayKey = DAY_INDEX_TO_NAME[idx];
      const schedule = cfg.schedule[dayKey];
      if (schedule.enabled) {
        return `Abrimos el ${DAY_LABELS[dayKey].toLowerCase()} a las ${schedule.start}`;
      }
    }
    return "Sin próxima apertura configurada";
  } catch {
    return "";
  }
}
