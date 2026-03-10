/**
 * calendar-availability.ts
 *
 * Pure utility module for calendar availability calculations.
 * No React dependencies — usable by both providers and the flow simulator.
 */

import type {
  Calendar,
  CalendarResource,
  Booking,
  BlockedPeriod,
  MinimumStayRule,
  AvailableSlot,
  DayOfWeek,
} from "@/types/calendar";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_INDEX_TO_KEY: DayOfWeek[] = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

function getDayOfWeek(dateStr: string): DayOfWeek {
  const d = new Date(dateStr + "T12:00:00");
  return DAY_INDEX_TO_KEY[d.getDay()];
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/**
 * For recurring blocks, adjust the year of the block to match the target date's year.
 */
function adjustRecurringBlock(block: BlockedPeriod, targetDate: string): { startDate: string; endDate: string } {
  const targetYear = targetDate.slice(0, 4);
  return {
    startDate: targetYear + block.startDate.slice(4),
    endDate: targetYear + block.endDate.slice(4),
  };
}

// ─── Block checking ──────────────────────────────────────────────────────────

export function isDateBlocked(
  date: string,
  blocks: BlockedPeriod[],
  resourceId?: string,
): boolean {
  return blocks.some((block) => {
    // Resource scope: block applies if it targets all resources (null) or the specific resource
    if (block.resourceId !== null && block.resourceId !== resourceId) return false;

    const { startDate, endDate } = block.recurring
      ? adjustRecurringBlock(block, date)
      : block;

    return dateInRange(date, startDate, endDate);
  });
}

export function isTimeSlotBlocked(
  date: string,
  slotStart: string,
  slotEnd: string,
  blocks: BlockedPeriod[],
  resourceId?: string,
): boolean {
  const slotStartMins = timeToMinutes(slotStart);
  const slotEndMins = timeToMinutes(slotEnd);

  return blocks.some((block) => {
    if (block.resourceId !== null && block.resourceId !== resourceId) return false;

    const { startDate, endDate } = block.recurring
      ? adjustRecurringBlock(block, date)
      : block;

    if (!dateInRange(date, startDate, endDate)) return false;

    // If no time range specified on block, the entire day is blocked
    if (!block.startTime || !block.endTime) return true;

    // Check time overlap
    const blockStartMins = timeToMinutes(block.startTime);
    const blockEndMins = timeToMinutes(block.endTime);
    return slotStartMins < blockEndMins && slotEndMins > blockStartMins;
  });
}

// ─── Minimum stay validation ─────────────────────────────────────────────────

export function getApplicableMinStayRule(
  startDate: string,
  endDate: string,
  rules: MinimumStayRule[],
): MinimumStayRule | null {
  // Return the most restrictive rule that overlaps the booking period
  let bestRule: MinimumStayRule | null = null;

  for (const rule of rules) {
    // Check if booking period overlaps rule period
    if (startDate <= rule.endDate && endDate >= rule.startDate) {
      if (!bestRule || rule.minimumUnits > bestRule.minimumUnits) {
        bestRule = rule;
      }
    }
  }

  return bestRule;
}

export function validateMinimumStay(
  startDate: string,
  endDate: string,
  startTime: string | undefined,
  endTime: string | undefined,
  rules: MinimumStayRule[],
): { valid: boolean; minimumRequired?: number; unitType?: "days" | "minutes" } {
  const rule = getApplicableMinStayRule(startDate, endDate, rules);
  if (!rule) return { valid: true };

  if (rule.unitType === "days") {
    const start = new Date(startDate + "T12:00:00");
    const end = new Date(endDate + "T12:00:00");
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays < rule.minimumUnits) {
      return { valid: false, minimumRequired: rule.minimumUnits, unitType: "days" };
    }
  } else if (rule.unitType === "minutes" && startTime && endTime) {
    const diffMins = timeToMinutes(endTime) - timeToMinutes(startTime);
    if (diffMins < rule.minimumUnits) {
      return { valid: false, minimumRequired: rule.minimumUnits, unitType: "minutes" };
    }
  }

  return { valid: true };
}

// ─── Slot generation (hourly mode) ──────────────────────────────────────────

function generateTimeSlots(
  calendar: Calendar,
  date: string,
): { start: string; end: string }[] {
  const dow = getDayOfWeek(date);
  const daySched = calendar.schedule[dow];
  if (!daySched?.enabled) return [];

  const dayStartMins = timeToMinutes(daySched.start);
  const dayEndMins = timeToMinutes(daySched.end);
  const slots: { start: string; end: string }[] = [];

  let cursor = dayStartMins;
  while (cursor + calendar.slotDurationMinutes <= dayEndMins) {
    slots.push({
      start: minutesToTime(cursor),
      end: minutesToTime(cursor + calendar.slotDurationMinutes),
    });
    cursor += calendar.slotDurationMinutes + calendar.bufferMinutes;
  }

  return slots;
}

// ─── Booking overlap check ──────────────────────────────────────────────────

function countOverlappingBookings(
  resourceId: string,
  date: string,
  slotStart: string | undefined,
  slotEnd: string | undefined,
  bookings: Booking[],
): number {
  return bookings.filter((b) => {
    if (b.resourceId !== resourceId) return false;
    if (b.status === "cancelled") return false;
    if (!dateInRange(date, b.startDate, b.endDate)) return false;

    // For hourly mode, check time overlap
    if (slotStart && slotEnd && b.startTime && b.endTime) {
      const slotStartMins = timeToMinutes(slotStart);
      const slotEndMins = timeToMinutes(slotEnd);
      const bookStartMins = timeToMinutes(b.startTime);
      const bookEndMins = timeToMinutes(b.endTime);
      return slotStartMins < bookEndMins && slotEndMins > bookStartMins;
    }

    // Daily mode: any overlap on same date counts
    return true;
  }).length;
}

// ─── Main availability function ─────────────────────────────────────────────

export function getAvailableSlots(
  calendar: Calendar,
  resources: CalendarResource[],
  bookings: Booking[],
  blocks: BlockedPeriod[],
  _rules: MinimumStayRule[],
  date: string,
  _durationMinutes?: number,
): AvailableSlot[] {
  if (!calendar.active) return [];

  const activeResources = resources.filter((r) => r.active);
  if (activeResources.length === 0) return [];

  const dow = getDayOfWeek(date);
  const daySched = calendar.schedule[dow];
  if (!daySched?.enabled) return [];

  // Check max advance
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return [];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + calendar.maxAdvanceDays);
  if (date > maxDate.toISOString().slice(0, 10)) return [];

  const calBlocks = blocks.filter((b) => b.calendarId === calendar.id);
  const calBookings = bookings.filter((b) => b.calendarId === calendar.id);
  const result: AvailableSlot[] = [];

  if (calendar.bookingMode === "hourly") {
    const timeSlots = generateTimeSlots(calendar, date);

    for (const resource of activeResources) {
      for (const slot of timeSlots) {
        if (isTimeSlotBlocked(date, slot.start, slot.end, calBlocks, resource.id)) continue;

        const overlapping = countOverlappingBookings(resource.id, date, slot.start, slot.end, calBookings);
        if (overlapping >= resource.capacity) continue;

        result.push({
          resourceId: resource.id,
          resourceName: resource.name,
          date,
          startTime: slot.start,
          endTime: slot.end,
        });
      }
    }
  } else {
    // Daily mode
    for (const resource of activeResources) {
      if (isDateBlocked(date, calBlocks, resource.id)) continue;

      const overlapping = countOverlappingBookings(resource.id, date, undefined, undefined, calBookings);
      if (overlapping >= resource.capacity) continue;

      result.push({
        resourceId: resource.id,
        resourceName: resource.name,
        date,
      });
    }
  }

  return result;
}

// ─── Date range availability ────────────────────────────────────────────────

export interface ResourceRangeAvailability {
  resourceId: string;
  resourceName: string;
  availableDates: string[];
  blockedDates: string[];
  minStayIssues: string[];
}

/** Generate array of YYYY-MM-DD strings between start and end (inclusive) */
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Check availability across a date range for all resources.
 * Returns per-resource summary of available vs blocked dates.
 */
export function getAvailableSlotsForRange(
  calendar: Calendar,
  resources: CalendarResource[],
  bookings: Booking[],
  blocks: BlockedPeriod[],
  rules: MinimumStayRule[],
  startDate: string,
  endDate: string,
): ResourceRangeAvailability[] {
  if (!calendar.active) return [];

  const activeResources = resources.filter((r) => r.active);
  if (activeResources.length === 0) return [];

  const dates = generateDateRange(startDate, endDate);
  const calBlocks = blocks.filter((b) => b.calendarId === calendar.id);
  const calBookings = bookings.filter((b) => b.calendarId === calendar.id);
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + calendar.maxAdvanceDays);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  return activeResources.map((resource) => {
    const availableDates: string[] = [];
    const blockedDates: string[] = [];
    const minStayIssues: string[] = [];

    for (const date of dates) {
      if (date < today || date > maxDateStr) { blockedDates.push(date); continue; }

      const dow = getDayOfWeek(date);
      const daySched = calendar.schedule[dow];
      if (!daySched?.enabled) { blockedDates.push(date); continue; }

      if (isDateBlocked(date, calBlocks, resource.id)) { blockedDates.push(date); continue; }

      const overlapping = countOverlappingBookings(resource.id, date, undefined, undefined, calBookings);
      if (overlapping >= resource.capacity) { blockedDates.push(date); continue; }

      availableDates.push(date);
    }

    // Check min stay rules for the requested range
    const rule = getApplicableMinStayRule(startDate, endDate, rules);
    if (rule && rule.unitType === "days") {
      const requestedDays = dates.length;
      if (requestedDays < rule.minimumUnits) {
        minStayIssues.push(`Estadía mínima de ${rule.minimumUnits} días para el período "${rule.name}"`);
      }
    }

    return { resourceId: resource.id, resourceName: resource.name, availableDates, blockedDates, minStayIssues };
  });
}

// ─── Resource search by specifications ──────────────────────────────────────

export interface ResourceMatch {
  resource: CalendarResource;
  available: boolean;
  availableDates?: string[];
  totalDatesInRange?: number;
  capacityMatch: boolean;
  featureMatches: string[];
  missingFeatures: string[];
  reason?: string;
}

export interface SearchResourcesResult {
  matches: ResourceMatch[];
  suggestions: ResourceMatch[];
}

/**
 * Search resources by criteria: capacity, features, and availability in a date range.
 * Returns exact matches and alternative suggestions.
 */
export function searchResources(
  calendar: Calendar,
  resources: CalendarResource[],
  bookings: Booking[],
  blocks: BlockedPeriod[],
  rules: MinimumStayRule[],
  criteria: {
    minCapacity?: number;
    startDate?: string;
    endDate?: string;
    requiredFeatures?: string[];
    query?: string;
  },
): SearchResourcesResult {
  const activeResources = resources.filter((r) => r.active);
  const matches: ResourceMatch[] = [];
  const suggestions: ResourceMatch[] = [];

  for (const resource of activeResources) {
    // 1. Capacity check
    const resourceCapacity = parseInt(String(resource.metadata?.capacidad_personas ?? "0"), 10) || 0;
    const capacityMatch = !criteria.minCapacity || resourceCapacity >= criteria.minCapacity;

    // 2. Feature matching (fuzzy: check metadata values and description)
    const searchableText = [
      resource.name,
      resource.description ?? "",
      ...Object.values(resource.metadata ?? {}),
    ].join(" ").toLowerCase();

    const featureMatches: string[] = [];
    const missingFeatures: string[] = [];

    if (criteria.requiredFeatures) {
      for (const feat of criteria.requiredFeatures) {
        if (searchableText.includes(feat.toLowerCase())) {
          featureMatches.push(feat);
        } else {
          missingFeatures.push(feat);
        }
      }
    }

    // Also match against free-text query
    if (criteria.query) {
      const queryTerms = criteria.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
      for (const term of queryTerms) {
        if (searchableText.includes(term) && !featureMatches.includes(term)) {
          featureMatches.push(term);
        }
      }
    }

    // 3. Availability in date range
    let available = true;
    let availableDates: string[] | undefined;
    let totalDatesInRange: number | undefined;

    if (criteria.startDate && criteria.endDate) {
      const rangeResult = getAvailableSlotsForRange(
        calendar, [resource], bookings, blocks, rules,
        criteria.startDate, criteria.endDate,
      );
      const rr = rangeResult[0];
      if (rr) {
        availableDates = rr.availableDates;
        totalDatesInRange = rr.availableDates.length + rr.blockedDates.length;
        available = rr.availableDates.length > 0;
      }
    }

    const match: ResourceMatch = {
      resource,
      available,
      availableDates,
      totalDatesInRange,
      capacityMatch,
      featureMatches,
      missingFeatures,
    };

    // Classify as match or suggestion
    const isExactMatch = capacityMatch && missingFeatures.length === 0 && available;

    if (isExactMatch) {
      matches.push(match);
    } else {
      // Capacity is exclusionary if >50% over required
      if (criteria.minCapacity && resourceCapacity > 0 && resourceCapacity < criteria.minCapacity * 0.5) {
        match.reason = `Capacidad insuficiente (${resourceCapacity} personas, se requieren ${criteria.minCapacity})`;
        // Skip — too far from requirement
        continue;
      }

      if (!capacityMatch && criteria.minCapacity) {
        match.reason = `Capacidad para ${resourceCapacity} personas (se necesitan ${criteria.minCapacity})`;
      } else if (!available) {
        match.reason = `Sin disponibilidad completa en el rango solicitado (${availableDates?.length ?? 0}/${totalDatesInRange ?? 0} días disponibles)`;
      } else if (missingFeatures.length > 0) {
        match.reason = `No cuenta con: ${missingFeatures.join(", ")}`;
      }

      suggestions.push(match);
    }
  }

  return { matches, suggestions };
}

// ─── Find nearest availability ──────────────────────────────────────────────

export interface NearestAvailabilityResult {
  resourceId: string;
  resourceName: string;
  nearestDates: string[];
  /** How many days from the reference date to the first available date */
  daysAway: number;
}

/**
 * Starting from `referenceDate`, scan forward day-by-day up to `maxDaysForward`
 * to find the nearest dates with availability for each resource.
 * Returns resources sorted by proximity (nearest first).
 */
export function findNearestAvailability(
  calendar: Calendar,
  resources: CalendarResource[],
  bookings: Booking[],
  blocks: BlockedPeriod[],
  rules: MinimumStayRule[],
  referenceDate: string,
  maxDaysForward = 90,
): NearestAvailabilityResult[] {
  if (!calendar.active) return [];
  const activeResources = resources.filter((r) => r.active);
  if (activeResources.length === 0) return [];

  const calBlocks = blocks.filter((b) => b.calendarId === calendar.id);
  const calBookings = bookings.filter((b) => b.calendarId === calendar.id);
  const today = new Date().toISOString().slice(0, 10);
  const maxAdvDate = new Date();
  maxAdvDate.setDate(maxAdvDate.getDate() + calendar.maxAdvanceDays);
  const maxAdvStr = maxAdvDate.toISOString().slice(0, 10);

  const startFrom = referenceDate < today ? today : referenceDate;
  const results: NearestAvailabilityResult[] = [];

  for (const resource of activeResources) {
    const nearestDates: string[] = [];
    let daysAway = 0;

    const cursor = new Date(startFrom + "T12:00:00");
    for (let d = 0; d < maxDaysForward; d++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      if (dateStr > maxAdvStr) break;

      const dow = getDayOfWeek(dateStr);
      const daySched = calendar.schedule[dow];

      if (daySched?.enabled
        && !isDateBlocked(dateStr, calBlocks, resource.id)
        && countOverlappingBookings(resource.id, dateStr, undefined, undefined, calBookings) < resource.capacity) {
        if (nearestDates.length === 0) {
          daysAway = d;
        }
        nearestDates.push(dateStr);
        // Collect up to 7 consecutive available dates for context
        if (nearestDates.length >= 7) break;
      } else if (nearestDates.length > 0) {
        // Stop collecting once we hit a gap after finding availability
        break;
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (nearestDates.length > 0) {
      results.push({
        resourceId: resource.id,
        resourceName: resource.name,
        nearestDates,
        daysAway,
      });
    }
  }

  // Sort by nearest first
  results.sort((a, b) => a.daysAway - b.daysAway);
  return results;
}

// ─── Confirmation code ──────────────────────────────────────────────────────

export function generateConfirmationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BK-${code}`;
}
