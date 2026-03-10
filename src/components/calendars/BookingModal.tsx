"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import type { Booking, BookingFormData, BookingStatus, Calendar, CalendarResource } from "@/types/calendar";
import { BOOKING_STATUS_CONFIG } from "@/types/calendar";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: BookingFormData) => void;
  booking?: Booking;
  calendars: Calendar[];
  resources: CalendarResource[];
  preselectedCalendarId?: string;
  preselectedResourceId?: string;
  preselectedDate?: string;
  validateBooking?: (
    calendarId: string,
    resourceId: string,
    startDate: string,
    endDate: string,
    startTime?: string,
    endTime?: string,
  ) => { valid: boolean; error?: string };
}

export default function BookingModal({
  open, onClose, onSave, booking, calendars, resources,
  preselectedCalendarId, preselectedResourceId, preselectedDate, validateBooking,
}: Props) {
  const [calendarId, setCalendarId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<BookingStatus>("confirmed");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (booking) {
      setCalendarId(booking.calendarId);
      setResourceId(booking.resourceId);
      setStartDate(booking.startDate);
      setEndDate(booking.endDate);
      setStartTime(booking.startTime ?? "");
      setEndTime(booking.endTime ?? "");
      setContactName(booking.contactName);
      setContactPhone(booking.contactPhone ?? "");
      setContactEmail(booking.contactEmail ?? "");
      setNotes(booking.notes ?? "");
      setStatus(booking.status);
    } else {
      setCalendarId(preselectedCalendarId ?? calendars[0]?.id ?? "");
      setResourceId(preselectedResourceId ?? "");
      setStartDate(preselectedDate ?? "");
      setEndDate(preselectedDate ?? "");
      setStartTime("");
      setEndTime("");
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      setNotes("");
      setStatus("confirmed");
    }
    setErrors([]);
  }, [booking, open, preselectedCalendarId, preselectedResourceId, preselectedDate, calendars]);

  if (!open) return null;

  const selectedCalendar = calendars.find((c) => c.id === calendarId);
  const calendarResources = resources.filter((r) => r.calendarId === calendarId);
  const isHourly = selectedCalendar?.bookingMode === "hourly";

  const handleSave = () => {
    const errs: string[] = [];
    if (!calendarId) errs.push("Seleccioná un calendario");
    if (!resourceId) errs.push("Seleccioná un recurso");
    if (!startDate) errs.push("La fecha inicio es obligatoria");
    if (!endDate) errs.push("La fecha fin es obligatoria");
    if (isHourly && !startTime) errs.push("La hora inicio es obligatoria");
    if (isHourly && !endTime) errs.push("La hora fin es obligatoria");
    if (!contactName.trim()) errs.push("El nombre del contacto es obligatorio");
    if (errs.length > 0) { setErrors(errs); return; }

    // Validate availability (only for new bookings)
    if (!booking && validateBooking) {
      const result = validateBooking(calendarId, resourceId, startDate, endDate, startTime || undefined, endTime || undefined);
      if (!result.valid) {
        setErrors([result.error ?? "Sin disponibilidad"]);
        return;
      }
    }

    onSave({
      calendarId,
      resourceId,
      startDate,
      endDate,
      startTime: isHourly ? startTime : undefined,
      endTime: isHourly ? endTime : undefined,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
      source: "manual",
    });
    onClose();
  };

  const inputCls = "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none focus:ring-1 focus:ring-[#dd7430] text-sm";
  const labelCls = "block text-sm font-medium text-slate-300 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {booking ? "Detalle de reserva" : "Nueva reserva manual"}
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

          {booking && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Código:</span>
              <span className="font-mono text-sm text-[#dd7430]">{booking.confirmationCode}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Calendario *</label>
              <select className={inputCls} value={calendarId} onChange={(e) => { setCalendarId(e.target.value); setResourceId(""); }}>
                <option value="">Seleccionar...</option>
                {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Recurso *</label>
              <select className={inputCls} value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {calendarResources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fecha inicio *</label>
              <input type="date" className={inputCls} value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }} />
            </div>
            <div>
              <label className={labelCls}>Fecha fin *</label>
              <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {isHourly && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Hora inicio *</label>
                <input type="time" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Hora fin *</label>
                <input type="time" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nombre contacto *</label>
              <input className={inputCls} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input className={inputCls} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+54 9 ..." />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="email@ejemplo.com" />
          </div>

          <div>
            <label className={labelCls}>Notas</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </div>

          <div>
            <label className={labelCls}>Estado</label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
              {(Object.keys(BOOKING_STATUS_CONFIG) as BookingStatus[]).map((s) => (
                <option key={s} value={s}>{BOOKING_STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors text-sm">
            {booking ? "Guardar cambios" : "Crear reserva"}
          </button>
        </div>
      </div>
    </div>
  );
}
