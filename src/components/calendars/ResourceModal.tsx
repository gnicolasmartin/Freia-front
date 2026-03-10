"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle, Plus, Trash2 } from "lucide-react";
import type { CalendarResource, ResourceFormData, Calendar } from "@/types/calendar";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: ResourceFormData) => void;
  resource?: CalendarResource;
  calendars: Calendar[];
  preselectedCalendarId?: string;
}

export default function ResourceModal({ open, onClose, onSave, resource, calendars, preselectedCalendarId }: Props) {
  const [calendarId, setCalendarId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [metadata, setMetadata] = useState<{ key: string; value: string }[]>([]);
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (resource) {
      setCalendarId(resource.calendarId);
      setName(resource.name);
      setDescription(resource.description ?? "");
      setCapacity(resource.capacity);
      setMetadata(Object.entries(resource.metadata).map(([key, value]) => ({ key, value })));
      setActive(resource.active);
    } else {
      setCalendarId(preselectedCalendarId ?? calendars[0]?.id ?? "");
      setName("");
      setDescription("");
      setCapacity(1);
      setMetadata([]);
      setActive(true);
    }
    setErrors([]);
  }, [resource, open, preselectedCalendarId, calendars]);

  if (!open) return null;

  const handleSave = () => {
    const errs: string[] = [];
    if (!calendarId) errs.push("Seleccioná un calendario");
    if (!name.trim()) errs.push("El nombre es obligatorio");
    if (capacity < 1) errs.push("La capacidad debe ser al menos 1");
    if (errs.length > 0) { setErrors(errs); return; }

    const metaObj: Record<string, string> = {};
    metadata.forEach((m) => { if (m.key.trim()) metaObj[m.key.trim()] = m.value.trim(); });

    onSave({
      calendarId,
      name: name.trim(),
      description: description.trim() || undefined,
      capacity,
      metadata: metaObj,
      active,
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
            {resource ? "Editar recurso" : "Nuevo recurso"}
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
            <select className={inputCls} value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Habitación 101" />
            </div>
            <div>
              <label className={labelCls}>Capacidad</label>
              <input type="number" className={inputCls} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} min={1} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Descripción</label>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
          </div>

          {/* Metadata */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Metadatos</label>
              <button
                onClick={() => setMetadata([...metadata, { key: "", value: "" }])}
                className="text-xs text-[#dd7430] hover:text-orange-400 flex items-center gap-1"
              >
                <Plus className="size-3" /> Agregar
              </button>
            </div>
            {metadata.length === 0 && (
              <p className="text-xs text-slate-500">Sin metadatos adicionales</p>
            )}
            {metadata.map((m, i) => (
              <div key={i} className="flex items-center gap-2 mt-2">
                <input
                  className={`${inputCls} flex-1`}
                  value={m.key}
                  onChange={(e) => {
                    const updated = [...metadata];
                    updated[i] = { ...updated[i], key: e.target.value };
                    setMetadata(updated);
                  }}
                  placeholder="Clave"
                />
                <input
                  className={`${inputCls} flex-1`}
                  value={m.value}
                  onChange={(e) => {
                    const updated = [...metadata];
                    updated[i] = { ...updated[i], value: e.target.value };
                    setMetadata(updated);
                  }}
                  placeholder="Valor"
                />
                <button
                  onClick={() => setMetadata(metadata.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430]"
            />
            <span className="text-sm text-slate-300">Recurso activo</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors text-sm">
            {resource ? "Guardar cambios" : "Crear recurso"}
          </button>
        </div>
      </div>
    </div>
  );
}
