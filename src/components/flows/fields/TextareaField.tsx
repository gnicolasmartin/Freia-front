"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import type { FlowVariable } from "@/types/flow";
import { parseTemplate } from "@/lib/template-engine";
import {
  buildAutocompleteList,
  filterAutocomplete,
  isKnownVariable,
  getSampleValue,
  type AutocompleteVariable,
} from "@/lib/template-variables";
import { inputClasses } from "./styles";
import TemplateAutocomplete from "./TemplateAutocomplete";

interface TextareaFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  templateHighlight?: boolean;
  flowVariables?: FlowVariable[];
  useStock?: boolean;
}

export default function TextareaField({
  value,
  onChange,
  placeholder,
  rows = 3,
  templateHighlight,
  flowVariables = [],
  useStock = false,
}: TextareaFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  const allVariables = useMemo(
    () => buildAutocompleteList(flowVariables, { useStock }),
    [flowVariables, useStock]
  );

  const filteredSuggestions = useMemo(
    () => filterAutocomplete(allVariables, autocompleteQuery),
    [allVariables, autocompleteQuery]
  );

  // Detect {{ before cursor to trigger autocomplete
  const checkAutocomplete = useCallback(
    (newValue: string, pos: number) => {
      const textBeforeCursor = newValue.slice(0, pos);
      const lastOpen = textBeforeCursor.lastIndexOf("{{");
      const lastClose = textBeforeCursor.lastIndexOf("}}");

      if (lastOpen !== -1 && lastOpen > lastClose) {
        const query = textBeforeCursor.slice(lastOpen + 2);
        if (/^[\w.]*$/.test(query)) {
          setAutocompleteQuery(query);
          setShowAutocomplete(true);
          setSelectedIndex(0);
          return;
        }
      }
      setShowAutocomplete(false);
    },
    []
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const pos = e.target.selectionStart;
      onChange(newValue);
      setCursorPosition(pos);
      checkAutocomplete(newValue, pos);
    },
    [onChange, checkAutocomplete]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const pos = textarea.selectionStart;
      setCursorPosition(pos);
      checkAutocomplete(value, pos);
    },
    [value, checkAutocomplete]
  );

  const handleAutocompleteSelect = useCallback(
    (variable: AutocompleteVariable) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const textBeforeCursor = value.slice(0, cursorPosition);
      const lastOpen = textBeforeCursor.lastIndexOf("{{");
      const textAfterCursor = value.slice(cursorPosition);

      const newValue =
        value.slice(0, lastOpen) +
        `{{${variable.name}}}` +
        textAfterCursor;

      onChange(newValue);
      setShowAutocomplete(false);

      const newCursorPos = lastOpen + variable.name.length + 4;
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [value, cursorPosition, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showAutocomplete || filteredSuggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) =>
          Math.min(i + 1, filteredSuggestions.length - 1)
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleAutocompleteSelect(filteredSuggestions[selectedIndex]);
      } else if (e.key === "Escape") {
        setShowAutocomplete(false);
      }
    },
    [showAutocomplete, filteredSuggestions, selectedIndex, handleAutocompleteSelect]
  );

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value || ""}
        onChange={handleChange}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onBlur={() => setShowAutocomplete(false)}
        rows={rows}
        placeholder={placeholder}
        className={`${inputClasses} resize-none`}
      />

      {templateHighlight && (
        <TemplateAutocomplete
          suggestions={filteredSuggestions}
          selectedIndex={selectedIndex}
          onSelect={handleAutocompleteSelect}
          visible={showAutocomplete}
        />
      )}

      {templateHighlight && value && (
        <div className="mt-2 p-2 rounded-lg bg-slate-800/80 border border-slate-700/50 text-sm text-slate-300 whitespace-pre-wrap">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-slate-500">Vista previa:</p>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500/40" />
                conocida
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500/40" />
                desconocida
              </span>
            </div>
          </div>
          <TemplatePreview text={value} flowVariables={flowVariables} useStock={useStock} />
        </div>
      )}
    </div>
  );
}

// --- Preview renderer ---

function TemplatePreview({
  text,
  flowVariables,
  useStock = false,
}: {
  text: string;
  flowVariables: FlowVariable[];
  useStock?: boolean;
}) {
  const allVars = useMemo(
    () => buildAutocompleteList(flowVariables, { useStock }),
    [flowVariables, useStock]
  );
  const tokens = parseTemplate(text);

  return (
    <>
      {tokens.map((token, i) => {
        if (token.type === "text") {
          return <span key={i}>{token.raw}</span>;
        }

        const known = isKnownVariable(token.path!, flowVariables, { useStock });
        const varDef = allVars.find((v) => v.name === token.path);

        if (known && varDef) {
          const sample = getSampleValue(varDef);
          return (
            <span
              key={i}
              className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-mono mx-0.5"
              title={`${token.path} (${varDef.type})`}
            >
              {sample}
            </span>
          );
        }

        // Unknown variable — show fallback or raw
        const display = token.fallback ?? token.raw;
        return (
          <span
            key={i}
            className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs font-mono mx-0.5"
            title={`Variable desconocida: ${token.path}`}
          >
            {display}
          </span>
        );
      })}
    </>
  );
}
