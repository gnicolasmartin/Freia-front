"use client";

import { useState } from "react";
import {
  X,
  Search,
  Sparkles,
  Info,
  HelpCircle,
  MessageCircle,
  TrendingUp,
  BarChart,
  BarChart3,
  PieChart,
  Table,
  ClipboardList,
  FileInput,
  MousePointerClick,
  Package,
  PackagePlus,
  Shield,
  AlertCircle,
} from "lucide-react";
import type { FrontSectionType } from "@/types/front";
import type { WidgetCategory, WidgetCatalogEntry } from "@/types/front-widgets";
import {
  WIDGET_CATEGORIES,
  WIDGET_CATEGORY_LABELS,
  WIDGET_CATALOG,
  getWidgetsByCategory,
} from "@/types/front-widgets";
import { FRONT_PERMISSION_LABELS } from "@/types/front-auth";

interface WidgetCatalogModalProps {
  onSelect: (type: FrontSectionType) => void;
  onClose: () => void;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Sparkles,
  Info,
  HelpCircle,
  MessageCircle,
  TrendingUp,
  BarChart,
  BarChart3,
  PieChart,
  Table,
  ClipboardList,
  FileInput,
  MousePointerClick,
  Package,
  PackagePlus,
};

export default function WidgetCatalogModal({ onSelect, onClose }: WidgetCatalogModalProps) {
  const [activeCategory, setActiveCategory] = useState<WidgetCategory>("general");
  const [search, setSearch] = useState("");

  const filteredWidgets = search.trim()
    ? WIDGET_CATALOG.filter(
        (w) =>
          w.label.toLowerCase().includes(search.toLowerCase()) ||
          w.description.toLowerCase().includes(search.toLowerCase())
      )
    : getWidgetsByCategory(activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl mx-4 rounded-xl border border-slate-700 bg-slate-800 shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Catálogo de widgets</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-700/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar widget..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 text-sm text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Category sidebar */}
          {!search.trim() && (
            <div className="w-44 border-r border-slate-700/50 py-2 shrink-0 overflow-y-auto">
              {WIDGET_CATEGORIES.map((cat) => {
                const catConfig = WIDGET_CATEGORY_LABELS[cat];
                const count = getWidgetsByCategory(cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full px-4 py-2.5 text-left transition-colors ${
                      activeCategory === cat
                        ? "bg-[#dd7430]/10 text-[#dd7430] border-r-2 border-[#dd7430]"
                        : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                    }`}
                  >
                    <span className="text-sm font-medium">{catConfig.label}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5">({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Widget grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            {!search.trim() && (
              <p className="text-xs text-slate-500 mb-3">
                {WIDGET_CATEGORY_LABELS[activeCategory].description}
              </p>
            )}
            {search.trim() && filteredWidgets.length === 0 && (
              <div className="text-center py-8">
                <Search className="size-6 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No se encontraron widgets.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {filteredWidgets.map((widget) => (
                <WidgetCard
                  key={widget.type}
                  widget={widget}
                  onSelect={() => {
                    onSelect(widget.type);
                    onClose();
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WidgetCard({
  widget,
  onSelect,
}: {
  widget: WidgetCatalogEntry;
  onSelect: () => void;
}) {
  const Icon = ICON_MAP[widget.icon] ?? Info;

  return (
    <button
      onClick={onSelect}
      className="flex flex-col items-start gap-2 p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:border-[#dd7430]/50 hover:bg-slate-700/30 transition-all text-left group"
    >
      <div className="flex items-center gap-2.5 w-full">
        <div className="flex size-8 items-center justify-center rounded-lg bg-slate-700/50 group-hover:bg-[#dd7430]/10 transition-colors">
          <Icon className="size-4 text-slate-400 group-hover:text-[#dd7430] transition-colors" />
        </div>
        <span className="text-sm font-medium text-white">{widget.label}</span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{widget.description}</p>

      {/* Requirements & permissions */}
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {widget.requiredPermission && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-violet-900/30 text-violet-400 border border-violet-800/30">
            <Shield className="size-2.5" />
            {FRONT_PERMISSION_LABELS[widget.requiredPermission].label}
          </span>
        )}
        {widget.requirements?.map((req) => (
          <span
            key={req}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-900/20 text-amber-400/80 border border-amber-800/20"
          >
            <AlertCircle className="size-2.5" />
            {req}
          </span>
        ))}
      </div>
    </button>
  );
}
