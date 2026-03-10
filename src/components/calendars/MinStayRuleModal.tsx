"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import type { MinimumStayRule, MinimumStayRuleFormData, Calendar } from "@/types/calendar";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: MinimumStayRuleFormData) => void;
  rule?: MinimumStayRule;
  calendars: Calendar[];
  preselectedCalendarId?: string;
}

export default function MinStayRuleModal({ open, onClose, onSave, rule, calendars, preselectedCalendarId }: Props) {
  const [calendarId, setCalendarId] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minimumUnits, setMinimumUnits] = useState(1);
  const [unitType, setUnitType] = useState<"days" | "minutes">("days");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (rule) {
      setCalendarId(rule.calendarId);
      setName(rule.name);
      setStartDate(rule.startDate);
      setEndDate(rule.endDate);
      setMinimumUnits(rule.minimumUnits);
      setUnitType(rule.unitType);
    } else {
      setCalendarId(preselectedCalendarId ?? calendars[0]?.id ?? "");
      setName("");
      setStartDate("");
      setEndDate("");
      setMinimumUnits(1);
      // Auto-set unit type based on calendar mode
      const cal = calendars.find((c) => c.id === (preselectedCalendarId ?? calendars[0]?.id));
      setUnitType(cal?.bookingMode === "hourly" ? "minutes" : "days");
    }
    setErrors([]);
  }, [rule, open, preselectedCalendarId, calendars]);

  if (!open) return null;

  const selectedCalendar = calendars.find((c) => c.id === calendarId);

  const handleCalendarChange = (id: string) => {
    setCalendarId(id);
    const cal = calendars.find((c) => c.id === id);
    setUnitType(cal?.bookingMode === "hourly" ? "minutes" : "days");
  };

  const handleSave = () => {
    const errs: string[] = [];
    if (!calendarId) errs.push("Seleccioná un calendario");
    if (!name.trim()) errs.push("El nombre es obligatorio");
    if (!startDate) errs.push("La fecha inicio es obligatoria");
    if (!endDate) errs.push("La fecha fin es obligatoria");
    if (startDate && endDate && startDate > endDate) errs.push("La fecha fin debe ser posterior a la fecha inicio");
    if (minimumUnits < 1) errs.push("El mínimo debe ser al menos 1");
    if (errs.length > 0) { setErrors(errs); return; }

    onSave({
      calendarId,
      name: name.trim(),
      startDate,
      endDate,
      minimumUnits,
      unitType,
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
            {rule ? "Editar regla de estadía mínima" : "Nueva regla de estadía mínima"}
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
            <select className={inputCls} value={calendarId} onChange={(e) => handleCalendarChange(e.target.value)}>
              <option value="">Seleccionar...</option>
              {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Nombre *</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Temporada alta - mínimo 7 días" />
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Mínimo {unitType === "days" ? "días" : "minutos"} *
              </label>
              <input
                type="number"
                className={inputCls}
                value={minimumUnits}
                onChange={(e) => setMinimumUnits(Number(e.target.value))}
                min={1}
              />
            </div>
            <div>
              <label className={labelCls}>Unidad</label>
              <select className={inputCls} value={unitType} onChange={(e) => setUnitType(e.target.value as "days" | "minutes")}>
                <option value="days">Días</option>
                <option value="minutes">Minutos</option>
              </select>
              {selectedCalendar && (
                <p className="text-xs text-slate-500 mt-1">
                  Modo del calendario: {selectedCalendar.bookingMode === "hourly" ? "por hora" : "por día"}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors text-sm">
            {rule ? "Guardar cambios" : "Crear regla"}
          </button>
        </div>
      </div>
    </div>
  );
}
