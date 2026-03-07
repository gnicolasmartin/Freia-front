"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileText,
  MessageCircle,
  Info,
  HelpCircle,
  Sparkles,
  Eye,
  EyeOff,
  Save,
  Undo2,
  Check,
  TrendingUp,
  BarChart3,
  Table,
  ClipboardList,
  FileInput,
  MousePointerClick,
  Package,
  PackagePlus,
  LayoutGrid,
  Settings2,
  Braces,
  BarChart,
  PieChart,
} from "lucide-react";
import { useFronts } from "@/providers/FrontsProvider";
import { useAgents } from "@/providers/AgentsProvider";
import { useFlows } from "@/providers/FlowsProvider";
import type { Front, FrontPage, FrontSection, FrontSectionType } from "@/types/front";
import { SECTION_TYPE_CONFIG } from "@/types/front";
import type { FrontRole, FrontPermission } from "@/types/front-auth";
import type { ChartConfig, ChartTimeRange, TableConfig, TableColumnDef, TableColumnType, TableColumnFormat, TableRowAction, FormConfig, FormFieldDef, FormFieldType, ButtonActionConfig, ButtonActionMode, StockFormConfig } from "@/types/front-widgets";
import { CHART_TIME_RANGE_LABELS, TABLE_COLUMN_TYPE_LABELS, TABLE_COLUMN_FORMAT_LABELS, TABLE_ROW_ACTION_LABELS, DEFAULT_TABLE_CONFIG, FORM_FIELD_TYPE_LABELS, DEFAULT_FORM_CONFIG, BUTTON_ACTION_MODE_LABELS, DEFAULT_STOCK_FORM_CONFIG } from "@/types/front-widgets";
import { FRONT_ROLES, FRONT_ROLE_CONFIGS, FRONT_PERMISSION_LABELS } from "@/types/front-auth";
import { SectionRenderer } from "./FrontSectionRenderers";
import WidgetCatalogModal from "./WidgetCatalogModal";
import WidgetConfigPanel from "./WidgetConfigPanel";
import FrontVariablesPanel from "./FrontVariablesPanel";

interface FrontPagesPanelProps {
  front: Front;
}

const SECTION_ICONS: Record<FrontSectionType, React.FC<{ className?: string }>> = {
  hero: Sparkles,
  chat: MessageCircle,
  info: Info,
  faq: HelpCircle,
  chart_line: TrendingUp,
  chart_bar: BarChart,
  chart_pie: PieChart,
  chart_kpi: BarChart3,
  table_data: Table,
  table_stock: ClipboardList,
  form_contact: FileInput,
  button_cta: MousePointerClick,
  stock_list: Package,
  stock_form: PackagePlus,
};

export default function FrontPagesPanel({ front }: FrontPagesPanelProps) {
  const { updateFrontPages } = useFronts();
  const { agents } = useAgents();
  const [pages, setPages] = useState<FrontPage[]>(front.pages ?? []);
  const [expandedPageId, setExpandedPageId] = useState<string | null>(
    pages.length > 0 ? pages[0].id : null
  );
  const [previewMode, setPreviewMode] = useState(false);
  const [saved, setSaved] = useState(false);
  const [catalogPageId, setCatalogPageId] = useState<string | null>(null);
  const [configSectionId, setConfigSectionId] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(false);

  // Change detection
  const hasChanges = JSON.stringify(pages) !== JSON.stringify(front.pages ?? []);

  const update = (updated: FrontPage[]) => {
    setPages(updated);
  };

  const saveChanges = () => {
    updateFrontPages(front.id, pages);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const discardChanges = () => {
    const original = front.pages ?? [];
    setPages(original);
    setExpandedPageId(original[0]?.id ?? null);
  };

  const addPage = () => {
    const newPage: FrontPage = {
      id: crypto.randomUUID(),
      slug: `pagina-${pages.length + 1}`,
      title: `Página ${pages.length + 1}`,
      sections: [
        { id: crypto.randomUUID(), type: "hero", title: front.name, content: front.description },
      ],
      order: pages.length,
    };
    const updated = [...pages, newPage];
    update(updated);
    setExpandedPageId(newPage.id);
  };

  const removePage = (pageId: string) => {
    if (!confirm("¿Eliminar esta página?")) return;
    const updated = pages.filter((p) => p.id !== pageId).map((p, i) => ({ ...p, order: i }));
    update(updated);
    if (expandedPageId === pageId) setExpandedPageId(updated[0]?.id ?? null);
  };

  const updatePage = (pageId: string, data: Partial<FrontPage>) => {
    const updated = pages.map((p) => (p.id === pageId ? { ...p, ...data } : p));
    update(updated);
  };

  const movePage = (pageId: string, direction: -1 | 1) => {
    const idx = pages.findIndex((p) => p.id === pageId);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= pages.length) return;
    const reordered = [...pages];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    update(reordered.map((p, i) => ({ ...p, order: i })));
  };

  const addSection = (pageId: string, type: FrontSectionType) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const section: FrontSection = {
      id: crypto.randomUUID(),
      type,
      title: SECTION_TYPE_CONFIG[type].label,
    };
    updatePage(pageId, { sections: [...page.sections, section] });
  };

  const updateSection = (pageId: string, sectionId: string, data: Partial<FrontSection>) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const sections = page.sections.map((s) =>
      s.id === sectionId ? { ...s, ...data } : s
    );
    updatePage(pageId, { sections });
  };

  const updateSectionConfig = (pageId: string, sectionId: string, configPatch: Record<string, unknown>) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const section = page.sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(pageId, sectionId, { config: { ...section.config, ...configPatch } });
  };

  const removeSection = (pageId: string, sectionId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    updatePage(pageId, { sections: page.sections.filter((s) => s.id !== sectionId) });
  };

  const moveSection = (pageId: string, sectionId: string, direction: -1 | 1) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const idx = page.sections.findIndex((s) => s.id === sectionId);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= page.sections.length) return;
    const reordered = [...page.sections];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    updatePage(pageId, { sections: reordered });
  };

  // --- Preview mode ---
  if (previewMode) {
    const primaryColor = front.branding.primaryColor ?? "#dd7430";
    const secondaryColor = front.branding.secondaryColor ?? "#1e293b";
    const previewPages = pages.filter((p) => p.sections.length > 0);

    return (
      <div className="space-y-0">
        {/* Preview banner */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-t-lg bg-violet-900/30 border border-violet-700/50">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-violet-400" />
            <span className="text-xs font-medium text-violet-300">Modo vista previa</span>
          </div>
          <button
            onClick={() => setPreviewMode(false)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-violet-300 border border-violet-700/50 hover:bg-violet-800/30 transition-colors"
          >
            <EyeOff className="size-3" />
            Volver al editor
          </button>
        </div>

        {/* Preview content */}
        <div
          className="rounded-b-lg overflow-hidden border border-t-0 border-slate-700"
          style={{ backgroundColor: secondaryColor }}
        >
          {previewPages.length > 1 && (
            <PreviewNav
              pages={previewPages}
              primaryColor={primaryColor}
              frontName={front.name}
              logoUrl={front.branding.logoUrl}
            />
          )}

          {previewPages.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-white/40 text-sm">No hay páginas con secciones para previsualizar.</p>
            </div>
          ) : (
            <PreviewPages
              pages={previewPages}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              frontName={front.name}
            />
          )}

          <div className="border-t border-white/10 py-4 text-center">
            <p className="text-[10px] text-white/20">Powered by Freia</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Editor mode ---
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Define las páginas y secciones de tu front.
        </p>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              <button
                onClick={discardChanges}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-600 text-slate-400 text-xs hover:text-white hover:border-slate-500 transition-colors"
              >
                <Undo2 className="size-3" />
                Descartar
              </button>
              <button
                onClick={saveChanges}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 transition-colors"
              >
                <Save className="size-3.5" />
                Guardar cambios
              </button>
            </>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="size-3" />
              Guardado
            </span>
          )}

          <button
            onClick={() => setShowVariables(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-600 text-slate-400 text-xs hover:text-[#dd7430] hover:border-[#dd7430]/40 transition-colors"
          >
            <Braces className="size-3.5" />
            Variables
          </button>

          <button
            onClick={() => setPreviewMode(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-600 text-slate-400 text-xs hover:text-violet-300 hover:border-violet-600 transition-colors"
          >
            <Eye className="size-3.5" />
            Vista previa
          </button>

          <button
            onClick={addPage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#dd7430] text-white text-xs font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="size-3.5" />
            Agregar página
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-900/20 border border-amber-700/30">
          <div className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] text-amber-400/80">Hay cambios sin guardar</span>
        </div>
      )}

      {pages.length === 0 && (
        <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg">
          <FileText className="size-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No hay páginas configuradas.</p>
          <p className="text-xs text-slate-600 mt-1">
            Agrega al menos una página para que tu front tenga contenido.
          </p>
        </div>
      )}

      {pages.map((page) => {
        const isExpanded = expandedPageId === page.id;
        return (
          <div
            key={page.id}
            className="border border-slate-700 rounded-lg overflow-hidden"
          >
            {/* Page header */}
            <div
              className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 cursor-pointer"
              onClick={() => setExpandedPageId(isExpanded ? null : page.id)}
            >
              <FileText className="size-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white">{page.title}</span>
                <span className="text-xs text-slate-500 ml-2 font-mono">/{page.slug}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-slate-500">
                  {page.sections.length} {page.sections.length === 1 ? "sección" : "secciones"}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); movePage(page.id, -1); }}
                  disabled={page.order === 0}
                  className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                  aria-label="Mover arriba"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); movePage(page.id, 1); }}
                  disabled={page.order === pages.length - 1}
                  className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                  aria-label="Mover abajo"
                >
                  <ChevronDown className="size-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removePage(page.id); }}
                  className="p-1 text-slate-500 hover:text-red-400"
                  aria-label="Eliminar página"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded page editor */}
            {isExpanded && (
              <div className="px-4 py-3 space-y-3 border-t border-slate-700">
                {/* Page fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Título</label>
                    <input
                      type="text"
                      value={page.title}
                      onChange={(e) => updatePage(page.id, { title: e.target.value })}
                      className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-2.5 py-1.5 text-sm text-white focus:border-[#dd7430] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Slug</label>
                    <input
                      type="text"
                      value={page.slug}
                      onChange={(e) =>
                        updatePage(page.id, {
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                        })
                      }
                      className="w-full rounded-md border border-slate-600 bg-slate-700/50 px-2.5 py-1.5 text-sm text-white font-mono focus:border-[#dd7430] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Page access control */}
                <RolesMultiSelect
                  label="Roles con acceso a esta página"
                  value={page.allowedRoles ?? []}
                  onChange={(roles) => updatePage(page.id, { allowedRoles: roles.length > 0 ? roles : undefined })}
                />

                {/* Sections */}
                <div className="space-y-2">
                  {page.sections.map((section, sIdx) => {
                    const SIcon = SECTION_ICONS[section.type];
                    return (
                      <div
                        key={section.id}
                        className="border border-slate-700/50 rounded-lg p-3 bg-slate-900/30"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <SIcon className="size-4 text-slate-400" />
                          <span className="text-xs font-medium text-slate-300">
                            {SECTION_TYPE_CONFIG[section.type].label}
                          </span>
                          <div className="ml-auto flex items-center gap-0.5">
                            <button
                              onClick={() => moveSection(page.id, section.id, -1)}
                              disabled={sIdx === 0}
                              className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-30"
                              aria-label="Mover sección arriba"
                            >
                              <ChevronUp className="size-3" />
                            </button>
                            <button
                              onClick={() => moveSection(page.id, section.id, 1)}
                              disabled={sIdx === page.sections.length - 1}
                              className="p-0.5 text-slate-600 hover:text-slate-300 disabled:opacity-30"
                              aria-label="Mover sección abajo"
                            >
                              <ChevronDown className="size-3" />
                            </button>
                            <button
                              onClick={() =>
                                setConfigSectionId(configSectionId === section.id ? null : section.id)
                              }
                              className={`p-0.5 transition-colors ${
                                configSectionId === section.id
                                  ? "text-[#dd7430]"
                                  : "text-slate-600 hover:text-slate-300"
                              }`}
                              aria-label="Configurar widget"
                            >
                              <Settings2 className="size-3" />
                            </button>
                            <button
                              onClick={() => removeSection(page.id, section.id)}
                              className="p-0.5 text-slate-600 hover:text-red-400"
                              aria-label="Eliminar sección"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </div>

                        {/* Section editor by type */}
                        <SectionEditor
                          section={section}
                          pageId={page.id}
                          front={front}
                          agents={agents}
                          updateSection={updateSection}
                          updateSectionConfig={updateSectionConfig}
                        />

                        {/* Section access controls */}
                        <div className="mt-2 pt-2 border-t border-slate-700/30 grid grid-cols-2 gap-2">
                          <RolesMultiSelect
                            label="Roles"
                            value={section.allowedRoles ?? []}
                            onChange={(roles) =>
                              updateSection(page.id, section.id, { allowedRoles: roles.length > 0 ? roles : undefined })
                            }
                          />
                          <PermissionSelect
                            value={section.requiredPermission}
                            onChange={(perm) =>
                              updateSection(page.id, section.id, { requiredPermission: perm })
                            }
                          />
                        </div>

                        {/* Widget config panel */}
                        {configSectionId === section.id && (
                          <WidgetConfigPanel
                            section={section}
                            frontFlowIds={front.flowIds}
                            onUpdateConfig={(patch) =>
                              updateSectionConfig(page.id, section.id, patch)
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add widget button — opens catalog */}
                <button
                  onClick={() => setCatalogPageId(page.id)}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-dashed border-slate-600 text-xs text-slate-400 hover:text-[#dd7430] hover:border-[#dd7430]/50 transition-colors"
                >
                  <LayoutGrid className="size-4" />
                  Agregar widget desde catálogo
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Widget catalog modal */}
      {catalogPageId && (
        <WidgetCatalogModal
          onSelect={(type) => addSection(catalogPageId, type)}
          onClose={() => setCatalogPageId(null)}
        />
      )}

      {showVariables && (
        <FrontVariablesPanel
          flowIds={front.flowIds}
          onClose={() => setShowVariables(false)}
        />
      )}
    </div>
  );
}

// --- Section editor by type ---

function SectionEditor({
  section,
  pageId,
  front,
  agents,
  updateSection,
  updateSectionConfig,
}: {
  section: FrontSection;
  pageId: string;
  front: Front;
  agents: { id: string; name: string }[];
  updateSection: (pageId: string, sectionId: string, data: Partial<FrontSection>) => void;
  updateSectionConfig: (pageId: string, sectionId: string, config: Record<string, unknown>) => void;
}) {
  const inputCls = "w-full rounded-md border border-slate-600 bg-slate-700/50 px-2.5 py-1.5 text-xs text-white focus:border-[#dd7430] focus:outline-none";
  const labelCls = "block text-xs text-slate-500 mb-1";

  switch (section.type) {
    case "hero":
    case "info":
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={section.title ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { title: e.target.value })}
            placeholder="Título"
            className={inputCls}
          />
          <textarea
            value={section.content ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { content: e.target.value })}
            rows={2}
            placeholder="Contenido..."
            className={`${inputCls} resize-none`}
          />
        </div>
      );

    case "chat":
      return (
        <div>
          <label className={labelCls}>Agente</label>
          <select
            value={section.agentId ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { agentId: e.target.value || undefined })}
            className={inputCls}
          >
            <option value="">Seleccionar agente...</option>
            {agents
              .filter((a) => front.agentIds.includes(a.id))
              .map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
          </select>
        </div>
      );

    case "faq":
      return (
        <textarea
          value={section.content ?? ""}
          onChange={(e) => updateSection(pageId, section.id, { content: e.target.value })}
          rows={3}
          placeholder="Pregunta 1?\nRespuesta 1\n\nPregunta 2?\nRespuesta 2"
          className={`${inputCls} font-mono resize-none`}
        />
      );

    case "chart_line":
    case "chart_bar":
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={section.title ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { title: e.target.value })}
            placeholder={section.type === "chart_bar" ? "Título del gráfico de barras" : "Título del gráfico de línea"}
            className={inputCls}
          />
          <div>
            <label className={labelCls}>Datos (JSON: {`[{"label":"Ene","value":100},...]`})</label>
            <textarea
              value={
                section.config?.data
                  ? JSON.stringify(section.config.data)
                  : ""
              }
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  if (Array.isArray(parsed)) updateSectionConfig(pageId, section.id, { data: parsed });
                } catch {
                  // Allow editing invalid JSON temporarily
                }
              }}
              rows={2}
              placeholder='[{"label":"Ene","value":120},{"label":"Feb","value":180}]'
              className={`${inputCls} font-mono resize-none`}
            />
            <p className="text-[9px] text-slate-600 mt-0.5">Dejar vacío para datos de ejemplo</p>
          </div>
          <ChartConfigEditor
            section={section}
            pageId={pageId}
            updateSectionConfig={updateSectionConfig}
            inputCls={inputCls}
            labelCls={labelCls}
            showAxes
          />
        </div>
      );

    case "chart_pie":
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={section.title ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { title: e.target.value })}
            placeholder="Título del gráfico circular"
            className={inputCls}
          />
          <div>
            <label className={labelCls}>Datos (JSON: {`[{"label":"Seg A","value":35},...]`})</label>
            <textarea
              value={
                section.config?.data
                  ? JSON.stringify(section.config.data)
                  : ""
              }
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  if (Array.isArray(parsed)) updateSectionConfig(pageId, section.id, { data: parsed });
                } catch { /* allow temp invalid */ }
              }}
              rows={2}
              placeholder='[{"label":"Segmento A","value":35},{"label":"Segmento B","value":25}]'
              className={`${inputCls} font-mono resize-none`}
            />
            <p className="text-[9px] text-slate-600 mt-0.5">Dejar vacío para datos de ejemplo</p>
          </div>
          <ChartConfigEditor
            section={section}
            pageId={pageId}
            updateSectionConfig={updateSectionConfig}
            inputCls={inputCls}
            labelCls={labelCls}
            showDonut
          />
        </div>
      );

    case "chart_kpi":
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={section.title ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { title: e.target.value })}
            placeholder="Título del indicador"
            className={inputCls}
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Valor</label>
              <input
                type="text"
                value={(section.config?.value as string) ?? ""}
                onChange={(e) => updateSectionConfig(pageId, section.id, { value: e.target.value })}
                placeholder="1,234"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Unidad</label>
              <input
                type="text"
                value={(section.config?.unit as string) ?? ""}
                onChange={(e) => updateSectionConfig(pageId, section.id, { unit: e.target.value })}
                placeholder="USD"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Variación %</label>
              <input
                type="number"
                value={(section.config?.change as number) ?? ""}
                onChange={(e) => updateSectionConfig(pageId, section.id, { change: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="12.5"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      );

    case "table_data":
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={section.title ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { title: e.target.value })}
            placeholder="Título de la tabla"
            className={inputCls}
          />
          <div>
            <label className={labelCls}>Columnas (separadas por coma, fallback)</label>
            <input
              type="text"
              value={((section.config?.columns as string[]) ?? []).join(", ")}
              onChange={(e) =>
                updateSectionConfig(pageId, section.id, {
                  columns: e.target.value.split(",").map((c) => c.trim()).filter(Boolean),
                })
              }
              placeholder="Nombre, Categoría, Valor"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Filas (JSON: {`[["A","B","C"],...]`})</label>
            <textarea
              value={section.config?.rows ? JSON.stringify(section.config.rows) : ""}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  if (Array.isArray(parsed)) updateSectionConfig(pageId, section.id, { rows: parsed });
                } catch { /* allow editing */ }
              }}
              rows={2}
              placeholder='[["Ejemplo A","Cat 1","100"]]'
              className={`${inputCls} font-mono resize-none`}
            />
            <p className="text-[9px] text-slate-600 mt-0.5">Dejar vacío para datos de ejemplo</p>
          </div>
          <TableConfigEditor
            section={section}
            pageId={pageId}
            updateSectionConfig={updateSectionConfig}
            inputCls={inputCls}
            labelCls={labelCls}
          />
        </div>
      );

    case "table_stock":
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={section.title ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { title: e.target.value })}
            placeholder="Título"
            className={inputCls}
          />
          <p className="text-[10px] text-slate-500">Muestra productos del catálogo de stock. Los datos se cargan automáticamente.</p>
        </div>
      );

    case "form_contact":
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={section.title ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { title: e.target.value })}
            placeholder="Título del formulario"
            className={inputCls}
          />
          <div>
            <label className={labelCls}>Campos (separados por coma, fallback)</label>
            <input
              type="text"
              value={((section.config?.fields as string[]) ?? []).join(", ")}
              onChange={(e) =>
                updateSectionConfig(pageId, section.id, {
                  fields: e.target.value.split(",").map((c) => c.trim()).filter(Boolean),
                })
              }
              placeholder="Nombre, Email, Mensaje"
              className={inputCls}
            />
            <p className="text-[9px] text-slate-600 mt-0.5">Se usa si no hay campos definidos abajo</p>
          </div>
          <FormConfigEditor
            section={section}
            pageId={pageId}
            front={front}
            updateSectionConfig={updateSectionConfig}
            inputCls={inputCls}
            labelCls={labelCls}
          />
        </div>
      );

    case "button_cta":
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={section.content ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { content: e.target.value })}
            placeholder="Texto descriptivo (opcional)"
            className={inputCls}
          />
          <div>
            <label className={labelCls}>Texto del botón</label>
            <input
              type="text"
              value={(section.config?.buttonText as string) ?? ""}
              onChange={(e) => updateSectionConfig(pageId, section.id, { buttonText: e.target.value })}
              placeholder="Más información"
              className={inputCls}
            />
          </div>
          <ButtonActionEditor
            section={section}
            pageId={pageId}
            front={front}
            updateSectionConfig={updateSectionConfig}
            inputCls={inputCls}
            labelCls={labelCls}
          />
        </div>
      );

    case "stock_list":
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={section.title ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { title: e.target.value })}
            placeholder="Título"
            className={inputCls}
          />
          <p className="text-[10px] text-slate-500">
            Muestra un listado de productos del catálogo con búsqueda, filtros por categoría/marca, ordenamiento y resumen de variantes.
            Requiere permiso &quot;operate_stock&quot; para acciones de operador.
          </p>
        </div>
      );

    case "stock_form": {
      const sfCfg: StockFormConfig = (section.config?._stockForm as StockFormConfig) ?? DEFAULT_STOCK_FORM_CONFIG;
      const updateSfCfg = (patch: Partial<StockFormConfig>) =>
        updateSection(pageId, section.id, { config: { ...section.config, _stockForm: { ...sfCfg, ...patch } } });
      return (
        <div className="space-y-2">
          <input
            type="text"
            value={section.title ?? ""}
            onChange={(e) => updateSection(pageId, section.id, { title: e.target.value })}
            placeholder="Título"
            className={inputCls}
          />
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={sfCfg.autoGenerateSku}
              onChange={(e) => updateSfCfg({ autoGenerateSku: e.target.checked })}
              className="rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430]/30"
            />
            Autogenerar código SKU
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={sfCfg.showOptionalFields}
              onChange={(e) => updateSfCfg({ showOptionalFields: e.target.checked })}
              className="rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430]/30"
            />
            Mostrar campos opcionales (descripción, marca, modelo, unidad)
          </label>
          <input
            type="text"
            value={sfCfg.successMessage ?? ""}
            onChange={(e) => updateSfCfg({ successMessage: e.target.value })}
            placeholder="Mensaje de éxito"
            className={inputCls}
          />
          <p className="text-[10px] text-slate-500">Formulario de alta de producto. Requiere permiso &quot;operate_stock&quot;.</p>
        </div>
      );
    }

    default:
      return null;
  }
}

// --- Preview components ---

function PreviewNav({
  pages,
  primaryColor,
  frontName,
  logoUrl,
}: {
  pages: FrontPage[];
  primaryColor: string;
  frontName: string;
  logoUrl?: string;
}) {
  return (
    <header
      className="border-b border-white/10"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={frontName} className="h-6 object-contain" />
          ) : (
            <span className="text-sm font-bold text-white">{frontName}</span>
          )}
        </div>
        <nav className="flex items-center gap-1">
          {pages.map((page, i) => (
            <span
              key={page.id}
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                i === 0 ? "bg-white/20 text-white" : "text-white/70"
              }`}
            >
              {page.title}
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}

function PreviewPages({
  pages,
  primaryColor,
  secondaryColor,
  frontName,
}: {
  pages: FrontPage[];
  primaryColor: string;
  secondaryColor: string;
  frontName: string;
}) {
  const firstPage = pages[0];
  if (!firstPage) return null;

  return (
    <div>
      {firstPage.sections.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          frontName={frontName}
          canInteract={true}
        />
      ))}
    </div>
  );
}

// --- Access control helpers ---

function RolesMultiSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FrontRole[];
  onChange: (roles: FrontRole[]) => void;
}) {
  const toggle = (role: FrontRole) => {
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role]);
  };

  return (
    <div>
      <label className="block text-[10px] text-slate-500 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1">
        {FRONT_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => toggle(role)}
            className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
              value.includes(role)
                ? "border-[#dd7430]/50 bg-[#dd7430]/10 text-[#dd7430]"
                : "border-slate-700 text-slate-500 hover:text-slate-300"
            }`}
          >
            {FRONT_ROLE_CONFIGS[role].label}
          </button>
        ))}
      </div>
      {value.length === 0 && (
        <p className="text-[9px] text-slate-600 mt-0.5">Todos los roles</p>
      )}
    </div>
  );
}

function PermissionSelect({
  value,
  onChange,
}: {
  value: FrontPermission | undefined;
  onChange: (perm: FrontPermission | undefined) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] text-slate-500 mb-1">Permiso requerido</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || undefined) as FrontPermission | undefined)}
        className="w-full rounded border border-slate-700 bg-slate-800/50 px-1.5 py-0.5 text-[10px] text-white focus:border-[#dd7430] focus:outline-none"
      >
        <option value="">Ninguno</option>
        {(Object.keys(FRONT_PERMISSION_LABELS) as FrontPermission[]).map((perm) => (
          <option key={perm} value={perm}>
            {FRONT_PERMISSION_LABELS[perm].label}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- Chart config sub-editor ---

function ChartConfigEditor({
  section,
  pageId,
  updateSectionConfig,
  inputCls,
  labelCls,
  showAxes,
  showDonut,
}: {
  section: FrontSection;
  pageId: string;
  updateSectionConfig: (pageId: string, sectionId: string, patch: Record<string, unknown>) => void;
  inputCls: string;
  labelCls: string;
  showAxes?: boolean;
  showDonut?: boolean;
}) {
  const chartConfig = (section.config?._chart as ChartConfig) ?? {};

  const updateChart = (patch: Partial<ChartConfig>) => {
    updateSectionConfig(pageId, section.id, { _chart: { ...chartConfig, ...patch } });
  };

  return (
    <div className="mt-1 pt-2 border-t border-slate-700/30 space-y-2">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider font-medium">Configuración del gráfico</p>

      {showAxes && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Eje X (label)</label>
            <input
              type="text"
              value={chartConfig.xAxisLabel ?? ""}
              onChange={(e) => updateChart({ xAxisLabel: e.target.value || undefined })}
              placeholder="Ej: Meses"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Eje Y (label)</label>
            <input
              type="text"
              value={chartConfig.yAxisLabel ?? ""}
              onChange={(e) => updateChart({ yAxisLabel: e.target.value || undefined })}
              placeholder="Ej: Ventas"
              className={inputCls}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Rango temporal</label>
          <select
            value={chartConfig.timeRange ?? "all"}
            onChange={(e) => updateChart({ timeRange: e.target.value as ChartTimeRange })}
            className={inputCls}
          >
            {(Object.keys(CHART_TIME_RANGE_LABELS) as ChartTimeRange[]).map((range) => (
              <option key={range} value={range}>
                {CHART_TIME_RANGE_LABELS[range]}
              </option>
            ))}
          </select>
        </div>
        {showDonut && (
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={chartConfig.donut ?? false}
                onChange={(e) => updateChart({ donut: e.target.checked })}
                className="size-3.5 rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430] focus:ring-offset-0"
              />
              <span className="text-[10px] text-slate-400">Modo donut</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function TableConfigEditor({
  section,
  pageId,
  updateSectionConfig,
  inputCls,
  labelCls,
}: {
  section: FrontSection;
  pageId: string;
  updateSectionConfig: (pageId: string, sectionId: string, patch: Record<string, unknown>) => void;
  inputCls: string;
  labelCls: string;
}) {
  const tableConfig = (section.config?._table as TableConfig) ?? DEFAULT_TABLE_CONFIG;
  const columnDefs = tableConfig.columnDefs ?? [];

  const updateTable = (patch: Partial<TableConfig>) => {
    updateSectionConfig(pageId, section.id, { _table: { ...tableConfig, ...patch } });
  };

  const updateColumn = (colIdx: number, patch: Partial<TableColumnDef>) => {
    const updated = columnDefs.map((c, i) => (i === colIdx ? { ...c, ...patch } : c));
    updateTable({ columnDefs: updated });
  };

  const addColumn = () => {
    const newCol: TableColumnDef = {
      id: `col_${Date.now()}`,
      header: `Columna ${columnDefs.length + 1}`,
      type: "string",
      format: "text",
      sortable: true,
      filterable: true,
    };
    updateTable({ columnDefs: [...columnDefs, newCol] });
  };

  const removeColumn = (colIdx: number) => {
    updateTable({ columnDefs: columnDefs.filter((_, i) => i !== colIdx) });
  };

  const toggleRowAction = (action: TableRowAction) => {
    const current = tableConfig.rowActions ?? [];
    const next = current.includes(action)
      ? current.filter((a) => a !== action)
      : [...current, action];
    updateTable({ rowActions: next });
  };

  return (
    <div className="mt-1 pt-2 border-t border-slate-700/30 space-y-2">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider font-medium">Configuración de tabla</p>

      {/* Page size + searchable */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Filas por página</label>
          <select
            value={tableConfig.pageSize ?? 10}
            onChange={(e) => updateTable({ pageSize: Number(e.target.value) })}
            className={inputCls}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={tableConfig.searchable ?? true}
              onChange={(e) => updateTable({ searchable: e.target.checked })}
              className="size-3.5 rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430] focus:ring-offset-0"
            />
            <span className="text-[10px] text-slate-400">Búsqueda global</span>
          </label>
        </div>
      </div>

      {/* Row actions */}
      <div>
        <label className={labelCls}>Acciones por fila</label>
        <div className="flex gap-3">
          {(Object.keys(TABLE_ROW_ACTION_LABELS) as TableRowAction[]).map((action) => (
            <label key={action} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={(tableConfig.rowActions ?? []).includes(action)}
                onChange={() => toggleRowAction(action)}
                className="size-3 rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430] focus:ring-offset-0"
              />
              <span className="text-[10px] text-slate-400">{TABLE_ROW_ACTION_LABELS[action]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Column definitions */}
      <div>
        <div className="flex items-center justify-between">
          <label className={labelCls}>Definición de columnas</label>
          <button
            onClick={addColumn}
            className="flex items-center gap-1 text-[10px] text-[#dd7430] hover:text-[#e8944d] transition-colors"
          >
            <Plus className="size-3" />
            Agregar
          </button>
        </div>
        {columnDefs.length === 0 && (
          <p className="text-[9px] text-slate-600 mt-0.5">Sin columnas definidas — se usarán las del campo &quot;Columnas&quot; arriba.</p>
        )}
        <div className="space-y-1.5 mt-1">
          {columnDefs.map((col, i) => (
            <div key={col.id} className="rounded border border-slate-700/40 bg-slate-800/30 p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={col.header}
                  onChange={(e) => updateColumn(i, { header: e.target.value })}
                  placeholder="Encabezado"
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={() => removeColumn(i)}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={col.type}
                  onChange={(e) => updateColumn(i, { type: e.target.value as TableColumnType })}
                  className={inputCls}
                >
                  {(Object.keys(TABLE_COLUMN_TYPE_LABELS) as TableColumnType[]).map((t) => (
                    <option key={t} value={t}>{TABLE_COLUMN_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <select
                  value={col.format}
                  onChange={(e) => updateColumn(i, { format: e.target.value as TableColumnFormat })}
                  className={inputCls}
                >
                  {(Object.keys(TABLE_COLUMN_FORMAT_LABELS) as TableColumnFormat[]).map((f) => (
                    <option key={f} value={f}>{TABLE_COLUMN_FORMAT_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={col.sortable}
                    onChange={(e) => updateColumn(i, { sortable: e.target.checked })}
                    className="size-3 rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430] focus:ring-offset-0"
                  />
                  <span className="text-[10px] text-slate-400">Ordenable</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={col.filterable}
                    onChange={(e) => updateColumn(i, { filterable: e.target.checked })}
                    className="size-3 rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430] focus:ring-offset-0"
                  />
                  <span className="text-[10px] text-slate-400">Filtrable</span>
                </label>
                <select
                  value={col.align ?? "left"}
                  onChange={(e) => updateColumn(i, { align: e.target.value as "left" | "center" | "right" })}
                  className={`${inputCls} w-20`}
                >
                  <option value="left">Izq</option>
                  <option value="center">Centro</option>
                  <option value="right">Der</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormConfigEditor({
  section,
  pageId,
  front,
  updateSectionConfig,
  inputCls,
  labelCls,
}: {
  section: FrontSection;
  pageId: string;
  front: Front;
  updateSectionConfig: (pageId: string, sectionId: string, patch: Record<string, unknown>) => void;
  inputCls: string;
  labelCls: string;
}) {
  const { flows } = useFlows();
  const formConfig = (section.config?._form as FormConfig) ?? DEFAULT_FORM_CONFIG;
  const fieldDefs = formConfig.fields ?? [];

  // Only flows assigned to this front
  const assignedFlows = flows.filter((f) => front.flowIds.includes(f.id));

  const updateForm = (patch: Partial<FormConfig>) => {
    updateSectionConfig(pageId, section.id, { _form: { ...formConfig, ...patch } });
  };

  const updateField = (fieldIdx: number, patch: Partial<FormFieldDef>) => {
    const updated = fieldDefs.map((f, i) => (i === fieldIdx ? { ...f, ...patch } : f));
    updateForm({ fields: updated });
  };

  const addField = () => {
    const newField: FormFieldDef = {
      id: `field_${Date.now()}`,
      label: `Campo ${fieldDefs.length + 1}`,
      type: "text",
      required: false,
    };
    updateForm({ fields: [...fieldDefs, newField] });
  };

  const removeField = (fieldIdx: number) => {
    updateForm({ fields: fieldDefs.filter((_, i) => i !== fieldIdx) });
  };

  // Get variables from the target flow for mapping
  const targetFlow = assignedFlows.find((f) => f.id === formConfig.targetFlowId);
  const targetVariables = targetFlow?.variables ?? [];

  return (
    <div className="mt-1 pt-2 border-t border-slate-700/30 space-y-2">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider font-medium">Configuración del formulario</p>

      {/* Target flow */}
      <div>
        <label className={labelCls}>Flujo destino</label>
        <select
          value={formConfig.targetFlowId ?? ""}
          onChange={(e) => updateForm({ targetFlowId: e.target.value || undefined })}
          className={inputCls}
        >
          <option value="">Sin flujo (solo registro)</option>
          {assignedFlows.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <p className="text-[9px] text-slate-600 mt-0.5">Solo flujos asignados a este front</p>
      </div>

      {/* Submit label + success message */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Texto del botón</label>
          <input
            type="text"
            value={formConfig.submitLabel ?? "Enviar"}
            onChange={(e) => updateForm({ submitLabel: e.target.value || undefined })}
            placeholder="Enviar"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Mensaje de éxito</label>
          <input
            type="text"
            value={formConfig.successMessage ?? ""}
            onChange={(e) => updateForm({ successMessage: e.target.value || undefined })}
            placeholder="Formulario enviado..."
            className={inputCls}
          />
        </div>
      </div>

      {/* Field definitions */}
      <div>
        <div className="flex items-center justify-between">
          <label className={labelCls}>Definición de campos</label>
          <button
            onClick={addField}
            className="flex items-center gap-1 text-[10px] text-[#dd7430] hover:text-[#e8944d] transition-colors"
          >
            <Plus className="size-3" />
            Agregar
          </button>
        </div>
        {fieldDefs.length === 0 && (
          <p className="text-[9px] text-slate-600 mt-0.5">Sin campos definidos — se usarán los del campo legacy arriba.</p>
        )}
        <div className="space-y-1.5 mt-1">
          {fieldDefs.map((field, i) => (
            <div key={field.id} className="rounded border border-slate-700/40 bg-slate-800/30 p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                  placeholder="Label del campo"
                  className={`${inputCls} flex-1`}
                />
                <button
                  onClick={() => removeField(i)}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={field.type}
                  onChange={(e) => updateField(i, { type: e.target.value as FormFieldType })}
                  className={inputCls}
                >
                  {(Object.keys(FORM_FIELD_TYPE_LABELS) as FormFieldType[]).map((t) => (
                    <option key={t} value={t}>{FORM_FIELD_TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={field.placeholder ?? ""}
                  onChange={(e) => updateField(i, { placeholder: e.target.value || undefined })}
                  placeholder="Placeholder"
                  className={inputCls}
                />
              </div>
              {/* Select options */}
              {field.type === "select" && (
                <div>
                  <label className={labelCls}>Opciones (separadas por coma)</label>
                  <input
                    type="text"
                    value={(field.options ?? []).join(", ")}
                    onChange={(e) => updateField(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                    placeholder="Opción 1, Opción 2, Opción 3"
                    className={inputCls}
                  />
                </div>
              )}
              {/* Variable mapping + required + validation */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(i, { required: e.target.checked })}
                    className="size-3 rounded border-slate-600 bg-slate-700 text-[#dd7430] focus:ring-[#dd7430] focus:ring-offset-0"
                  />
                  <span className="text-[10px] text-slate-400">Requerido</span>
                </label>
                {targetVariables.length > 0 && (
                  <div className="flex-1">
                    <select
                      value={field.variableMapping ?? ""}
                      onChange={(e) => updateField(i, { variableMapping: e.target.value || undefined })}
                      className={`${inputCls} text-[10px]`}
                    >
                      <option value="">Sin mapeo</option>
                      {targetVariables.map((v) => (
                        <option key={v.id} value={v.name}>→ {v.name} ({v.type})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {/* Validation rules */}
              <details className="group">
                <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-400">Validaciones</summary>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {(field.type === "text" || field.type === "textarea" || field.type === "email") && (
                    <>
                      <div>
                        <label className={labelCls}>Mín. caracteres</label>
                        <input
                          type="number"
                          value={field.validation?.minLength ?? ""}
                          onChange={(e) => updateField(i, { validation: { ...field.validation, minLength: e.target.value ? Number(e.target.value) : undefined } })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Máx. caracteres</label>
                        <input
                          type="number"
                          value={field.validation?.maxLength ?? ""}
                          onChange={(e) => updateField(i, { validation: { ...field.validation, maxLength: e.target.value ? Number(e.target.value) : undefined } })}
                          className={inputCls}
                        />
                      </div>
                    </>
                  )}
                  {field.type === "number" && (
                    <>
                      <div>
                        <label className={labelCls}>Mínimo</label>
                        <input
                          type="number"
                          value={field.validation?.min ?? ""}
                          onChange={(e) => updateField(i, { validation: { ...field.validation, min: e.target.value ? Number(e.target.value) : undefined } })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Máximo</label>
                        <input
                          type="number"
                          value={field.validation?.max ?? ""}
                          onChange={(e) => updateField(i, { validation: { ...field.validation, max: e.target.value ? Number(e.target.value) : undefined } })}
                          className={inputCls}
                        />
                      </div>
                    </>
                  )}
                  <div className="col-span-2">
                    <label className={labelCls}>Patrón (regex)</label>
                    <input
                      type="text"
                      value={field.validation?.pattern ?? ""}
                      onChange={(e) => updateField(i, { validation: { ...field.validation, pattern: e.target.value || undefined } })}
                      placeholder="^[A-Z].*"
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </div>
              </details>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ButtonActionEditor({
  section,
  pageId,
  front,
  updateSectionConfig,
  inputCls,
  labelCls,
}: {
  section: FrontSection;
  pageId: string;
  front: Front;
  updateSectionConfig: (pageId: string, sectionId: string, patch: Record<string, unknown>) => void;
  inputCls: string;
  labelCls: string;
}) {
  const { flows } = useFlows();
  const actionConfig = (section.config?._action as ButtonActionConfig) ?? { mode: "link" as ButtonActionMode };
  const assignedFlows = flows.filter((f) => front.flowIds.includes(f.id));

  const updateAction = (patch: Partial<ButtonActionConfig>) => {
    updateSectionConfig(pageId, section.id, { _action: { ...actionConfig, ...patch } });
  };

  return (
    <div className="mt-1 pt-2 border-t border-slate-700/30 space-y-2">
      <p className="text-[9px] text-slate-500 uppercase tracking-wider font-medium">Acción del botón</p>

      {/* Mode selector */}
      <div>
        <label className={labelCls}>Modo</label>
        <select
          value={actionConfig.mode}
          onChange={(e) => updateAction({ mode: e.target.value as ButtonActionMode })}
          className={inputCls}
        >
          {(Object.keys(BUTTON_ACTION_MODE_LABELS) as ButtonActionMode[]).map((m) => (
            <option key={m} value={m}>{BUTTON_ACTION_MODE_LABELS[m]}</option>
          ))}
        </select>
      </div>

      {/* Link mode */}
      {actionConfig.mode === "link" && (
        <div>
          <label className={labelCls}>URL destino</label>
          <input
            type="text"
            value={(section.config?.url as string) ?? ""}
            onChange={(e) => updateSectionConfig(pageId, section.id, { url: e.target.value })}
            placeholder="https://..."
            className={inputCls}
          />
        </div>
      )}

      {/* Flow mode */}
      {actionConfig.mode === "flow" && (
        <>
          <div>
            <label className={labelCls}>Flujo destino</label>
            <select
              value={actionConfig.targetFlowId ?? ""}
              onChange={(e) => updateAction({ targetFlowId: e.target.value || undefined })}
              className={inputCls}
            >
              <option value="">Seleccionar flujo...</option>
              {assignedFlows.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            {assignedFlows.length === 0 && (
              <p className="text-[9px] text-amber-400/60 mt-0.5">No hay flujos asignados a este front</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Payload fijo (JSON)</label>
            <textarea
              value={actionConfig.payload ? JSON.stringify(actionConfig.payload, null, 2) : ""}
              onChange={(e) => {
                if (!e.target.value.trim()) {
                  updateAction({ payload: undefined });
                  return;
                }
                try {
                  const parsed = JSON.parse(e.target.value);
                  if (typeof parsed === "object" && parsed !== null) updateAction({ payload: parsed });
                } catch { /* allow editing */ }
              }}
              rows={2}
              placeholder='{"accion": "procesar", "prioridad": "alta"}'
              className={`${inputCls} font-mono resize-none`}
            />
            <p className="text-[9px] text-slate-600 mt-0.5">Datos enviados al flujo al presionar el botón</p>
          </div>

          <div>
            <label className={labelCls}>Mensaje de confirmación</label>
            <input
              type="text"
              value={actionConfig.confirmationMessage ?? ""}
              onChange={(e) => updateAction({ confirmationMessage: e.target.value || undefined })}
              placeholder="¿Estás seguro? (dejar vacío = sin confirmación)"
              className={inputCls}
            />
            <p className="text-[9px] text-slate-600 mt-0.5">Si se completa, se muestra un diálogo antes de ejecutar</p>
          </div>
        </>
      )}
    </div>
  );
}
