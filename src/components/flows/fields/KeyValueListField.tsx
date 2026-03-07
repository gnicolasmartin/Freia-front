"use client";

import { Plus, Trash2 } from "lucide-react";
import { inputClasses } from "./styles";

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
}

interface KeyValueListFieldProps {
  value: KeyValuePair[];
  onChange: (value: KeyValuePair[]) => void;
  keyLabel: string;
  valueLabel: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export default function KeyValueListField({
  value,
  onChange,
  keyLabel,
  valueLabel,
  keyPlaceholder,
  valuePlaceholder,
}: KeyValueListFieldProps) {
  const pairs = value || [];

  const addPair = () => {
    onChange([...pairs, { id: crypto.randomUUID(), key: "", value: "" }]);
  };

  const removePair = (id: string) => {
    onChange(pairs.filter((p) => p.id !== id));
  };

  const updatePair = (id: string, field: "key" | "value", val: string) => {
    onChange(pairs.map((p) => (p.id === id ? { ...p, [field]: val } : p)));
  };

  return (
    <div className="space-y-2">
      {pairs.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_28px] gap-1.5 text-xs text-slate-500 px-0.5">
          <span>{keyLabel}</span>
          <span>{valueLabel}</span>
          <span />
        </div>
      )}

      {pairs.map((pair) => (
        <div key={pair.id} className="grid grid-cols-[1fr_1fr_28px] gap-1.5">
          <input
            type="text"
            value={pair.key}
            onChange={(e) => updatePair(pair.id, "key", e.target.value)}
            placeholder={keyPlaceholder}
            className={`${inputClasses} font-mono text-xs`}
          />
          <input
            type="text"
            value={pair.value}
            onChange={(e) => updatePair(pair.id, "value", e.target.value)}
            placeholder={valuePlaceholder}
            className={`${inputClasses} text-xs`}
          />
          <button
            type="button"
            onClick={() => removePair(pair.id)}
            className="flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addPair}
        className="flex items-center gap-1.5 text-xs text-[#dd7430] hover:text-orange-300 transition-colors mt-1"
      >
        <Plus className="size-3.5" />
        Agregar par
      </button>
    </div>
  );
}
