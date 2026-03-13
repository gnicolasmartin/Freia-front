"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import type {
  Calendar,
  CalendarFormData,
  CalendarResource,
  ResourceFormData,
  BlockedPeriod,
  BlockedPeriodFormData,
  MinimumStayRule,
  MinimumStayRuleFormData,
  Booking,
  BookingFormData,
  AvailableSlot,
} from "@/types/calendar";
import {
  getAvailableSlots as computeAvailableSlots,
  validateMinimumStay,
  generateConfirmationCode,
} from "@/lib/calendar-availability";
import { getSessionCompanyId } from "@/lib/get-session-company";

// ─── localStorage keys ───────────────────────────────────────────────────────

const CALENDARS_KEY = "freia_calendars";
const RESOURCES_KEY = "freia_calendar_resources";
const BLOCKS_KEY = "freia_calendar_blocks";
const RULES_KEY = "freia_calendar_min_stay_rules";
const BOOKINGS_KEY = "freia_bookings";

// ─── Context type ────────────────────────────────────────────────────────────

interface CalendarsContextType {
  calendars: Calendar[];
  addCalendar: (data: CalendarFormData) => Calendar;
  updateCalendar: (id: string, data: Partial<CalendarFormData>) => void;
  deleteCalendar: (id: string) => void;
  getCalendar: (id: string) => Calendar | undefined;

  resources: CalendarResource[];
  getResourcesByCalendar: (calendarId: string) => CalendarResource[];
  addResource: (data: ResourceFormData) => CalendarResource;
  updateResource: (id: string, data: Partial<ResourceFormData>) => void;
  deleteResource: (id: string) => void;

  blockedPeriods: BlockedPeriod[];
  getBlocksByCalendar: (calendarId: string) => BlockedPeriod[];
  addBlockedPeriod: (data: BlockedPeriodFormData) => BlockedPeriod;
  updateBlockedPeriod: (id: string, data: Partial<BlockedPeriodFormData>) => void;
  deleteBlockedPeriod: (id: string) => void;

  minStayRules: MinimumStayRule[];
  getRulesByCalendar: (calendarId: string) => MinimumStayRule[];
  addMinStayRule: (data: MinimumStayRuleFormData) => MinimumStayRule;
  updateMinStayRule: (id: string, data: Partial<MinimumStayRuleFormData>) => void;
  deleteMinStayRule: (id: string) => void;

  bookings: Booking[];
  getBookingsByCalendar: (calendarId: string) => Booking[];
  getBookingsByResource: (resourceId: string) => Booking[];
  addBooking: (data: BookingFormData) => Booking;
  updateBooking: (id: string, data: Partial<BookingFormData>) => void;
  cancelBooking: (id: string) => void;
  /** Merge bookings created server-side (e.g., via WhatsApp flow). Deduplicates by id. */
  mergeServerBookings: (serverBookings: Booking[]) => void;

  getAvailableSlots: (calendarId: string, date: string, durationMinutes?: number) => AvailableSlot[];
  validateBooking: (
    calendarId: string,
    resourceId: string,
    startDate: string,
    endDate: string,
    startTime?: string,
    endTime?: string,
  ) => { valid: boolean; error?: string };
}

const CalendarsContext = createContext<CalendarsContextType | undefined>(undefined);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadFromStorage<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function CalendarsProvider({ children }: { children: React.ReactNode }) {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [resources, setResources] = useState<CalendarResource[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [minStayRules, setMinStayRules] = useState<MinimumStayRule[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Hydrate
  useEffect(() => {
    setCalendars(loadFromStorage<Calendar>(CALENDARS_KEY));
    setResources(loadFromStorage<CalendarResource>(RESOURCES_KEY));
    setBlockedPeriods(loadFromStorage<BlockedPeriod>(BLOCKS_KEY));
    setMinStayRules(loadFromStorage<MinimumStayRule>(RULES_KEY));
    setBookings(loadFromStorage<Booking>(BOOKINGS_KEY));
  }, []);

  // Persist helpers
  const persistCalendars = (v: Calendar[]) => { setCalendars(v); localStorage.setItem(CALENDARS_KEY, JSON.stringify(v)); };
  const persistResources = (v: CalendarResource[]) => { setResources(v); localStorage.setItem(RESOURCES_KEY, JSON.stringify(v)); };
  const persistBlocks = (v: BlockedPeriod[]) => { setBlockedPeriods(v); localStorage.setItem(BLOCKS_KEY, JSON.stringify(v)); };
  const persistRules = (v: MinimumStayRule[]) => { setMinStayRules(v); localStorage.setItem(RULES_KEY, JSON.stringify(v)); };
  const persistBookings = (v: Booking[]) => { setBookings(v); localStorage.setItem(BOOKINGS_KEY, JSON.stringify(v)); };

  // ── Calendars ──────────────────────────────────────────────

  const addCalendar = (data: CalendarFormData): Calendar => {
    const now = new Date().toISOString();
    const cal: Calendar = {
      ...data,
      id: crypto.randomUUID(),
      companyId: data.companyId ?? getSessionCompanyId(),
      createdAt: now,
      updatedAt: now,
    };
    persistCalendars([...calendars, cal]);
    return cal;
  };

  const updateCalendar = (id: string, data: Partial<CalendarFormData>) => {
    persistCalendars(
      calendars.map((c) =>
        c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
      ),
    );
  };

  const deleteCalendar = (id: string) => {
    persistCalendars(calendars.filter((c) => c.id !== id));
    persistResources(resources.filter((r) => r.calendarId !== id));
    persistBlocks(blockedPeriods.filter((b) => b.calendarId !== id));
    persistRules(minStayRules.filter((r) => r.calendarId !== id));
    persistBookings(bookings.filter((b) => b.calendarId !== id));
  };

  const getCalendar = (id: string) => calendars.find((c) => c.id === id);

  // ── Resources ──────────────────────────────────────────────

  const getResourcesByCalendar = (calendarId: string) =>
    resources.filter((r) => r.calendarId === calendarId);

  const addResource = (data: ResourceFormData): CalendarResource => {
    const now = new Date().toISOString();
    const res: CalendarResource = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persistResources([...resources, res]);
    return res;
  };

  const updateResource = (id: string, data: Partial<ResourceFormData>) => {
    persistResources(
      resources.map((r) =>
        r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r
      ),
    );
  };

  const deleteResource = (id: string) => {
    persistResources(resources.filter((r) => r.id !== id));
    persistBlocks(blockedPeriods.filter((b) => b.resourceId !== id));
    persistBookings(bookings.filter((b) => b.resourceId !== id));
  };

  // ── Blocked Periods ────────────────────────────────────────

  const getBlocksByCalendar = (calendarId: string) =>
    blockedPeriods.filter((b) => b.calendarId === calendarId);

  const addBlockedPeriod = (data: BlockedPeriodFormData): BlockedPeriod => {
    const now = new Date().toISOString();
    const bp: BlockedPeriod = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persistBlocks([...blockedPeriods, bp]);
    return bp;
  };

  const updateBlockedPeriod = (id: string, data: Partial<BlockedPeriodFormData>) => {
    persistBlocks(
      blockedPeriods.map((b) =>
        b.id === id ? { ...b, ...data, updatedAt: new Date().toISOString() } : b
      ),
    );
  };

  const deleteBlockedPeriod = (id: string) => {
    persistBlocks(blockedPeriods.filter((b) => b.id !== id));
  };

  // ── Minimum Stay Rules ─────────────────────────────────────

  const getRulesByCalendar = (calendarId: string) =>
    minStayRules.filter((r) => r.calendarId === calendarId);

  const addMinStayRule = (data: MinimumStayRuleFormData): MinimumStayRule => {
    const now = new Date().toISOString();
    const rule: MinimumStayRule = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persistRules([...minStayRules, rule]);
    return rule;
  };

  const updateMinStayRule = (id: string, data: Partial<MinimumStayRuleFormData>) => {
    persistRules(
      minStayRules.map((r) =>
        r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r
      ),
    );
  };

  const deleteMinStayRule = (id: string) => {
    persistRules(minStayRules.filter((r) => r.id !== id));
  };

  // ── Bookings ───────────────────────────────────────────────

  const getBookingsByCalendar = (calendarId: string) =>
    bookings.filter((b) => b.calendarId === calendarId);

  const getBookingsByResource = (resourceId: string) =>
    bookings.filter((b) => b.resourceId === resourceId);

  const addBooking = (data: BookingFormData): Booking => {
    const now = new Date().toISOString();
    const booking: Booking = {
      ...data,
      id: crypto.randomUUID(),
      confirmationCode: generateConfirmationCode(),
      createdAt: now,
      updatedAt: now,
    };
    persistBookings([...bookings, booking]);
    return booking;
  };

  const updateBooking = (id: string, data: Partial<BookingFormData>) => {
    persistBookings(
      bookings.map((b) =>
        b.id === id ? { ...b, ...data, updatedAt: new Date().toISOString() } : b
      ),
    );
  };

  const cancelBooking = (id: string) => {
    persistBookings(
      bookings.map((b) =>
        b.id === id ? { ...b, status: "cancelled" as const, updatedAt: new Date().toISOString() } : b
      ),
    );
  };

  const mergeServerBookings = (serverBookings: Booking[]) => {
    // Deduplicate by both id AND confirmationCode to handle cases where
    // the same booking exists with different IDs (e.g., after demo re-seed)
    const existingIds = new Set(bookings.map((b) => b.id));
    const existingCodes = new Set(bookings.map((b) => b.confirmationCode));
    const newBookings = serverBookings.filter(
      (b) => !existingIds.has(b.id) && !existingCodes.has(b.confirmationCode)
    );
    if (newBookings.length > 0) {
      console.info(`[CalendarsProvider] Merging ${newBookings.length} server-side bookings`);
      persistBookings([...bookings, ...newBookings]);
    }
  };

  // ── Availability ───────────────────────────────────────────

  const getAvailableSlots = (calendarId: string, date: string, durationMinutes?: number): AvailableSlot[] => {
    const calendar = calendars.find((c) => c.id === calendarId);
    if (!calendar) return [];
    const calResources = resources.filter((r) => r.calendarId === calendarId);
    const calBookings = bookings.filter((b) => b.calendarId === calendarId);
    const calBlocks = blockedPeriods.filter((b) => b.calendarId === calendarId);
    const calRules = minStayRules.filter((r) => r.calendarId === calendarId);
    return computeAvailableSlots(calendar, calResources, calBookings, calBlocks, calRules, date, durationMinutes);
  };

  const validateBookingFn = (
    calendarId: string,
    resourceId: string,
    startDate: string,
    endDate: string,
    startTime?: string,
    endTime?: string,
  ): { valid: boolean; error?: string } => {
    const calendar = calendars.find((c) => c.id === calendarId);
    if (!calendar) return { valid: false, error: "Calendario no encontrado" };
    if (!calendar.active) return { valid: false, error: "Calendario inactivo" };

    const resource = resources.find((r) => r.id === resourceId);
    if (!resource) return { valid: false, error: "Recurso no encontrado" };
    if (!resource.active) return { valid: false, error: "Recurso inactivo" };

    // Check min stay
    const calRules = minStayRules.filter((r) => r.calendarId === calendarId);
    const minStayResult = validateMinimumStay(startDate, endDate, startTime, endTime, calRules);
    if (!minStayResult.valid) {
      return {
        valid: false,
        error: `Estadía mínima: ${minStayResult.minimumRequired} ${minStayResult.unitType === "days" ? "días" : "minutos"}`,
      };
    }

    // Check availability for each date in range
    const calBlocks = blockedPeriods.filter((b) => b.calendarId === calendarId);
    const calBookings = bookings.filter((b) => b.calendarId === calendarId);
    const calResources = resources.filter((r) => r.calendarId === calendarId);
    const slots = computeAvailableSlots(
      calendar, calResources, calBookings, calBlocks, calRules, startDate,
    );

    const hasSlot = slots.some((s) => {
      if (s.resourceId !== resourceId) return false;
      if (startTime && s.startTime !== startTime) return false;
      return true;
    });

    if (!hasSlot) return { valid: false, error: "Sin disponibilidad para la fecha/hora seleccionada" };

    return { valid: true };
  };

  // ── Context value ──────────────────────────────────────────

  // Filter by current user's company (root sees all)
  const scopedCalendars = useMemo(() => {
    const companyId = getSessionCompanyId();
    if (!companyId) return calendars;
    return calendars.filter((c) => c.companyId === companyId);
  }, [calendars]);

  const scopedCalendarIds = useMemo(() => new Set(scopedCalendars.map((c) => c.id)), [scopedCalendars]);
  const scopedResources = useMemo(() => resources.filter((r) => scopedCalendarIds.has(r.calendarId)), [resources, scopedCalendarIds]);
  const scopedBlocks = useMemo(() => blockedPeriods.filter((b) => scopedCalendarIds.has(b.calendarId)), [blockedPeriods, scopedCalendarIds]);
  const scopedRules = useMemo(() => minStayRules.filter((r) => scopedCalendarIds.has(r.calendarId)), [minStayRules, scopedCalendarIds]);
  const scopedBookings = useMemo(() => bookings.filter((b) => scopedCalendarIds.has(b.calendarId)), [bookings, scopedCalendarIds]);

  const value: CalendarsContextType = {
    calendars: scopedCalendars,
    addCalendar,
    updateCalendar,
    deleteCalendar,
    getCalendar,
    resources: scopedResources,
    getResourcesByCalendar,
    addResource,
    updateResource,
    deleteResource,
    blockedPeriods: scopedBlocks,
    getBlocksByCalendar,
    addBlockedPeriod,
    updateBlockedPeriod,
    deleteBlockedPeriod,
    minStayRules: scopedRules,
    getRulesByCalendar,
    addMinStayRule,
    updateMinStayRule,
    deleteMinStayRule,
    bookings: scopedBookings,
    getBookingsByCalendar,
    getBookingsByResource,
    addBooking,
    updateBooking,
    cancelBooking,
    mergeServerBookings,
    getAvailableSlots,
    validateBooking: validateBookingFn,
  };

  return (
    <CalendarsContext.Provider value={value}>
      {children}
    </CalendarsContext.Provider>
  );
}

export function useCalendars(): CalendarsContextType {
  const ctx = useContext(CalendarsContext);
  if (!ctx) throw new Error("useCalendars must be used within CalendarsProvider");
  return ctx;
}
