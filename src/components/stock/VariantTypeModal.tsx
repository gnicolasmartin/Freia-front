"use client";

import { useState, useEffect } from "react";
import { X, Tag } from "lucide-react";
import { useProducts } from "@/providers/ProductsProvider";
import { nameToKey } from "@/lib/stock-utils";
import type { VariantType } from "@/types/product";

interface VariantTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingVariantType?: VariantType | null;
}

const inputClasses =
  "w-full rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 focus:outline-none";

const errorClasses =
  "w-full rounded-lg border border-red-500 bg-slate-800/50 px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/20 focus:outline-none";

interface FormState {
  name: string;
  key: string;
}

interface FormErrors {
  name?: string;
  key?: string;
}

export function VariantTypeModal({ isOpen, onClose, editingVariantType }: VariantTypeModalProps) {
  const { variantTypes, addVariantType, updateVariantType } = useProducts();
  const [form, setForm] = useState<FormState>({ name: "", key: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [keyTouched, setKeyTouched] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingVariantType) {
      setForm({ name: editingVariantType.name, key: editingVariantType.key });
      setKeyTouched(true);
    } else {
      setForm({ name: "", key: "" });
      setKeyTouched(false);
    }
    setErrors({});
  }, [isOpen, editingVariantType]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setForm((prev) => ({
      name,
      key: keyTouched ? prev.key : nameToKey(name),
    }));
    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyTouched(true);
    setForm((prev) => ({ ...prev, key: e.target.value }));
    if (errors.key) setErrors((prev) => ({ ...prev, key: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = "El nombre es obligatorio.";

    const trimmedKey = form.key.trim();
    if (!trimmedKey) {
      next.key = "La clave interna es obligatoria.";
    } else if (!/^[a-z0-9_]+$/.test(trimmedKey)) {
      next.key = "Solo letras minúsculas, números y guiones bajos (_).";
    } else {
      const duplicate = variantTypes.find(
        (vt) => vt.key === trimmedKey && vt.id !== editingVariantType?.id
      );
      if (duplicate) next.key = `La clave "${trimmedKey}" ya está en uso.`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;
    const data = { name: form.name.trim(), key: form.key.trim() };
    if (editingVariantType) {
      updateVariantType(editingVariantType.id, data);
    } else {
      addVariantType(data);
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
            <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Tag className="size-5 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              {editingVariantType ? "Editar tipo de variante" : "Nuevo tipo de variante"}
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
                onChange={handleNameChange}
                placeholder="Ej: Color, Talle, Marca"
                className={errors.name ? errorClasses : inputClasses}
                autoFocus
              />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
            </div>

            {/* Clave interna */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Clave interna <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.key}
                onChange={handleKeyChange}
                placeholder="Ej: color, talle, marca"
                className={`font-mono ${errors.key ? errorClasses : inputClasses}`}
              />
              {errors.key ? (
                <p className="mt-1 text-xs text-red-400">{errors.key}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Se genera automáticamente desde el nombre. Solo minúsculas, números y _.
                </p>
              )}
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
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              {editingVariantType ? "Guardar cambios" : "Crear tipo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
