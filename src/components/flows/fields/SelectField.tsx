"use client";

import { selectClasses } from "./styles";

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}

export default function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: SelectFieldProps) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className={selectClasses}
    >
      <option value="">{placeholder || "Seleccionar..."}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
