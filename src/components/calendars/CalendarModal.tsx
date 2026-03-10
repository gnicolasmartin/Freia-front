"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import type { Calendar, CalendarFormData, BookingMode, DayOfWeek, DaySchedule } from "@/types/calendar";
import { BOOKING_MODE_LABELS, DAYS_OF_WEEK, DEFAULT_SCHEDULE } from "@/types/calendar";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: CalendarFormData) => void;
  calendar?: Calendar;
}

const TIMEZONES = [
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Santiago",
  "America/Bogota",
  "America/Lima",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
];

export default function CalendarModal({ open, onClose, onSave, calendar }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bookingMode, setBookingMode] = useState<BookingMode>("hourly");
  const [timezone, setTimezone] = useState("America/Argentina/Buenos_Aires");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(60);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(30);
  const [schedule, setSchedule] = useState<Record<DayOfWeek, DaySchedule>>({ ...DEFAULT_SCHEDULE });
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (calendar) {
      setName(calendar.name);
      setDescription(calendar.description ?? "");
      setBookingMode(calendar.bookingMode);
      setTimezone(calendar.timezone);
      setSlotDurationMinutes(calendar.slotDurationMinutes);
      setBufferMinutes(calendar.bufferMinutes);
      setMaxAdvanceDays(calendar.maxAdvanceDays);
      setSchedule({ ...calendar.schedule });
      setActive(calendar.active);
    } else {
      setName("");
      setDescription("");
      setBookingMode("hourly");
      setTimezone("America/Argentina/Buenos_Aires");
      setSlotDurationMinutes(60);
      setBufferMinutes(0);
      setMaxAdvanceDays(30);
      setSchedule({ ...DEFAULT_SCHEDULE });
      setActive(true);
    }
    setErrors([]);
  }, [calendar, open]);

  if (!open) return null;

  const updateDaySchedule = (day: DayOfWeek, field: keyof DaySchedule, value: boolean | string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSave = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("El nombre es obligatorio");
    if (bookingMode === "hourly" && slotDurationMinutes < 5) errs.push("La duración mínima del turno es 5 minutos");
    if (maxAdvanceDays < 1) errs.push("Los días de anticipación deben ser al menos 1");
    if (errs.length > 0) { setErrors(errs); return; }

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      bookingMode,
      timezone,
      slotDurationMinutes,
      bufferMinutes,
      maxAdvanceDays,
      schedule,
      active,
    });
    onClose();
  };

  const inputCls = "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none focus:ring-1 focus:ring-[#dd7430] text-sm";
  const labelCls = "block text-sm font-medium text-slate-300 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {calendar ? "Editar calendario" : "Nuevo calendario"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errors.length > 0 && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0" /> {e}
                </p>
              ))}
            </div>
          )}

          {/* Name + Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Hotel Central" />
            </div>
            <div>
              <label className={labelCls}>Descripción</label>
              <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          {/* Booking mode */}
          <div>
            <label className={labelCls}>Modo de reserva</label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(BOOKING_MODE_LABELS) as BookingMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setBookingMode(mode)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    bookingMode === mode
                      ? "border-[#dd7430] bg-[#dd7430]/10 text-white"
                      : "border-slate-600 bg-slate-800/50 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  <p className="font-medium text-sm">{BOOKING_MODE_LABELS[mode].label}</p>
                  <p className="text-xs text-slate-400 mt-1">{BOOKING_MODE_LABELS[mode].description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Timezone + config */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Zona horaria</label>
              <select className={inputCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            {bookingMode === "hourly" && (
              <div>
                <label className={labelCls}>Duración turno (min)</label>
                <input type="number" className={inputCls} value={slotDurationMinutes} onChange={(e) => setSlotDurationMinutes(Number(e.target.value))} min={5} step={5} />
              </div>
            )}
            <div>
              <label className={labelCls}>Buffer entre turnos (min)</label>
              <input type="number" className={inputCls} value={bufferMinutes} onChange={(e) => setBufferMinutes(Number(e.target.value))} min={0} step={5} />
            </div>
            <div>
              <label className={labelCls}>Anticipación máxima (días)</label>
              <input type="number" className={inputCls} value={maxAdvanceDays} onChange={(e) => setMaxAdvanceDays(Number(e.target.value))} min={1} />
            </div>
          </div>

          {/* Weekly schedule */}
          <div>
            <label className={labelCls}>Horario semanal</label>
            <div className="space-y-2">
              {DAYS_OF_WEEK.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 bg-slate-800/30 rounded-lg px-3 py-2">
                  <label className="flex items-center gap-2 w-24 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedule[key].enabled}
                      onChange={(e) => updateDaySchedule(key, "enabled", e.target.checked)}
                      className="rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430]"
                    />
                    <span className={`text-sm ${schedule[key].enabled ? "text-white" : "text-slate-500"}`}>{label}</span>
                  </label>
                  {schedule[key].enabled && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={schedule[key].start}
                        onChange={(e) => updateDaySchedule(key, "start", e.target.value)}
                        className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-white text-sm focus:border-[#dd7430] focus:outline-none"
                      />
                      <span className="text-slate-500 text-sm">a</span>
                      <input
                        type="time"
                        value={schedule[key].end}
                        onChange={(e) => updateDaySchedule(key, "end", e.target.value)}
                        className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-white text-sm focus:border-[#dd7430] focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430]"
            />
            <span className="text-sm text-slate-300">Calendario activo</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors text-sm">
            {calendar ? "Guardar cambios" : "Crear calendario"}
          </button>
        </div>
      </div>
    </div>
  );
}
