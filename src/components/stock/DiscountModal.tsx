"use client";

import { useState, useEffect } from "react";
import { X, Percent } from "lucide-react";
import { useProducts } from "@/providers/ProductsProvider";
import type { Discount } from "@/types/product";

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingDiscount?: Discount | null;
}

const inputClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 focus:outline-none";

const errorClasses =
  "w-full rounded-lg border border-red-500 bg-slate-800/50 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20 focus:outline-none";

interface FormState {
  name: string;
  percentage: string;
  description: string;
}

interface FormErrors {
  name?: string;
  percentage?: string;
}

const EMPTY_FORM: FormState = { name: "", percentage: "", description: "" };

export function DiscountModal({ isOpen, onClose, editingDiscount }: DiscountModalProps) {
  const { addDiscount, updateDiscount } = useProducts();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!isOpen) return;
    if (editingDiscount) {
      setForm({
        name: editingDiscount.name,
        percentage: String(editingDiscount.percentage),
        description: editingDiscount.description,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [isOpen, editingDiscount]);

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = "El nombre es obligatorio.";
    const pct = Number(form.percentage);
    if (form.percentage.trim() === "") {
      next.percentage = "El porcentaje es obligatorio.";
    } else if (isNaN(pct) || pct < 0 || pct > 100) {
      next.percentage = "El porcentaje debe ser un número entre 0 y 100.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;
    const data = {
      name: form.name.trim(),
      percentage: Number(form.percentage),
      description: form.description.trim(),
    };
    if (editingDiscount) {
      updateDiscount(editingDiscount.id, data);
    } else {
      addDiscount(data);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Percent className="size-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              {editingDiscount ? "Editar descuento" : "Nuevo descuento"}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 px-6 py-5">
            {/* Nombre */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Ej: Descuento de temporada"
                className={errors.name ? errorClasses : inputClasses}
                autoFocus
              />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
            </div>

            {/* Porcentaje */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Porcentaje <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.percentage}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, percentage: e.target.value }));
                    if (errors.percentage) setErrors((prev) => ({ ...prev, percentage: undefined }));
                  }}
                  placeholder="Ej: 15"
                  className={`pr-10 ${errors.percentage ? errorClasses : inputClasses}`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
              {errors.percentage ? (
                <p className="mt-1 text-xs text-red-400">{errors.percentage}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Valor entre 0 y 100.</p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Descripción <span className="text-slate-500 font-normal">(opcional)</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Ej: Aplica en compras de más de 3 unidades"
                rows={2}
                className={`${inputClasses} resize-none`}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-700 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800/50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              {editingDiscount ? "Guardar cambios" : "Crear descuento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
