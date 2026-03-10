"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Calendar, CalendarResource, Booking, BlockedPeriod } from "@/types/calendar";
import { DAYS_OF_WEEK } from "@/types/calendar";
import { isDateBlocked } from "@/lib/calendar-availability";

interface Props {
  calendar: Calendar;
  resources: CalendarResource[];
  bookings: Booking[];
  blockedPeriods: BlockedPeriod[];
  onDateClick?: (date: string) => void;
}

export default function CalendarViewPanel({ calendar, resources, bookings, blockedPeriods, onDateClick }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const calBlocks = blockedPeriods.filter((b) => b.calendarId === calendar.id);
  const calBookings = bookings.filter((b) => b.calendarId === calendar.id && b.status !== "cancelled");
  const activeResources = resources.filter((r) => r.calendarId === calendar.id && r.active);
  const totalCapacity = activeResources.reduce((sum, r) => sum + r.capacity, 0);

  const days = useMemo(() => {
    const year = currentMonth.year;
    const month = currentMonth.month;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday-based week: 0=Mon ... 6=Sun
    const startDow = (firstDay.getDay() + 6) % 7;

    const cells: { date: string; day: number; inMonth: boolean }[] = [];

    // Fill preceding days
    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -startDow + i + 1);
      cells.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), inMonth: false });
    }

    // Fill month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dt = new Date(year, month, d);
      cells.push({ date: dt.toISOString().slice(0, 10), day: d, inMonth: true });
    }

    // Fill trailing days
    while (cells.length % 7 !== 0) {
      const d = new Date(year, month + 1, cells.length - startDow - lastDay.getDate() + 1);
      cells.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), inMonth: false });
    }

    return cells;
  }, [currentMonth]);

  const getCellStatus = (date: string) => {
    const dow = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
    const d = new Date(date + "T12:00:00");
    const dayKey = dow[d.getDay()];
    const schedDay = calendar.schedule[dayKey];

    if (!schedDay?.enabled) return "closed";
    if (isDateBlocked(date, calBlocks)) return "blocked";

    const bookingsOnDate = calBookings.filter((b) => date >= b.startDate && date <= b.endDate);
    if (bookingsOnDate.length === 0) return "available";
    if (bookingsOnDate.length >= totalCapacity) return "full";
    return "partial";
  };

  const statusColors = {
    closed:    "bg-slate-800/30 text-slate-600",
    blocked:   "bg-red-900/20 text-red-400 border-red-800/30",
    available: "bg-emerald-900/20 text-emerald-400 border-emerald-800/30 cursor-pointer hover:bg-emerald-900/30",
    partial:   "bg-amber-900/20 text-amber-400 border-amber-800/30 cursor-pointer hover:bg-amber-900/30",
    full:      "bg-red-900/15 text-red-300 border-red-800/20",
  };

  const prevMonth = () => {
    setCurrentMonth((prev) => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 });
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 });
  };

  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="size-5" />
        </button>
        <h3 className="text-sm font-semibold text-white capitalize">{monthLabel}</h3>
        <button onClick={nextMonth} className="p-1 text-slate-400 hover:text-white transition-colors">
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_OF_WEEK.map(({ short }) => (
          <div key={short} className="text-center text-xs text-slate-500 font-medium py-1">{short}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, day, inMonth }) => {
          const status = inMonth ? getCellStatus(date) : "closed";
          const isToday = date === today;
          const clickable = status === "available" || status === "partial";

          return (
            <button
              key={date}
              onClick={() => clickable && onDateClick?.(date)}
              disabled={!clickable}
              className={`relative aspect-square flex items-center justify-center rounded-lg text-xs font-medium border border-transparent transition-all ${
                inMonth ? statusColors[status] : "text-slate-700"
              } ${isToday ? "ring-1 ring-[#dd7430]" : ""}`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-700/50">
        {[
          { color: "bg-emerald-400", label: "Disponible" },
          { color: "bg-amber-400", label: "Parcial" },
          { color: "bg-red-400", label: "Bloqueado/Lleno" },
          { color: "bg-slate-600", label: "Cerrado" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`size-2 rounded-full ${color}`} />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
