"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import type { BlockedPeriod, BlockedPeriodFormData, Calendar, CalendarResource } from "@/types/calendar";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: BlockedPeriodFormData) => void;
  block?: BlockedPeriod;
  calendars: Calendar[];
  resources: CalendarResource[];
  preselectedCalendarId?: string;
}

export default function BlockedPeriodModal({ open, onClose, onSave, block, calendars, resources, preselectedCalendarId }: Props) {
  const [calendarId, setCalendarId] = useState("");
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (block) {
      setCalendarId(block.calendarId);
      setResourceId(block.resourceId);
      setName(block.name);
      setStartDate(block.startDate);
      setEndDate(block.endDate);
      setStartTime(block.startTime ?? "");
      setEndTime(block.endTime ?? "");
      setRecurring(block.recurring);
    } else {
      setCalendarId(preselectedCalendarId ?? calendars[0]?.id ?? "");
      setResourceId(null);
      setName("");
      setStartDate("");
      setEndDate("");
      setStartTime("");
      setEndTime("");
      setRecurring(false);
    }
    setErrors([]);
  }, [block, open, preselectedCalendarId, calendars]);

  if (!open) return null;

  const selectedCalendar = calendars.find((c) => c.id === calendarId);
  const calendarResources = resources.filter((r) => r.calendarId === calendarId);
  const isHourly = selectedCalendar?.bookingMode === "hourly";

  const handleSave = () => {
    const errs: string[] = [];
    if (!calendarId) errs.push("Seleccioná un calendario");
    if (!name.trim()) errs.push("El nombre es obligatorio");
    if (!startDate) errs.push("La fecha inicio es obligatoria");
    if (!endDate) errs.push("La fecha fin es obligatoria");
    if (startDate && endDate && startDate > endDate) errs.push("La fecha fin debe ser posterior a la fecha inicio");
    if (errs.length > 0) { setErrors(errs); return; }

    onSave({
      calendarId,
      resourceId,
      name: name.trim(),
      startDate,
      endDate,
      startTime: isHourly && startTime ? startTime : undefined,
      endTime: isHourly && endTime ? endTime : undefined,
      recurring,
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
            {block ? "Editar bloqueo" : "Nuevo bloqueo"}
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

          <div>
            <label className={labelCls}>Calendario *</label>
            <select className={inputCls} value={calendarId} onChange={(e) => { setCalendarId(e.target.value); setResourceId(null); }}>
              <option value="">Seleccionar...</option>
              {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Recurso (opcional)</label>
            <select className={inputCls} value={resourceId ?? ""} onChange={(e) => setResourceId(e.target.value || null)}>
              <option value="">Todos los recursos</option>
              {calendarResources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1">Si no se selecciona, el bloqueo aplica a todos los recursos</p>
          </div>

          <div>
            <label className={labelCls}>Nombre *</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Feriado nacional" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fecha inicio *</label>
              <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Fecha fin *</label>
              <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {isHourly && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Hora inicio (opcional)</label>
                <input type="time" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Hora fin (opcional)</label>
                <input type="time" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-slate-500">Si no se especifica horario, se bloquea el día completo</p>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430]"
            />
            <span className="text-sm text-slate-300">Recurrente anual</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors text-sm">
            {block ? "Guardar cambios" : "Crear bloqueo"}
          </button>
        </div>
      </div>
    </div>
  );
}
