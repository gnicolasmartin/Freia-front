"use client";

import { inputClasses } from "./styles";

interface NumberFieldProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}

export default function NumberField({
  value,
  onChange,
  placeholder,
  min,
  max,
}: NumberFieldProps) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          onChange(undefined);
        } else {
          onChange(Number(raw));
        }
      }}
      placeholder={placeholder}
      min={min}
      max={max}
      className={inputClasses}
    />
  );
}
