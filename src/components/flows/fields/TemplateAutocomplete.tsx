"use client";

import { useEffect, useRef } from "react";
import { Variable, Hash, Calendar, ToggleLeft, List, Type, Lock } from "lucide-react";
import { CATEGORY_LABELS, type AutocompleteVariable } from "@/lib/template-variables";

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  user: { bg: "bg-[#dd7430]/20", text: "text-[#dd7430]" },
  system: { bg: "bg-purple-500/20", text: "text-purple-400" },
  contact: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  channel: { bg: "bg-sky-500/20", text: "text-sky-400" },
  conversation: { bg: "bg-teal-500/20", text: "text-teal-400" },
  lead: { bg: "bg-blue-500/20", text: "text-blue-400" },
};

const TYPE_ICONS: Record<string, typeof Variable> = {
  string: Type,
  number: Hash,
  date: Calendar,
  boolean: ToggleLeft,
  enum: List,
};

interface TemplateAutocompleteProps {
  suggestions: AutocompleteVariable[];
  selectedIndex: number;
  onSelect: (variable: AutocompleteVariable) => void;
  visible: boolean;
}

export default function TemplateAutocomplete({
  suggestions,
  selectedIndex,
  onSelect,
  visible,
}: TemplateAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex] as
      | HTMLElement
      | undefined;
    selectedEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-lg border border-slate-600 bg-slate-800 shadow-xl"
    >
      {suggestions.map((variable, i) => {
        const colors =
          CATEGORY_COLORS[variable.category] ?? CATEGORY_COLORS.user;
        const Icon = TYPE_ICONS[variable.type] ?? Variable;
        const isSelected = i === selectedIndex;

        return (
          <button
            key={variable.name}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(variable);
            }}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm transition-colors ${
              isSelected ? "bg-slate-700" : "hover:bg-slate-700/50"
            }`}
          >
            <Icon className={`size-3.5 shrink-0 ${colors.text}`} />
            <div className="flex-1 min-w-0">
              <span className="font-mono text-xs text-white truncate block">
                {variable.name}
              </span>
              {variable.description && (
                <span className="text-xs text-slate-500 truncate block">
                  {variable.description}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {variable.builtin && (
                <Lock className="size-2.5 text-slate-500" />
              )}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
              >
                {CATEGORY_LABELS[variable.category as keyof typeof CATEGORY_LABELS] ?? variable.category}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
