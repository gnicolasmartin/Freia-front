/**
 * calendar.ts
 *
 * Types, constants and helpers for the Calendar & Booking module.
 */

// ─── Enums / Literals ────────────────────────────────────────────────────────

export type BookingMode = "hourly" | "daily";
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

export const BOOKING_MODE_LABELS: Record<BookingMode, { label: string; description: string }> = {
  hourly: { label: "Por hora", description: "Turnos con horarios específicos (ej: consultorio, estudio)" },
  daily:  { label: "Por día",  description: "Reservas por días completos (ej: hotel, cabaña)" },
};

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:   { label: "Pendiente",  color: "text-amber-400",   bg: "bg-amber-900/20",   border: "border-amber-800/50" },
  confirmed: { label: "Confirmada", color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-800/50" },
  completed: { label: "Completada", color: "text-sky-400",     bg: "bg-sky-900/20",     border: "border-sky-800/50" },
  cancelled: { label: "Cancelada",  color: "text-red-400",     bg: "bg-red-900/20",     border: "border-red-800/50" },
};

// ─── Day schedule ────────────────────────────────────────────────────────────

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export const DAYS_OF_WEEK: { key: DayOfWeek; label: string; short: string }[] = [
  { key: "monday",    label: "Lunes",     short: "Lun" },
  { key: "tuesday",   label: "Martes",    short: "Mar" },
  { key: "wednesday", label: "Miércoles", short: "Mié" },
  { key: "thursday",  label: "Jueves",    short: "Jue" },
  { key: "friday",    label: "Viernes",   short: "Vie" },
  { key: "saturday",  label: "Sábado",    short: "Sáb" },
  { key: "sunday",    label: "Domingo",   short: "Dom" },
];

export interface DaySchedule {
  enabled: boolean;
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

export const DEFAULT_SCHEDULE: Record<DayOfWeek, DaySchedule> = {
  monday:    { enabled: true,  start: "09:00", end: "18:00" },
  tuesday:   { enabled: true,  start: "09:00", end: "18:00" },
  wednesday: { enabled: true,  start: "09:00", end: "18:00" },
  thursday:  { enabled: true,  start: "09:00", end: "18:00" },
  friday:    { enabled: true,  start: "09:00", end: "18:00" },
  saturday:  { enabled: false, start: "09:00", end: "13:00" },
  sunday:    { enabled: false, start: "09:00", end: "13:00" },
};

// ─── Calendar ────────────────────────────────────────────────────────────────

export interface Calendar {
  id: string;
  companyId?: string;
  name: string;
  description?: string;
  bookingMode: BookingMode;
  /** IANA timezone, e.g. "America/Argentina/Buenos_Aires" */
  timezone: string;
  /** Default slot duration in minutes (hourly mode only) */
  slotDurationMinutes: number;
  /** Buffer between consecutive bookings in minutes */
  bufferMinutes: number;
  /** How far in advance bookings can be made (days) */
  maxAdvanceDays: number;
  /** Weekly schedule — which days/hours are open */
  schedule: Record<DayOfWeek, DaySchedule>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CalendarFormData = Omit<Calendar, "id" | "createdAt" | "updatedAt">;

// ─── CalendarResource ────────────────────────────────────────────────────────

export interface CalendarResource {
  id: string;
  calendarId: string;
  name: string;
  description?: string;
  /** How many concurrent bookings this resource supports (usually 1) */
  capacity: number;
  /** Optional metadata (e.g., room number, floor, equipment) */
  metadata: Record<string, string>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ResourceFormData = Omit<CalendarResource, "id" | "createdAt" | "updatedAt">;

// ─── BlockedPeriod ───────────────────────────────────────────────────────────

export interface BlockedPeriod {
  id: string;
  calendarId: string;
  /** null = applies to all resources in this calendar */
  resourceId: string | null;
  name: string;
  /** ISO date string "YYYY-MM-DD" */
  startDate: string;
  /** ISO date string "YYYY-MM-DD" */
  endDate: string;
  /** For hourly mode: optional time range within the blocked days */
  startTime?: string; // "HH:mm"
  endTime?: string;   // "HH:mm"
  /** If true, recurs every year (e.g., national holidays) */
  recurring: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BlockedPeriodFormData = Omit<BlockedPeriod, "id" | "createdAt" | "updatedAt">;

// ─── MinimumStayRule ─────────────────────────────────────────────────────────

export interface MinimumStayRule {
  id: string;
  calendarId: string;
  name: string;
  /** Period this rule applies to */
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  /** Minimum consecutive days (daily mode) or minimum minutes (hourly mode) */
  minimumUnits: number;
  /** "days" for daily mode, "minutes" for hourly mode */
  unitType: "days" | "minutes";
  createdAt: string;
  updatedAt: string;
}

export type MinimumStayRuleFormData = Omit<MinimumStayRule, "id" | "createdAt" | "updatedAt">;

// ─── Booking ─────────────────────────────────────────────────────────────────

export interface Booking {
  id: string;
  calendarId: string;
  resourceId: string;
  /** ISO date "YYYY-MM-DD" */
  startDate: string;
  /** ISO date "YYYY-MM-DD" — same as startDate for hourly single-slot */
  endDate: string;
  /** "HH:mm" — only for hourly mode */
  startTime?: string;
  /** "HH:mm" — only for hourly mode */
  endTime?: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  status: BookingStatus;
  /** Unique confirmation code (short, shareable) */
  confirmationCode: string;
  /** Which tool/flow created it, or "manual", or "front" (widget) */
  source: "flow" | "manual" | "front";
  createdAt: string;
  updatedAt: string;
}

export type BookingFormData = Omit<Booking, "id" | "confirmationCode" | "createdAt" | "updatedAt">;

// ─── Availability result ─────────────────────────────────────────────────────

export interface AvailableSlot {
  resourceId: string;
  resourceName: string;
  date: string;       // "YYYY-MM-DD"
  startTime?: string; // "HH:mm" (hourly only)
  endTime?: string;   // "HH:mm" (hourly only)
}
