"use client";

import { inputClasses } from "./styles";

interface TextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  monospace?: boolean;
}

export default function TextField({
  value,
  onChange,
  placeholder,
  monospace,
}: TextFieldProps) {
  return (
    <input
      type="text"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${inputClasses} ${monospace ? "font-mono" : ""}`}
    />
  );
}
