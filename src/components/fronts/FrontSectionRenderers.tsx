"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  MessageCircle,
  Send,
  ChevronRight,
  ChevronLeft,
  Lock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Package,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Loader2,
  Download,
  Image as ImageIcon,
  FileSpreadsheet,
  Filter,
  Play,
  Eye,
  X,
  CheckCircle,
  ChevronDown,
  Tag,
  Layers,
  Pencil,
  Trash2,
  AlertTriangle,
  Plus,
  Settings,
  Percent,
} from "lucide-react";
import type { FrontSection } from "@/types/front";
import type { TemplateStyles } from "@/lib/front-template-styles";
import type { WidgetSize, WidgetGeneralConfig, ChartConfig, TableConfig, TableColumnDef, TableColumnFormat, TableRowAction, FormConfig, FormFieldDef, FormFieldValidation, ButtonActionConfig, StockFormConfig } from "@/types/front-widgets";
import type { WidgetDataError } from "@/hooks/useWidgetData";
import { exportChartAsPng, exportChartAsCsv } from "@/lib/chart-export";
import { addFormSubmission, addButtonAction } from "@/lib/form-submissions";
import { useProducts } from "@/providers/ProductsProvider";
import { useCalendars } from "@/providers/CalendarsProvider";
import { generateUniqueCode, attrSignature, nameToKey } from "@/lib/stock-utils";
import type { Product, ProductVariant, VariantType, Discount } from "@/types/product";
import type { CalendarBookingConfig } from "@/types/front-widgets";
import type { Calendar, CalendarResource, AvailableSlot, DayOfWeek } from "@/types/calendar";
import { DAYS_OF_WEEK, BOOKING_MODE_LABELS } from "@/types/calendar";

// --- Widget size wrapper ---

const SIZE_CLASSES: Record<WidgetSize, string> = {
  small: "max-w-sm",
  medium: "max-w-2xl",
  large: "max-w-4xl",
  full: "max-w-full",
};

function WidgetSizeWrapper({
  section,
  children,
}: {
  section: FrontSection;
  children: React.ReactNode;
}) {
  const general = (section.config?._general as WidgetGeneralConfig) ?? undefined;
  const size = general?.size ?? "medium";
  // Only wrap non-default sizes (most renderers already set their own max-w)
  if (size === "medium") return <>{children}</>;
  return (
    <div className={`${SIZE_CLASSES[size]} mx-auto`}>
      {children}
    </div>
  );
}

// --- Section renderers (shared between FrontRenderer and FrontPreview) ---

// --- Widget data status overlay ---

export interface WidgetDataProps {
  resolvedData?: Record<string, unknown>;
  isLoading?: boolean;
  error?: WidgetDataError | null;
  lastUpdated?: string | null;
  onRefresh?: () => void;
}

function WidgetDataWrapper({
  children,
  widgetData,
}: {
  children: React.ReactNode;
  widgetData?: WidgetDataProps;
}) {
  if (!widgetData) return <>{children}</>;

  // Loading state
  if (widgetData.isLoading) {
    return (
      <section className="py-12 px-4">
        <div className="max-w-md mx-auto flex flex-col items-center gap-3 py-8">
          <Loader2 className="size-6 text-white/30 animate-spin" />
          <p className="text-sm text-white/40">Cargando datos...</p>
        </div>
      </section>
    );
  }

  // Permission error
  if (widgetData.error?.type === "insufficient_permissions") {
    return (
      <section className="py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="rounded-xl border border-white/10 p-6 bg-white/5 flex flex-col items-center gap-3">
            <Lock className="size-6 text-white/20" />
            <p className="text-sm text-white/40 text-center">{widgetData.error.message}</p>
          </div>
        </div>
      </section>
    );
  }

  // Data error (no_data, invalid_binding)
  if (widgetData.error && widgetData.error.type !== "no_bindings") {
    return (
      <section className="py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="rounded-xl border border-amber-500/20 p-6 bg-amber-900/5 flex flex-col items-center gap-3">
            <AlertCircle className="size-6 text-amber-400/50" />
            <p className="text-sm text-amber-400/60 text-center">{widgetData.error.message}</p>
            {widgetData.onRefresh && (
              <button
                onClick={widgetData.onRefresh}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/20 text-amber-400/60 text-xs hover:text-amber-300 hover:border-amber-500/40 transition-colors"
              >
                <RefreshCw className="size-3" />
                Reintentar
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  // OK — render widget with optional refresh badge
  return (
    <div className="relative">
      {children}
      {widgetData.lastUpdated && widgetData.error?.type !== "no_bindings" && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <span className="text-[9px] text-white/20">
            {new Date(widgetData.lastUpdated).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          {widgetData.onRefresh && (
            <button
              onClick={widgetData.onRefresh}
              className="p-1 rounded text-white/20 hover:text-white/50 transition-colors"
              aria-label="Refrescar datos"
            >
              <RefreshCw className="size-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Chart export menu ---

function ChartExportMenu({
  svgRef,
  data,
  title,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  data: { label: string; value: number }[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const filename = title?.replace(/[^a-zA-Z0-9]/g, "_") || "chart";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
        aria-label="Exportar"
      >
        <Download className="size-3" />
        Exportar
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur-sm shadow-lg py-1 min-w-[120px]">
          <button
            onClick={() => { if (svgRef.current) exportChartAsPng(svgRef.current, filename); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5"
          >
            <ImageIcon className="size-3" />
            PNG
          </button>
          <button
            onClick={() => { exportChartAsCsv(data, filename); setOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5"
          >
            <FileSpreadsheet className="size-3" />
            CSV
          </button>
        </div>
      )}
    </div>
  );
}

export function SectionRenderer({
  section,
  primaryColor,
  secondaryColor,
  frontName,
  canInteract,
  widgetData,
  frontId,
  session,
  templateStyles,
}: {
  section: FrontSection;
  primaryColor: string;
  secondaryColor: string;
  frontName: string;
  canInteract: boolean;
  widgetData?: WidgetDataProps;
  frontId?: string;
  session?: { visitorId?: string; email?: string; name?: string; role?: string } | null;
  templateStyles?: TemplateStyles;
}) {
  let content: React.ReactNode;
  const wd = widgetData?.resolvedData ?? {};
  const ts = templateStyles;
  switch (section.type) {
    case "hero":
      content = <HeroSection section={section} primaryColor={primaryColor} templateStyles={ts} />; break;
    case "chat":
      content = <ChatSection section={section} primaryColor={primaryColor} secondaryColor={secondaryColor} canInteract={canInteract} />; break;
    case "info":
      content = <InfoSection section={section} />; break;
    case "faq":
      content = <FaqSection section={section} primaryColor={primaryColor} />; break;
    case "chart_line":
      content = <ChartLineSection section={section} primaryColor={primaryColor} widgetData={wd} />; break;
    case "chart_bar":
      content = <ChartBarSection section={section} primaryColor={primaryColor} widgetData={wd} />; break;
    case "chart_pie":
      content = <ChartPieSection section={section} primaryColor={primaryColor} widgetData={wd} />; break;
    case "chart_kpi":
      content = <ChartKpiSection section={section} primaryColor={primaryColor} widgetData={wd} />; break;
    case "table_data":
      content = <TableDataSection section={section} widgetData={wd} primaryColor={primaryColor} />; break;
    case "table_stock":
      content = <TableStockSection section={section} />; break;
    case "form_contact":
      content = <FormContactSection section={section} primaryColor={primaryColor} canInteract={canInteract} frontId={frontId} session={session} />; break;
    case "button_cta":
      content = <ButtonCtaSection section={section} primaryColor={primaryColor} canInteract={canInteract} frontId={frontId} session={session} />; break;
    case "stock_list":
      content = <StockListSection section={section} primaryColor={primaryColor} canInteract={canInteract} />; break;
    case "stock_form":
      content = <StockFormSection section={section} primaryColor={primaryColor} canInteract={canInteract} />; break;
    case "calendar_booking":
      content = <CalendarBookingSection section={section} primaryColor={primaryColor} canInteract={canInteract} frontId={frontId} session={session} />; break;
    default:
      return null;
  }

  // Wrap in template section spacing
  const sectionWrapper = ts ? (
    <div className={ts.sectionClass}>
      <div className="max-w-6xl mx-auto">{content}</div>
    </div>
  ) : content;

  // Wrap data widgets with data status overlay
  const isDataWidget = ["chart_line", "chart_bar", "chart_pie", "chart_kpi", "table_data"].includes(section.type);
  if (isDataWidget && widgetData) {
    return (
      <WidgetSizeWrapper section={section}>
        <WidgetDataWrapper widgetData={widgetData}>{sectionWrapper}</WidgetDataWrapper>
      </WidgetSizeWrapper>
    );
  }

  return <WidgetSizeWrapper section={section}>{sectionWrapper}</WidgetSizeWrapper>;
}

export function HeroSection({ section, primaryColor, templateStyles: ts }: { section: FrontSection; primaryColor: string; templateStyles?: TemplateStyles }) {
  return (
    <section className={ts?.heroClass ?? "py-16 sm:py-24 text-center px-4"}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
          {section.title}
        </h1>
        {section.content && (
          <p className="text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            {section.content}
          </p>
        )}
        <div className="mt-8">
          <button
            className={`${ts?.heroBtnClass ?? "px-6 py-3 rounded-lg"} text-white font-medium text-lg transition-all hover:opacity-90 hover:scale-[1.02]`}
            style={{ backgroundColor: primaryColor }}
          >
            Comenzar
            <ChevronRight className="inline-block ml-1 size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}

export function ChatSection({
  section,
  primaryColor,
  secondaryColor,
  canInteract,
}: {
  section: FrontSection;
  primaryColor: string;
  secondaryColor: string;
  canInteract: boolean;
}) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "¡Hola! ¿En qué puedo ayudarte?" },
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!canInteract || !input.trim()) return;
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");
    // Simulated response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Gracias por tu mensaje. Un agente procesará tu consulta pronto.` },
      ]);
    }, 800);
  };

  return (
    <section className="py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{section.title}</h2>
        )}
        <div
          className="rounded-2xl border border-white/10 overflow-hidden"
          style={{ backgroundColor: `${secondaryColor}dd` }}
        >
          {/* Chat header */}
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <MessageCircle className="size-5 text-white" />
            <span className="text-white font-medium text-sm">Chat</span>
          </div>

          {/* Messages */}
          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "text-white rounded-br-md"
                      : "bg-white/10 text-white/90 rounded-bl-md"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: primaryColor } : undefined}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          {canInteract ? (
            <div className="border-t border-white/10 p-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2.5 rounded-xl text-white transition-opacity disabled:opacity-30"
                style={{ backgroundColor: primaryColor }}
                aria-label="Enviar mensaje"
              >
                <Send className="size-4" />
              </button>
            </div>
          ) : (
            <div className="border-t border-white/10 p-3 flex items-center justify-center gap-2 text-white/30 text-xs">
              <Lock className="size-3.5" />
              No tienes permisos para enviar mensajes
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function InfoSection({ section }: { section: FrontSection }) {
  return (
    <section className="py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-4">{section.title}</h2>
        )}
        {section.content && (
          <div className="text-white/70 leading-relaxed whitespace-pre-line">
            {section.content}
          </div>
        )}
      </div>
    </section>
  );
}

export function FaqSection({ section, primaryColor }: { section: FrontSection; primaryColor: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // Parse FAQ from content: "Pregunta?\nRespuesta\n\nPregunta?\nRespuesta"
  const pairs: { q: string; a: string }[] = [];
  if (section.content) {
    const blocks = section.content.split(/\n\n+/);
    for (const block of blocks) {
      const lines = block.split("\n");
      if (lines.length >= 2) {
        pairs.push({ q: lines[0], a: lines.slice(1).join("\n") });
      } else if (lines.length === 1 && lines[0].endsWith("?")) {
        pairs.push({ q: lines[0], a: "" });
      }
    }
  }

  return (
    <section className="py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{section.title}</h2>
        )}
        <div className="space-y-2">
          {pairs.map((pair, i) => (
            <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-white">{pair.q}</span>
                <ChevronRight
                  className={`size-4 text-white/40 transition-transform ${openIdx === i ? "rotate-90" : ""}`}
                />
              </button>
              {openIdx === i && pair.a && (
                <div className="px-5 pb-4 text-sm text-white/60 whitespace-pre-line">
                  {pair.a}
                </div>
              )}
            </div>
          ))}
        </div>
        {pairs.length === 0 && (
          <p className="text-center text-white/40 text-sm">No hay preguntas frecuentes configuradas.</p>
        )}
      </div>
    </section>
  );
}

// --- Chart Line ---

const DEFAULT_CHART_DATA = [
  { label: "Ene", value: 120 },
  { label: "Feb", value: 180 },
  { label: "Mar", value: 150 },
  { label: "Abr", value: 220 },
  { label: "May", value: 190 },
  { label: "Jun", value: 280 },
];

function ChartLineSection({ section, primaryColor, widgetData }: { section: FrontSection; primaryColor: string; widgetData?: Record<string, unknown> }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartConfig = (section.config?._chart as ChartConfig) ?? {};
  const resolvedDataPoints = widgetData?.data as { label: string; value: number }[] | undefined;
  const rawData = resolvedDataPoints ?? (section.config?.data as { label: string; value: number }[] | undefined) ?? DEFAULT_CHART_DATA;
  const data = rawData.length > 0 ? rawData : DEFAULT_CHART_DATA;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const w = 400;
  const h = 220;
  const padL = chartConfig.yAxisLabel ? 55 : 40;
  const padR = 20;
  const padT = 20;
  const padB = chartConfig.xAxisLabel ? 50 : 40;

  const points = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * (w - padL - padR),
    y: padT + (1 - d.value / maxVal) * (h - padT - padB),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${points[points.length - 1].x},${h - padB} L${points[0].x},${h - padB} Z`;

  return (
    <section className="py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{section.title}</h2>
        )}
        <div className="rounded-xl border border-white/10 p-6 bg-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-white/40" />
              <span className="text-sm text-white/60">Tendencia</span>
            </div>
            <ChartExportMenu svgRef={svgRef} data={data} title={section.title ?? "chart_line"} />
          </div>
          <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = padT + pct * (h - padT - padB);
              return (
                <line key={pct} x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255,255,255,0.06)" />
              );
            })}
            {/* Y-axis values */}
            {[0, 0.5, 1].map((pct) => {
              const y = padT + pct * (h - padT - padB);
              const val = Math.round(maxVal * (1 - pct));
              return (
                <text key={`yval-${pct}`} x={padL - 5} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9}>
                  {val.toLocaleString()}
                </text>
              );
            })}
            {/* Area fill */}
            <path d={area} fill={primaryColor} opacity={0.15} />
            {/* Line */}
            <path d={line} fill="none" stroke={primaryColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {/* Data points */}
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4} fill={primaryColor} stroke="rgba(0,0,0,0.3)" strokeWidth={1.5} />
            ))}
            {/* X-axis labels */}
            {data.map((d, i) => (
              <text key={i} x={points[i].x} y={h - padB + 16} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={10}>
                {d.label}
              </text>
            ))}
            {/* Axis labels */}
            {chartConfig.xAxisLabel && (
              <text x={w / 2} y={h - 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={10}>
                {chartConfig.xAxisLabel}
              </text>
            )}
            {chartConfig.yAxisLabel && (
              <text x={12} y={h / 2} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={10} transform={`rotate(-90, 12, ${h / 2})`}>
                {chartConfig.yAxisLabel}
              </text>
            )}
          </svg>
        </div>
      </div>
    </section>
  );
}

// --- Chart Bar ---

const DEFAULT_BAR_DATA = [
  { label: "Producto A", value: 320 },
  { label: "Producto B", value: 580 },
  { label: "Producto C", value: 210 },
  { label: "Producto D", value: 450 },
  { label: "Producto E", value: 380 },
];

function ChartBarSection({ section, primaryColor, widgetData }: { section: FrontSection; primaryColor: string; widgetData?: Record<string, unknown> }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartConfig = (section.config?._chart as ChartConfig) ?? {};
  const resolvedDataPoints = widgetData?.data as { label: string; value: number }[] | undefined;
  const rawData = resolvedDataPoints ?? (section.config?.data as { label: string; value: number }[] | undefined) ?? DEFAULT_BAR_DATA;
  const data = rawData.length > 0 ? rawData : DEFAULT_BAR_DATA;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const w = 400;
  const h = 220;
  const padL = chartConfig.yAxisLabel ? 55 : 45;
  const padR = 15;
  const padT = 15;
  const padB = chartConfig.xAxisLabel ? 55 : 45;
  const barGap = 8;
  const barWidth = Math.max(10, (w - padL - padR - barGap * (data.length + 1)) / data.length);

  return (
    <section className="py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{section.title}</h2>
        )}
        <div className="rounded-xl border border-white/10 p-6 bg-white/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-white/60">Comparación</span>
            <ChartExportMenu svgRef={svgRef} data={data} title={section.title ?? "chart_bar"} />
          </div>
          <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = padT + pct * (h - padT - padB);
              return <line key={pct} x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(255,255,255,0.06)" />;
            })}
            {/* Y-axis values */}
            {[0, 0.5, 1].map((pct) => {
              const y = padT + pct * (h - padT - padB);
              const val = Math.round(maxVal * (1 - pct));
              return (
                <text key={`yval-${pct}`} x={padL - 5} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9}>
                  {val.toLocaleString()}
                </text>
              );
            })}
            {/* Bars */}
            {data.map((d, i) => {
              const barH = (d.value / maxVal) * (h - padT - padB);
              const x = padL + barGap + i * (barWidth + barGap);
              const y = h - padB - barH;
              return (
                <g key={i}>
                  <rect x={x} y={y} width={barWidth} height={barH} fill={primaryColor} rx={3} opacity={0.85} />
                  <rect x={x} y={y} width={barWidth} height={barH} fill="white" rx={3} opacity={0} className="hover:opacity-10 transition-opacity" />
                  {/* X label */}
                  <text x={x + barWidth / 2} y={h - padB + 16} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9}>
                    {d.label.length > 8 ? d.label.slice(0, 7) + "…" : d.label}
                  </text>
                  {/* Value on top */}
                  <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={8}>
                    {d.value.toLocaleString()}
                  </text>
                </g>
              );
            })}
            {/* Axis labels */}
            {chartConfig.xAxisLabel && (
              <text x={w / 2} y={h - 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={10}>
                {chartConfig.xAxisLabel}
              </text>
            )}
            {chartConfig.yAxisLabel && (
              <text x={12} y={h / 2} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={10} transform={`rotate(-90, 12, ${h / 2})`}>
                {chartConfig.yAxisLabel}
              </text>
            )}
          </svg>
        </div>
      </div>
    </section>
  );
}

// --- Chart Pie / Donut ---

const DEFAULT_PIE_DATA = [
  { label: "Segmento A", value: 35 },
  { label: "Segmento B", value: 25 },
  { label: "Segmento C", value: 20 },
  { label: "Segmento D", value: 12 },
  { label: "Otros", value: 8 },
];

const PIE_COLORS = [
  "hsl(20, 70%, 55%)",
  "hsl(200, 60%, 50%)",
  "hsl(150, 50%, 45%)",
  "hsl(280, 50%, 55%)",
  "hsl(45, 65%, 55%)",
  "hsl(340, 55%, 50%)",
  "hsl(170, 50%, 45%)",
  "hsl(100, 45%, 50%)",
];

function ChartPieSection({ section, primaryColor, widgetData }: { section: FrontSection; primaryColor: string; widgetData?: Record<string, unknown> }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const chartConfig = (section.config?._chart as ChartConfig) ?? {};
  const isDonut = chartConfig.donut ?? false;
  const resolvedDataPoints = widgetData?.data as { label: string; value: number }[] | undefined;
  const rawData = resolvedDataPoints ?? (section.config?.data as { label: string; value: number }[] | undefined) ?? DEFAULT_PIE_DATA;
  const data = rawData.length > 0 ? rawData : DEFAULT_PIE_DATA;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;
  const innerR = isDonut ? 50 : 0;

  // Build arcs
  const arcs: { path: string; color: string; pct: number; label: string }[] = [];
  let currentAngle = -Math.PI / 2;
  for (let i = 0; i < data.length; i++) {
    const pct = total > 0 ? data[i].value / total : 0;
    const angle = pct * Math.PI * 2;
    const x1 = cx + r * Math.cos(currentAngle);
    const y1 = cy + r * Math.sin(currentAngle);
    const x2 = cx + r * Math.cos(currentAngle + angle);
    const y2 = cy + r * Math.sin(currentAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;

    let path: string;
    if (innerR > 0) {
      const ix1 = cx + innerR * Math.cos(currentAngle);
      const iy1 = cy + innerR * Math.sin(currentAngle);
      const ix2 = cx + innerR * Math.cos(currentAngle + angle);
      const iy2 = cy + innerR * Math.sin(currentAngle + angle);
      path = `M${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${largeArc},0 ${ix1},${iy1} Z`;
    } else {
      path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
    }

    arcs.push({ path, color: PIE_COLORS[i % PIE_COLORS.length], pct, label: data[i].label });
    currentAngle += angle;
  }

  return (
    <section className="py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{section.title}</h2>
        )}
        <div className="rounded-xl border border-white/10 p-6 bg-white/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-white/60">Distribución</span>
            <ChartExportMenu svgRef={svgRef} data={data} title={section.title ?? "chart_pie"} />
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} className="w-48 h-48 shrink-0">
              {arcs.map((arc, i) => (
                <path key={i} d={arc.path} fill={arc.color} opacity={0.85} className="hover:opacity-100 transition-opacity" />
              ))}
              {isDonut && (
                <text x={cx} y={cy + 4} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={14} fontWeight="bold">
                  {total.toLocaleString()}
                </text>
              )}
            </svg>
            {/* Legend */}
            <div className="flex flex-col gap-1.5 min-w-0">
              {arcs.map((arc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="size-3 rounded-sm shrink-0" style={{ backgroundColor: arc.color }} />
                  <span className="text-xs text-white/60 truncate">{arc.label}</span>
                  <span className="text-xs text-white/40 ml-auto">{(arc.pct * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Chart KPI ---

function ChartKpiSection({ section, primaryColor, widgetData }: { section: FrontSection; primaryColor: string; widgetData?: Record<string, unknown> }) {
  // Use resolved widget data if available
  const resolvedValue = widgetData ? Object.values(widgetData)[0] : undefined;
  const value = resolvedValue !== undefined ? String(typeof resolvedValue === "number" ? resolvedValue.toLocaleString("es-AR") : resolvedValue) : (section.config?.value as string) ?? "1,234";
  const unit = (section.config?.unit as string) ?? "";
  const change = (section.config?.change as number) ?? undefined;
  const isPositive = change !== undefined && change > 0;

  return (
    <section className="py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="rounded-xl border border-white/10 p-6 bg-white/5">
          {section.title && (
            <p className="text-sm font-medium text-white/50 mb-2">{section.title}</p>
          )}
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-white">{value}</p>
            {unit && <span className="text-white/40 text-sm">{unit}</span>}
          </div>
          {change !== undefined && (
            <div className="mt-3 flex items-center gap-2">
              {isPositive ? (
                <ArrowUpRight className="size-4 text-emerald-400" />
              ) : (
                <ArrowDownLeft className="size-4 text-red-400" />
              )}
              <span className={`text-sm font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                {Math.abs(change)}% vs período anterior
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// --- Table Data ---

const DEFAULT_TABLE_COLUMNS = ["Nombre", "Categoría", "Valor"];
const DEFAULT_TABLE_ROWS = [
  ["Ejemplo A", "Cat 1", "100"],
  ["Ejemplo B", "Cat 2", "250"],
  ["Ejemplo C", "Cat 1", "180"],
  ["Ejemplo D", "Cat 2", "320"],
  ["Ejemplo E", "Cat 3", "150"],
  ["Ejemplo F", "Cat 1", "420"],
  ["Ejemplo G", "Cat 3", "90"],
  ["Ejemplo H", "Cat 2", "560"],
  ["Ejemplo I", "Cat 1", "200"],
  ["Ejemplo J", "Cat 3", "340"],
  ["Ejemplo K", "Cat 2", "130"],
  ["Ejemplo L", "Cat 1", "470"],
];

function formatCellValue(value: string, format: TableColumnFormat): string {
  switch (format) {
    case "currency": {
      const n = parseFloat(value);
      return isNaN(n) ? value : `$${n.toLocaleString("es-AR")}`;
    }
    case "percent": {
      const n = parseFloat(value);
      return isNaN(n) ? value : `${n}%`;
    }
    case "date_short": {
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toLocaleDateString("es-AR");
    }
    case "date_long": {
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" });
    }
    default:
      return value;
  }
}

function CellRenderer({ value, format }: { value: string; format: TableColumnFormat }) {
  if (format === "badge") {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/70">
        {value}
      </span>
    );
  }
  return <>{formatCellValue(value, format)}</>;
}

function TableDataSection({ section, widgetData, primaryColor }: { section: FrontSection; widgetData?: Record<string, unknown>; primaryColor?: string }) {
  const tableConfig = (section.config?._table as TableConfig) ?? undefined;
  const columnDefs = tableConfig?.columnDefs ?? [];
  const pageSize = tableConfig?.pageSize ?? 10;
  const searchable = tableConfig?.searchable ?? true;
  const rowActions = tableConfig?.rowActions ?? [];

  // Resolve data: widgetData rows > config rows > defaults
  const resolvedRows = widgetData?.rows as string[][] | undefined;
  const legacyColumns = (section.config?.columns as string[]) ?? DEFAULT_TABLE_COLUMNS;
  const rawRows = resolvedRows ?? (section.config?.rows as string[][]) ?? DEFAULT_TABLE_ROWS;

  // Build effective columns from columnDefs or legacy columns
  const columns: { header: string; type: string; format: TableColumnFormat; sortable: boolean; filterable: boolean; align: string }[] = useMemo(() => {
    if (columnDefs.length > 0) {
      return columnDefs.map((cd) => ({
        header: cd.header,
        type: cd.type,
        format: cd.format,
        sortable: cd.sortable,
        filterable: cd.filterable,
        align: cd.align ?? "left",
      }));
    }
    return legacyColumns.map((h) => ({
      header: h,
      type: "string",
      format: "text" as TableColumnFormat,
      sortable: true,
      filterable: true,
      align: "left",
    }));
  }, [columnDefs, legacyColumns]);

  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [columnFilters, setColumnFilters] = useState<Record<number, string>>({});
  const [activeFilterCol, setActiveFilterCol] = useState<number | null>(null);
  const [actionRow, setActionRow] = useState<number | null>(null);

  // Filter rows
  const filteredRows = useMemo(() => {
    let rows = rawRows;

    // Global search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(term)));
    }

    // Per-column filters
    for (const [colIdx, filterVal] of Object.entries(columnFilters)) {
      if (!filterVal.trim()) continue;
      const idx = Number(colIdx);
      const term = filterVal.toLowerCase();
      rows = rows.filter((row) => String(row[idx] ?? "").toLowerCase().includes(term));
    }

    return rows;
  }, [rawRows, searchTerm, columnFilters]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (sortCol === null) return filteredRows;
    const col = columns[sortCol];
    if (!col) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";

      if (col.type === "number") {
        const na = parseFloat(va);
        const nb = parseFloat(vb);
        if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
      }
      if (col.type === "date") {
        const da = new Date(va).getTime();
        const db = new Date(vb).getTime();
        if (!isNaN(da) && !isNaN(db)) return sortAsc ? da - db : db - da;
      }

      const cmp = String(va).localeCompare(String(vb), "es");
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredRows, sortCol, sortAsc, columns]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages - 1);
  const pagedRows = sortedRows.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const handleSort = useCallback((colIdx: number) => {
    const col = columns[colIdx];
    if (!col?.sortable) return;
    setSortCol((prev) => {
      if (prev === colIdx) {
        setSortAsc((a) => !a);
        return colIdx;
      }
      setSortAsc(true);
      return colIdx;
    });
    setCurrentPage(0);
  }, [columns]);

  const handleColumnFilter = useCallback((colIdx: number, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [colIdx]: value }));
    setCurrentPage(0);
  }, []);

  // Unique values for filter dropdown
  const getUniqueValues = useCallback((colIdx: number) => {
    const vals = new Set<string>();
    rawRows.forEach((row) => { if (row[colIdx]) vals.add(String(row[colIdx])); });
    return Array.from(vals).sort();
  }, [rawRows]);

  const hasActions = rowActions.length > 0;
  const accent = primaryColor ?? "#dd7430";

  return (
    <section className="py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{section.title}</h2>
        )}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {/* Search bar */}
          {searchable && (
            <div className="p-3 border-b border-white/5 bg-white/[0.02]">
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/30" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(0); }}
                  placeholder="Buscar en tabla..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-white text-xs placeholder-white/30 focus:outline-none focus:border-white/20"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-xs font-medium text-white/50 uppercase tracking-wider ${
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                      }`}
                    >
                      <div className="flex items-center gap-1" style={{ justifyContent: col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start" }}>
                        {col.sortable ? (
                          <button
                            onClick={() => handleSort(i)}
                            className="flex items-center gap-1 hover:text-white/80 transition-colors"
                          >
                            {col.header}
                            {sortCol === i ? (
                              sortAsc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                            ) : (
                              <ArrowUpDown className="size-3 opacity-30" />
                            )}
                          </button>
                        ) : (
                          col.header
                        )}
                        {col.filterable && (
                          <button
                            onClick={() => setActiveFilterCol(activeFilterCol === i ? null : i)}
                            className={`p-0.5 rounded hover:text-white/80 transition-colors ${columnFilters[i] ? "text-white/80" : ""}`}
                          >
                            <Filter className="size-3" />
                          </button>
                        )}
                      </div>
                      {/* Column filter dropdown */}
                      {activeFilterCol === i && col.filterable && (
                        <div className="absolute z-20 mt-1 rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur-sm shadow-lg p-2 min-w-[160px]">
                          <input
                            type="text"
                            value={columnFilters[i] ?? ""}
                            onChange={(e) => handleColumnFilter(i, e.target.value)}
                            placeholder={`Filtrar ${col.header}...`}
                            className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-xs placeholder-white/30 focus:outline-none mb-1"
                            autoFocus
                          />
                          <div className="max-h-32 overflow-y-auto space-y-0.5">
                            {getUniqueValues(i).slice(0, 20).map((val) => (
                              <button
                                key={val}
                                onClick={() => { handleColumnFilter(i, val); setActiveFilterCol(null); }}
                                className="block w-full text-left px-2 py-1 text-xs text-white/60 hover:text-white hover:bg-white/5 rounded truncate"
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                          {columnFilters[i] && (
                            <button
                              onClick={() => { handleColumnFilter(i, ""); setActiveFilterCol(null); }}
                              className="w-full mt-1 px-2 py-1 text-[10px] text-white/40 hover:text-white/60 border-t border-white/5"
                            >
                              Limpiar filtro
                            </button>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                  {hasActions && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wider">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, ri) => {
                  const globalIdx = safePage * pageSize + ri;
                  return (
                    <tr key={ri} className="border-b border-white/5 hover:bg-white/[0.02]">
                      {row.map((cell, ci) => {
                        const col = columns[ci];
                        const format = col?.format ?? "text";
                        return (
                          <td
                            key={ci}
                            className={`px-4 py-3 text-sm text-white/70 ${
                              (col?.align === "right") ? "text-right" : (col?.align === "center") ? "text-center" : ""
                            }`}
                          >
                            <CellRenderer value={String(cell)} format={format} />
                          </td>
                        );
                      })}
                      {hasActions && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {rowActions.includes("send_to_flow") && (
                              <button
                                onClick={() => setActionRow(actionRow === globalIdx ? null : globalIdx)}
                                className="p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
                                aria-label="Enviar a flujo"
                              >
                                <Play className="size-3.5" />
                              </button>
                            )}
                            {rowActions.includes("open_detail") && (
                              <button
                                onClick={() => setActionRow(actionRow === globalIdx ? null : globalIdx)}
                                className="p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
                                aria-label="Abrir detalle"
                              >
                                <Eye className="size-3.5" />
                              </button>
                            )}
                          </div>
                          {/* Action feedback toast */}
                          {actionRow === globalIdx && (
                            <div
                              className="absolute right-4 mt-1 z-10 rounded-lg border px-3 py-2 text-xs text-white shadow-lg"
                              style={{ borderColor: accent + "40", backgroundColor: accent + "15" }}
                            >
                              Acción simulada — fila {globalIdx + 1}
                              <button onClick={() => setActionRow(null)} className="ml-2 text-white/40 hover:text-white/70">
                                <X className="size-3 inline" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {sortedRows.length === 0 && (
            <p className="text-center py-6 text-sm text-white/30">
              {searchTerm || Object.values(columnFilters).some((v) => v) ? "No se encontraron resultados." : "No hay datos."}
            </p>
          )}

          {/* Pagination + info */}
          {sortedRows.length > 0 && (
            <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between bg-white/[0.02]">
              <span className="text-[11px] text-white/30">
                {sortedRows.length} registro{sortedRows.length !== 1 ? "s" : ""}
                {searchTerm || Object.values(columnFilters).some((v) => v)
                  ? ` (de ${rawRows.length})`
                  : ""}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(Math.max(0, safePage - 1))}
                    disabled={safePage === 0}
                    className="p-1 rounded text-white/30 hover:text-white/60 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-[11px] text-white/40 px-2">
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages - 1, safePage + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="p-1 rounded text-white/30 hover:text-white/60 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// --- Table Stock ---

function TableStockSection({ section }: { section: FrontSection }) {
  const { products } = useProducts();
  return (
    <section className="py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{section.title}</h2>
        )}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Producto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/50 uppercase">Precio</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white/50 uppercase">Stock</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs font-mono text-white/50">{p.sku}</td>
                    <td className="px-4 py-3 text-sm text-white/80 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-white/60">{p.category}</td>
                    <td className="px-4 py-3 text-sm text-white/70 text-right">${p.price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${p.stock < 10 ? "text-red-400" : "text-emerald-400"}`}>
                        {p.stock}
                      </span>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-white/30">No hay productos en el catálogo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Form Contact ---

const DEFAULT_LEGACY_FIELDS = ["Nombre", "Email", "Mensaje"];

function validateField(value: string, field: FormFieldDef): string | null {
  if (field.required && !value.trim()) {
    return `${field.label} es requerido`;
  }
  if (!value.trim()) return null; // optional empty is OK

  const v = field.validation;
  if (v?.minLength && value.length < v.minLength) {
    return `Mínimo ${v.minLength} caracteres`;
  }
  if (v?.maxLength && value.length > v.maxLength) {
    return `Máximo ${v.maxLength} caracteres`;
  }
  if (field.type === "number") {
    const n = parseFloat(value);
    if (isNaN(n)) return "Debe ser un número";
    if (v?.min !== undefined && n < v.min) return `Mínimo ${v.min}`;
    if (v?.max !== undefined && n > v.max) return `Máximo ${v.max}`;
  }
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Email inválido";
  }
  if (v?.pattern) {
    try {
      if (!new RegExp(v.pattern).test(value)) return "Formato inválido";
    } catch { /* ignore bad regex */ }
  }
  return null;
}

function FormContactSection({
  section,
  primaryColor,
  canInteract,
  frontId,
  session,
}: {
  section: FrontSection;
  primaryColor: string;
  canInteract: boolean;
  frontId?: string;
  session?: { visitorId?: string; email?: string; name?: string; role?: string } | null;
}) {
  const formConfig = (section.config?._form as FormConfig) ?? undefined;
  const fieldDefs = formConfig?.fields ?? [];
  const targetFlowId = formConfig?.targetFlowId;
  const submitLabel = formConfig?.submitLabel ?? "Enviar";
  const successMessage = formConfig?.successMessage ?? "Formulario enviado correctamente.";

  // Build effective fields: from FormFieldDef or legacy string[]
  const effectiveFields: FormFieldDef[] = useMemo(() => {
    if (fieldDefs.length > 0) return fieldDefs;
    const legacyFields = (section.config?.fields as string[]) ?? DEFAULT_LEGACY_FIELDS;
    return legacyFields.map((name, i) => ({
      id: `legacy_${i}`,
      label: name,
      type: (name.toLowerCase().includes("email") ? "email" : name.toLowerCase() === "mensaje" ? "textarea" : "text") as FormFieldDef["type"],
      required: false,
      placeholder: name,
    }));
  }, [fieldDefs, section.config?.fields]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ status: "success" | "error"; message: string } | null>(null);

  const setValue = useCallback((fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canInteract || submitting) return;

    // Validate all fields
    const newErrors: Record<string, string> = {};
    for (const field of effectiveFields) {
      const val = values[field.id] ?? "";
      const err = validateField(val, field);
      if (err) newErrors[field.id] = err;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    // Build payload
    const payload: Record<string, unknown> = {};
    const variableMappings: Record<string, string> = {};
    for (const field of effectiveFields) {
      const val = values[field.id] ?? "";
      payload[field.label] = field.type === "number" ? parseFloat(val) || 0 : field.type === "checkbox" ? val === "true" : val;
      if (field.variableMapping) {
        variableMappings[field.label] = field.variableMapping;
      }
    }

    // Simulate async submission (no real backend)
    setTimeout(() => {
      const success = Math.random() > 0.1; // 90% success rate

      // Record event with traceability
      addFormSubmission({
        frontId: frontId ?? "unknown",
        sectionId: section.id,
        targetFlowId,
        submittedBy: {
          visitorId: session?.visitorId,
          email: session?.email,
          name: session?.name,
          role: session?.role,
        },
        payload,
        variableMappings,
        status: success ? "success" : "error",
        errorMessage: success ? undefined : "Error simulado al procesar el formulario",
      });

      if (success) {
        setSubmitResult({ status: "success", message: successMessage });
        setValues({});
      } else {
        setSubmitResult({ status: "error", message: "Error al enviar el formulario. Intenta de nuevo." });
      }
      setSubmitting(false);
    }, 600);
  }, [canInteract, submitting, effectiveFields, values, frontId, section.id, targetFlowId, session, successMessage]);

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 disabled:opacity-40";

  return (
    <section className="py-12 px-4">
      <div className="max-w-lg mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{section.title}</h2>
        )}

        {/* Success state */}
        {submitResult?.status === "success" ? (
          <div className="rounded-xl border border-emerald-500/20 p-6 bg-emerald-900/10 flex flex-col items-center gap-3">
            <CheckCircle className="size-8 text-emerald-400" />
            <p className="text-sm text-emerald-300 text-center">{submitResult.message}</p>
            <button
              onClick={() => setSubmitResult(null)}
              className="text-xs text-white/40 hover:text-white/70 transition-colors mt-2"
            >
              Enviar otro
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 p-6 bg-white/5 space-y-4">
            {/* Target flow indicator */}
            {targetFlowId && (
              <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                <Play className="size-3" />
                Envía a flujo configurado
              </div>
            )}

            {/* Error banner */}
            {submitResult?.status === "error" && (
              <div className="rounded-lg border border-red-500/20 px-4 py-2.5 bg-red-900/10 flex items-center gap-2">
                <AlertCircle className="size-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-300">{submitResult.message}</p>
                <button onClick={() => setSubmitResult(null)} className="ml-auto text-red-400/50 hover:text-red-300">
                  <X className="size-3" />
                </button>
              </div>
            )}

            {/* Form fields */}
            {effectiveFields.map((field) => {
              const fieldError = errors[field.id];
              return (
                <div key={field.id}>
                  <label className="block text-sm text-white/60 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      rows={3}
                      disabled={!canInteract || submitting}
                      placeholder={field.placeholder ?? field.label}
                      value={values[field.id] ?? ""}
                      onChange={(e) => setValue(field.id, e.target.value)}
                      className={`${inputCls} resize-none ${fieldError ? "!border-red-500/50" : ""}`}
                    />
                  ) : field.type === "select" ? (
                    <select
                      disabled={!canInteract || submitting}
                      value={values[field.id] ?? ""}
                      onChange={(e) => setValue(field.id, e.target.value)}
                      className={`${inputCls} ${fieldError ? "!border-red-500/50" : ""}`}
                    >
                      <option value="">Seleccionar...</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === "checkbox" ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!canInteract || submitting}
                        checked={values[field.id] === "true"}
                        onChange={(e) => setValue(field.id, String(e.target.checked))}
                        className="size-4 rounded border-white/20 bg-white/5 text-[#dd7430] focus:ring-[#dd7430]"
                      />
                      <span className="text-sm text-white/60">{field.placeholder ?? ""}</span>
                    </label>
                  ) : (
                    <input
                      type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      disabled={!canInteract || submitting}
                      placeholder={field.placeholder ?? field.label}
                      value={values[field.id] ?? ""}
                      onChange={(e) => setValue(field.id, e.target.value)}
                      className={`${inputCls} ${fieldError ? "!border-red-500/50" : ""}`}
                    />
                  )}
                  {fieldError && (
                    <p className="text-[11px] text-red-400 mt-0.5">{fieldError}</p>
                  )}
                  {field.variableMapping && (
                    <p className="text-[9px] text-white/20 mt-0.5">→ {field.variableMapping}</p>
                  )}
                </div>
              );
            })}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!canInteract || submitting}
              className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-opacity hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                submitLabel
              )}
            </button>
            {!canInteract && (
              <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
                <Lock className="size-3.5" />
                No tienes permisos para enviar formularios
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// --- Button CTA ---

function ButtonCtaSection({
  section,
  primaryColor,
  canInteract,
  frontId,
  session,
}: {
  section: FrontSection;
  primaryColor: string;
  canInteract: boolean;
  frontId?: string;
  session?: { visitorId?: string; email?: string; name?: string; role?: string } | null;
}) {
  const buttonText = (section.config?.buttonText as string) ?? section.title ?? "Más información";
  const url = (section.config?.url as string) ?? "#";
  const actionConfig = (section.config?._action as ButtonActionConfig) ?? undefined;
  const isFlowMode = actionConfig?.mode === "flow";

  const [showConfirm, setShowConfirm] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ status: "success" | "error"; message: string } | null>(null);

  const executeAction = useCallback(() => {
    if (!isFlowMode || !actionConfig?.targetFlowId) return;
    setShowConfirm(false);
    setExecuting(true);
    setResult(null);

    // Simulate flow trigger
    setTimeout(() => {
      const success = Math.random() > 0.1;

      addButtonAction({
        frontId: frontId ?? "unknown",
        sectionId: section.id,
        targetFlowId: actionConfig.targetFlowId!,
        payload: actionConfig.payload ?? {},
        triggeredBy: {
          visitorId: session?.visitorId,
          email: session?.email,
          name: session?.name,
          role: session?.role,
        },
        status: success ? "success" : "error",
        errorMessage: success ? undefined : "Error simulado al ejecutar el flujo",
      });

      setResult(success
        ? { status: "success", message: "Acción ejecutada correctamente" }
        : { status: "error", message: "Error al ejecutar la acción. Intenta de nuevo." }
      );
      setExecuting(false);
    }, 500);
  }, [isFlowMode, actionConfig, frontId, section.id, session]);

  const handleClick = useCallback(() => {
    if (!isFlowMode) return; // link mode uses <a>
    if (!canInteract) return;

    if (actionConfig?.confirmationMessage) {
      setShowConfirm(true);
    } else {
      executeAction();
    }
  }, [isFlowMode, canInteract, actionConfig, executeAction]);

  // Link mode (original behavior)
  if (!isFlowMode) {
    return (
      <section className="py-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          {section.content && (
            <p className="text-white/60 mb-6">{section.content}</p>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg text-white font-medium text-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            {buttonText}
            <ExternalLink className="size-4" />
          </a>
        </div>
      </section>
    );
  }

  // Flow mode
  return (
    <section className="py-12 px-4">
      <div className="max-w-lg mx-auto text-center">
        {section.content && (
          <p className="text-white/60 mb-6">{section.content}</p>
        )}

        {/* Result feedback */}
        {result && (
          <div className={`mb-4 rounded-lg border px-4 py-2.5 inline-flex items-center gap-2 ${
            result.status === "success"
              ? "border-emerald-500/20 bg-emerald-900/10"
              : "border-red-500/20 bg-red-900/10"
          }`}>
            {result.status === "success" ? (
              <CheckCircle className="size-4 text-emerald-400" />
            ) : (
              <AlertCircle className="size-4 text-red-400" />
            )}
            <span className={`text-xs ${result.status === "success" ? "text-emerald-300" : "text-red-300"}`}>
              {result.message}
            </span>
            <button onClick={() => setResult(null)} className="ml-1 text-white/30 hover:text-white/60">
              <X className="size-3" />
            </button>
          </div>
        )}

        <button
          onClick={handleClick}
          disabled={!canInteract || executing}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg text-white font-medium text-lg transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: primaryColor }}
        >
          {executing ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Ejecutando...
            </>
          ) : (
            <>
              {buttonText}
              <Play className="size-4" />
            </>
          )}
        </button>

        {!canInteract && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-white/30 text-xs">
            <Lock className="size-3.5" />
            No tienes permisos para ejecutar acciones
          </p>
        )}

        {/* Confirmation dialog */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="rounded-xl border border-white/10 bg-slate-900 p-6 max-w-sm mx-4 shadow-2xl">
              <p className="text-sm text-white mb-4">
                {actionConfig?.confirmationMessage ?? "¿Estás seguro de ejecutar esta acción?"}
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={executeAction}
                  className="px-4 py-2 rounded-lg text-sm text-white font-medium transition-opacity hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// --- Stock List ---

type StockSortKey = "name" | "price" | "stock" | "category";
type StockSortDir = "asc" | "desc";

function getProductPriceRange(p: Product): { min: number; max: number } {
  const prices = [p.price];
  if (p.variants?.length) {
    for (const v of p.variants) {
      if (v.price !== undefined) prices.push(v.price);
    }
  }
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function formatVariantSummary(p: Product): string | null {
  if (!p.variants?.length) return null;
  const attrKeys = new Set<string>();
  for (const v of p.variants) {
    for (const k of Object.keys(v.attributes)) attrKeys.add(k);
  }
  const parts: string[] = [];
  for (const key of attrKeys) {
    const vals = [...new Set(p.variants.map((v) => v.attributes[key]).filter(Boolean))];
    if (vals.length > 0) parts.push(`${key}: ${vals.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" · ") : `${p.variants.length} variantes`;
}

function StockListSection({
  section,
  primaryColor,
  canInteract,
}: {
  section: FrontSection;
  primaryColor: string;
  canInteract: boolean;
}) {
  const {
    products: allProducts, discounts, deleteProduct,
    variantTypes, addVariantType, updateVariantType, deleteVariantType, getVariantTypeUsage,
    addDiscount, updateDiscount, deleteDiscount, getDiscountUsage,
  } = useProducts();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [sortKey, setSortKey] = useState<StockSortKey>("name");
  const [sortDir, setSortDir] = useState<StockSortDir>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [showManagePanel, setShowManagePanel] = useState(false);
  const [manageTab, setManageTab] = useState<"variants" | "discounts">("variants");

  // Variant type management state
  const [newVtName, setNewVtName] = useState("");
  const [newVtKey, setNewVtKey] = useState("");
  const [editingVtId, setEditingVtId] = useState<string | null>(null);
  const [editVtName, setEditVtName] = useState("");
  const [editVtKey, setEditVtKey] = useState("");
  const [vtError, setVtError] = useState("");

  // Discount management state
  const [newDiscName, setNewDiscName] = useState("");
  const [newDiscPct, setNewDiscPct] = useState("");
  const [newDiscDesc, setNewDiscDesc] = useState("");
  const [editingDiscId, setEditingDiscId] = useState<string | null>(null);
  const [editDiscName, setEditDiscName] = useState("");
  const [editDiscPct, setEditDiscPct] = useState("");
  const [editDiscDesc, setEditDiscDesc] = useState("");
  const [discError, setDiscError] = useState("");

  // Extract unique categories and brands for filters
  const categories = useMemo(
    () => [...new Set(allProducts.map((p) => p.category).filter(Boolean))].sort(),
    [allProducts]
  );
  const brands = useMemo(
    () => [...new Set(allProducts.map((p) => p.brand).filter(Boolean))].sort(),
    [allProducts]
  );

  // Build discount map
  const discountMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of discounts) m.set(d.id, d.percentage);
    return m;
  }, [discounts]);

  // Filter & sort
  const filtered = useMemo(() => {
    let list = allProducts;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) list = list.filter((p) => p.category === categoryFilter);
    if (brandFilter) list = list.filter((p) => p.brand === brandFilter);

    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "price": cmp = a.price - b.price; break;
        case "stock": cmp = a.stock - b.stock; break;
        case "category": cmp = (a.category ?? "").localeCompare(b.category ?? ""); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [allProducts, search, categoryFilter, brandFilter, sortKey, sortDir]);

  const toggleSort = (key: StockSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const getDiscountedPrice = (price: number, discountIds?: string[]): number | null => {
    if (!discountIds?.length) return null;
    let maxPct = 0;
    for (const id of discountIds) {
      const pct = discountMap.get(id);
      if (pct && pct > maxPct) maxPct = pct;
    }
    return maxPct > 0 ? price * (1 - maxPct / 100) : null;
  };

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteProduct(deleteTarget.id);
    setDeleteTarget(null);
    // If we were editing this product, close editor
    if (editingProduct?.id === deleteTarget.id) setEditingProduct(null);
  }, [deleteTarget, deleteProduct, editingProduct]);

  const SortIcon = ({ field }: { field: StockSortKey }) => {
    if (sortKey !== field) return <ArrowUpDown className="size-3 text-white/20" />;
    return sortDir === "asc" ? <ArrowUp className="size-3 text-white/50" /> : <ArrowDown className="size-3 text-white/50" />;
  };

  // Build a dummy section for the inline edit form
  const editFormSection = useMemo((): FrontSection => ({
    id: "inline-edit",
    type: "stock_form",
    title: "",
    config: { _stockForm: { autoGenerateSku: false, showOptionalFields: true } },
  }), []);

  return (
    <section className="py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{section.title}</h2>
        )}

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU, descripción o marca..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20"
            />
          </div>
          {categories.length > 1 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/20 [&>option]:bg-slate-800"
            >
              <option value="">Categoría</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {brands.length > 1 && (
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/20 [&>option]:bg-slate-800"
            >
              <option value="">Marca</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
        </div>

        {/* Sort bar */}
        <div className="flex items-center gap-1 mb-3 text-[11px] text-white/40">
          <span>Ordenar:</span>
          {(["name", "price", "stock", "category"] as StockSortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => toggleSort(k)}
              className={`flex items-center gap-0.5 px-2 py-1 rounded hover:bg-white/5 transition-colors ${sortKey === k ? "text-white/70 bg-white/5" : ""}`}
            >
              {{ name: "Nombre", price: "Precio", stock: "Stock", category: "Categoría" }[k]}
              <SortIcon field={k} />
            </button>
          ))}
          <span className="ml-auto text-white/30">{filtered.length} producto{filtered.length !== 1 ? "s" : ""}</span>
          {canInteract && (
            <button
              onClick={() => setShowManagePanel((p) => !p)}
              className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-colors ml-2 ${showManagePanel ? "text-white/70 bg-white/5" : "text-white/30"}`}
            >
              <Settings className="size-3" /> Gestionar
            </button>
          )}
        </div>

        {/* Product cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((p) => {
            const priceRange = getProductPriceRange(p);
            const hasRange = priceRange.min !== priceRange.max;
            const discounted = getDiscountedPrice(p.price, p.discountIds);
            const variantSummary = formatVariantSummary(p);
            const isExpanded = expandedId === p.id;

            return (
              <div
                key={p.id}
                className={`rounded-xl border ${editingProduct?.id === p.id ? "border-white/30 ring-1 ring-white/10" : "border-white/10"} bg-white/5 hover:border-white/20 transition-colors overflow-hidden`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-white/5 shrink-0">
                      <Package className="size-5 text-white/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.name}</p>
                      <p className="text-xs text-white/40 font-mono">{p.sku}</p>
                      {p.brand && (
                        <p className="text-xs text-white/30 mt-0.5">{p.brand}{p.model ? ` · ${p.model}` : ""}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {hasRange ? (
                        <p className="text-sm font-semibold text-white">
                          ${priceRange.min.toLocaleString()} – ${priceRange.max.toLocaleString()}
                        </p>
                      ) : discounted ? (
                        <div>
                          <p className="text-xs text-white/40 line-through">${p.price.toLocaleString()}</p>
                          <p className="text-sm font-semibold" style={{ color: primaryColor }}>
                            ${Math.round(discounted).toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm font-semibold text-white">${p.price.toLocaleString()}</p>
                      )}
                      <p className={`text-xs font-medium ${p.stock < 10 ? "text-red-400" : p.stock < 25 ? "text-amber-400" : "text-emerald-400"}`}>
                        Stock: {p.stock} {p.unit}
                      </p>
                    </div>
                  </div>

                  {/* Description preview */}
                  {p.description && (
                    <p className="text-xs text-white/30 mt-2 line-clamp-2">{p.description}</p>
                  )}

                  {/* Tags: category + variants */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {p.category && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/5">
                        <Tag className="size-2.5" />{p.category}
                      </span>
                    )}
                    {variantSummary && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 transition-colors"
                      >
                        <Layers className="size-2.5" />
                        {p.variants!.length} variante{p.variants!.length !== 1 ? "s" : ""}
                        <ChevronDown className={`size-2.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded variant details */}
                {isExpanded && p.variants && p.variants.length > 0 && (
                  <div className="border-t border-white/5 bg-white/[0.02] px-4 py-3">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Variantes</p>
                    <div className="space-y-1.5">
                      {p.variants.map((v) => (
                        <div key={v.id} className="flex items-center justify-between text-xs">
                          <span className="text-white/50">
                            {Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(", ")}
                            {v.sku && <span className="text-white/20 ml-2 font-mono">({v.sku})</span>}
                          </span>
                          {v.price !== undefined && (
                            <span className="text-white/60 font-medium">${v.price.toLocaleString()}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Operador action bar */}
                {canInteract && (
                  <div className="border-t border-white/5 px-4 py-2 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingProduct(editingProduct?.id === p.id ? null : p)}
                      className={`text-[11px] transition-colors flex items-center gap-1 ${editingProduct?.id === p.id ? "text-white/70" : "text-white/30 hover:text-white/60"}`}
                    >
                      <Pencil className="size-3" /> Editar
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="text-[11px] text-white/30 hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="size-3" /> Eliminar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-10">
              <Package className="size-8 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/30">
                {allProducts.length === 0 ? "No hay productos en el catálogo." : "No se encontraron productos con esos filtros."}
              </p>
            </div>
          )}
        </div>

        {/* Inline edit form */}
        {editingProduct && canInteract && (
          <div className="mt-6">
            <StockFormSection
              section={editFormSection}
              primaryColor={primaryColor}
              canInteract={canInteract}
              editingProduct={editingProduct}
              onCancel={() => setEditingProduct(null)}
              onSaved={() => setEditingProduct(null)}
            />
          </div>
        )}

        {/* Manage variant types & discounts panel */}
        {showManagePanel && canInteract && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-white/5">
              {(["variants", "discounts"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setManageTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors ${manageTab === tab ? "text-white bg-white/5" : "text-white/30 hover:text-white/50"}`}
                >
                  {tab === "variants" ? "Tipos de variante" : "Descuentos"}
                </button>
              ))}
              <button onClick={() => setShowManagePanel(false)} className="px-3 text-white/20 hover:text-white/50">
                <X className="size-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {manageTab === "variants" ? (
                <>
                  {/* Existing variant types */}
                  {variantTypes.length > 0 && (
                    <div className="space-y-2">
                      {variantTypes.map((vt) => {
                        const usage = getVariantTypeUsage(vt.id);
                        const isEdit = editingVtId === vt.id;
                        return (
                          <div key={vt.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                            {isEdit ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input type="text" value={editVtName} onChange={(e) => { setEditVtName(e.target.value); setEditVtKey(nameToKey(e.target.value)); }} placeholder="Nombre" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-24 focus:outline-none" />
                                <span className="text-[10px] text-white/20 font-mono">{editVtKey}</span>
                                <button onClick={() => {
                                  if (!editVtName.trim()) return;
                                  const k = editVtKey || nameToKey(editVtName);
                                  const dupKey = variantTypes.find((v) => v.key === k && v.id !== vt.id);
                                  if (dupKey) { setVtError("Clave duplicada"); return; }
                                  updateVariantType(vt.id, { name: editVtName.trim(), key: k });
                                  setEditingVtId(null);
                                  setVtError("");
                                }} className="text-emerald-400 hover:text-emerald-300 p-1"><CheckCircle className="size-3" /></button>
                                <button onClick={() => { setEditingVtId(null); setVtError(""); }} className="text-white/20 hover:text-white/50 p-1"><X className="size-3" /></button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-white/70">{vt.name}</span>
                                  <span className="text-[10px] text-white/20 font-mono">{vt.key}</span>
                                  {usage.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">{usage.length} prod.</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => { setEditingVtId(vt.id); setEditVtName(vt.name); setEditVtKey(vt.key); }} className="text-white/20 hover:text-white/50 p-1"><Pencil className="size-3" /></button>
                                  <button
                                    onClick={() => {
                                      if (usage.length > 0) { setVtError(`"${vt.name}" está en uso por ${usage.length} producto(s).`); return; }
                                      deleteVariantType(vt.id);
                                      setVtError("");
                                    }}
                                    className="text-white/20 hover:text-red-400 p-1"
                                  ><Trash2 className="size-3" /></button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {vtError && <p className="text-xs text-red-400">{vtError}</p>}

                  {/* Add new variant type */}
                  <div className="flex items-center gap-2">
                    <input type="text" value={newVtName} onChange={(e) => { setNewVtName(e.target.value); setNewVtKey(nameToKey(e.target.value)); }} placeholder="Nombre (ej: Color)" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20" />
                    <span className="text-[10px] text-white/20 font-mono min-w-[60px]">{newVtKey || "clave"}</span>
                    <button
                      onClick={() => {
                        if (!newVtName.trim()) return;
                        const k = newVtKey || nameToKey(newVtName);
                        const dupKey = variantTypes.find((v) => v.key === k);
                        if (dupKey) { setVtError("Clave duplicada"); return; }
                        addVariantType({ name: newVtName.trim(), key: k });
                        setNewVtName("");
                        setNewVtKey("");
                        setVtError("");
                      }}
                      className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    >
                      <Plus className="size-3" /> Agregar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Existing discounts */}
                  {discounts.length > 0 && (
                    <div className="space-y-2">
                      {discounts.map((d) => {
                        const usage = getDiscountUsage(d.id);
                        const isEdit = editingDiscId === d.id;
                        return (
                          <div key={d.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                            {isEdit ? (
                              <div className="flex items-center gap-2 flex-1 flex-wrap">
                                <input type="text" value={editDiscName} onChange={(e) => setEditDiscName(e.target.value)} placeholder="Nombre" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-28 focus:outline-none" />
                                <input type="number" value={editDiscPct} onChange={(e) => setEditDiscPct(e.target.value)} placeholder="%" min="0" max="100" step="0.01" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white w-16 focus:outline-none" />
                                <input type="text" value={editDiscDesc} onChange={(e) => setEditDiscDesc(e.target.value)} placeholder="Descripción" className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white flex-1 min-w-[80px] focus:outline-none" />
                                <button onClick={() => {
                                  if (!editDiscName.trim() || !editDiscPct) return;
                                  const pct = Number(editDiscPct);
                                  if (isNaN(pct) || pct < 0 || pct > 100) { setDiscError("Porcentaje 0-100"); return; }
                                  updateDiscount(d.id, { name: editDiscName.trim(), percentage: pct, description: editDiscDesc.trim() });
                                  setEditingDiscId(null);
                                  setDiscError("");
                                }} className="text-emerald-400 hover:text-emerald-300 p-1"><CheckCircle className="size-3" /></button>
                                <button onClick={() => { setEditingDiscId(null); setDiscError(""); }} className="text-white/20 hover:text-white/50 p-1"><X className="size-3" /></button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-white/70">{d.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{d.percentage}%</span>
                                  {d.description && <span className="text-[10px] text-white/20">{d.description}</span>}
                                  {usage.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">{usage.length} prod.</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => { setEditingDiscId(d.id); setEditDiscName(d.name); setEditDiscPct(String(d.percentage)); setEditDiscDesc(d.description); }} className="text-white/20 hover:text-white/50 p-1"><Pencil className="size-3" /></button>
                                  <button onClick={() => { deleteDiscount(d.id); setDiscError(""); }} className="text-white/20 hover:text-red-400 p-1"><Trash2 className="size-3" /></button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {discError && <p className="text-xs text-red-400">{discError}</p>}

                  {/* Add new discount */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="text" value={newDiscName} onChange={(e) => setNewDiscName(e.target.value)} placeholder="Nombre" className="flex-1 min-w-[100px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20" />
                    <input type="number" value={newDiscPct} onChange={(e) => setNewDiscPct(e.target.value)} placeholder="%" min="0" max="100" step="0.01" className="w-16 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20" />
                    <input type="text" value={newDiscDesc} onChange={(e) => setNewDiscDesc(e.target.value)} placeholder="Descripción (opcional)" className="flex-1 min-w-[100px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20" />
                    <button
                      onClick={() => {
                        if (!newDiscName.trim() || !newDiscPct) return;
                        const pct = Number(newDiscPct);
                        if (isNaN(pct) || pct < 0 || pct > 100) { setDiscError("Porcentaje debe ser 0-100"); return; }
                        addDiscount({ name: newDiscName.trim(), percentage: pct, description: newDiscDesc.trim() });
                        setNewDiscName("");
                        setNewDiscPct("");
                        setNewDiscDesc("");
                        setDiscError("");
                      }}
                      className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                    >
                      <Plus className="size-3" /> Agregar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Delete confirmation dialog */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-red-500/10">
                  <AlertTriangle className="size-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Eliminar producto</h3>
                  <p className="text-xs text-white/40">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/5 px-4 py-3 mb-4">
                <p className="text-sm text-white font-medium">{deleteTarget.name}</p>
                <p className="text-xs text-white/40 font-mono">{deleteTarget.sku}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 rounded-lg text-white/60 font-medium text-sm border border-white/10 hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 py-2.5 rounded-lg text-white font-medium text-sm bg-red-600 hover:bg-red-500 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// --- Stock Form ---

interface StockFormErrors {
  name?: string;
  sku?: string;
  price?: string;
  stock?: string;
  variant?: string;
}

interface VariantFormItem {
  id: string;
  attributes: Record<string, string>;
  sku: string;
  price: string;
}

function StockFormSection({
  section,
  primaryColor,
  canInteract,
  editingProduct,
  onCancel,
  onSaved,
}: {
  section: FrontSection;
  primaryColor: string;
  canInteract: boolean;
  editingProduct?: Product | null;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const { products, addProduct, updateProduct, variantTypes, discounts: allDiscounts } = useProducts();
  const cfg = (section.config?._stockForm as StockFormConfig) ?? { autoGenerateSku: true, showOptionalFields: false };
  const isEditing = !!editingProduct;
  const successMessage = isEditing
    ? "Producto actualizado correctamente."
    : (cfg.successMessage ?? "Producto creado correctamente.");

  const existingSkus = useMemo(() => products.map((p) => p.sku), [products]);

  // Base fields
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [unit, setUnit] = useState("unidad");

  // Variant & discount fields
  const [selectedVtIds, setSelectedVtIds] = useState<string[]>([]);
  const [formVariants, setFormVariants] = useState<VariantFormItem[]>([]);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([]);
  const [newVariantAttrs, setNewVariantAttrs] = useState<Record<string, string>>({});
  const [newVariantSku, setNewVariantSku] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState("");
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

  const [errors, setErrors] = useState<StockFormErrors>({});
  const [submitResult, setSubmitResult] = useState<{ status: "success" | "error"; message: string } | null>(null);

  // Selected variant type objects
  const selectedVts = useMemo(
    () => variantTypes.filter((vt) => selectedVtIds.includes(vt.id)),
    [variantTypes, selectedVtIds]
  );

  // Pre-fill form when editing
  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setSku(editingProduct.sku);
      setPrice(editingProduct.price > 0 ? String(editingProduct.price) : "");
      setStock(editingProduct.stock > 0 ? String(editingProduct.stock) : "");
      setCategory(editingProduct.category);
      setDescription(editingProduct.description);
      setBrand(editingProduct.brand);
      setModel(editingProduct.model);
      setUnit(editingProduct.unit || "unidad");
      setSelectedVtIds(editingProduct.variantTypeIds ?? []);
      setFormVariants(
        (editingProduct.variants ?? []).map((v) => ({
          id: v.id,
          attributes: { ...v.attributes },
          sku: v.sku ?? "",
          price: v.price !== undefined ? String(v.price) : "",
        }))
      );
      setSelectedDiscountIds(editingProduct.discountIds ?? []);
      setErrors({});
      setSubmitResult(null);
    } else {
      setName("");
      setSku(cfg.autoGenerateSku ? generateUniqueCode(existingSkus) : "");
      setPrice("");
      setStock("");
      setCategory("");
      setDescription("");
      setBrand("");
      setModel("");
      setUnit("unidad");
      setSelectedVtIds([]);
      setFormVariants([]);
      setSelectedDiscountIds([]);
      setErrors({});
      setSubmitResult(null);
    }
    setNewVariantAttrs({});
    setNewVariantSku("");
    setNewVariantPrice("");
    setEditingVariantId(null);
  }, [editingProduct, cfg.autoGenerateSku, existingSkus]);

  const regenerateSku = useCallback(() => {
    setSku(generateUniqueCode(existingSkus));
    setErrors((prev) => { const n = { ...prev }; delete n.sku; return n; });
  }, [existingSkus]);

  const toggleVariantType = useCallback((vtId: string) => {
    setSelectedVtIds((prev) => {
      if (prev.includes(vtId)) {
        const vt = variantTypes.find((v) => v.id === vtId);
        if (vt) {
          // Remove attributes from existing variants
          setFormVariants((fv) =>
            fv.map((v) => {
              const attrs = { ...v.attributes };
              delete attrs[vt.key];
              return { ...v, attributes: attrs };
            })
          );
        }
        return prev.filter((id) => id !== vtId);
      }
      return [...prev, vtId];
    });
  }, [variantTypes]);

  const toggleDiscount = useCallback((discountId: string) => {
    setSelectedDiscountIds((prev) =>
      prev.includes(discountId) ? prev.filter((id) => id !== discountId) : [...prev, discountId]
    );
  }, []);

  const handleAddVariant = useCallback(() => {
    // Validate all selected type attrs are filled
    for (const vt of selectedVts) {
      if (!newVariantAttrs[vt.key]?.trim()) {
        setErrors((p) => ({ ...p, variant: `Completa el valor de "${vt.name}"` }));
        return;
      }
    }
    // Duplicate check
    const sig = attrSignature(newVariantAttrs);
    const dup = formVariants.find((v) => v.id !== editingVariantId && attrSignature(v.attributes) === sig);
    if (dup) {
      setErrors((p) => ({ ...p, variant: "Ya existe una variante con esa combinación." }));
      return;
    }

    if (editingVariantId) {
      // Update existing
      setFormVariants((prev) =>
        prev.map((v) =>
          v.id === editingVariantId
            ? { ...v, attributes: { ...newVariantAttrs }, sku: newVariantSku, price: newVariantPrice }
            : v
        )
      );
      setEditingVariantId(null);
    } else {
      // Add new
      setFormVariants((prev) => [
        ...prev,
        {
          id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          attributes: { ...newVariantAttrs },
          sku: newVariantSku,
          price: newVariantPrice,
        },
      ]);
    }
    setNewVariantAttrs({});
    setNewVariantSku("");
    setNewVariantPrice("");
    setErrors((p) => { const n = { ...p }; delete n.variant; return n; });
  }, [selectedVts, newVariantAttrs, newVariantSku, newVariantPrice, formVariants, editingVariantId]);

  const startEditVariant = useCallback((v: VariantFormItem) => {
    setEditingVariantId(v.id);
    setNewVariantAttrs({ ...v.attributes });
    setNewVariantSku(v.sku);
    setNewVariantPrice(v.price);
  }, []);

  const deleteVariant = useCallback((id: string) => {
    setFormVariants((prev) => prev.filter((v) => v.id !== id));
    if (editingVariantId === id) {
      setEditingVariantId(null);
      setNewVariantAttrs({});
      setNewVariantSku("");
      setNewVariantPrice("");
    }
  }, [editingVariantId]);

  // Discount price preview
  const discountPreview = useMemo(() => {
    const basePrice = price ? Number(price) : 0;
    if (!basePrice || selectedDiscountIds.length === 0) return null;
    let totalPct = 0;
    for (const id of selectedDiscountIds) {
      const d = allDiscounts.find((dd) => dd.id === id);
      if (d) totalPct += d.percentage;
    }
    totalPct = Math.min(totalPct, 100);
    return { final: basePrice * (1 - totalPct / 100), pct: totalPct };
  }, [price, selectedDiscountIds, allDiscounts]);

  const validate = useCallback((): boolean => {
    const next: StockFormErrors = {};
    if (!name.trim()) next.name = "El nombre es obligatorio.";
    const trimmedSku = sku.trim();
    if (!trimmedSku) {
      next.sku = "El código es obligatorio.";
    } else {
      const dup = products.find(
        (p) => p.sku.toLowerCase() === trimmedSku.toLowerCase() && p.id !== editingProduct?.id
      );
      if (dup) next.sku = `El código "${trimmedSku}" ya está en uso.`;
    }
    if (price && (isNaN(Number(price)) || Number(price) < 0)) {
      next.price = "El precio debe ser ≥ 0.";
    }
    if (stock && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) {
      next.stock = "El stock debe ser un entero ≥ 0.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [name, sku, price, stock, products, editingProduct?.id]);

  const resetForm = useCallback(() => {
    setName("");
    setSku(cfg.autoGenerateSku ? generateUniqueCode(existingSkus) : "");
    setPrice("");
    setStock("");
    setCategory("");
    setDescription("");
    setBrand("");
    setModel("");
    setUnit("unidad");
    setSelectedVtIds([]);
    setFormVariants([]);
    setSelectedDiscountIds([]);
    setNewVariantAttrs({});
    setNewVariantSku("");
    setNewVariantPrice("");
    setErrors({});
  }, [cfg.autoGenerateSku, existingSkus]);

  const handleSubmit = useCallback(() => {
    if (!canInteract) return;
    if (!validate()) return;

    const now = new Date().toISOString();
    const builtVariants: ProductVariant[] = formVariants.map((v) => ({
      id: v.id,
      attributes: v.attributes,
      sku: v.sku || undefined,
      price: v.price ? Number(v.price) : undefined,
      createdAt: editingProduct?.variants?.find((ev) => ev.id === v.id)?.createdAt ?? now,
    }));

    const data = {
      name: name.trim(),
      sku: sku.trim(),
      description: description.trim(),
      brand: brand.trim(),
      model: model.trim(),
      price: price ? Number(price) : 0,
      stock: stock ? Math.round(Number(stock)) : 0,
      unit: unit.trim() || "unidad",
      category: category.trim(),
      variantTypeIds: selectedVtIds.length > 0 ? selectedVtIds : undefined,
      variants: builtVariants.length > 0 ? builtVariants : undefined,
      discountIds: selectedDiscountIds.length > 0 ? selectedDiscountIds : undefined,
    };

    if (isEditing) {
      updateProduct(editingProduct!.id, data);
    } else {
      addProduct(data);
    }

    setSubmitResult({ status: "success", message: successMessage });

    if (isEditing) {
      setTimeout(() => { onSaved?.(); }, 1200);
    } else {
      resetForm();
    }

    setTimeout(() => setSubmitResult(null), 4000);
  }, [canInteract, validate, isEditing, addProduct, updateProduct, editingProduct, name, sku, description, brand, model, price, stock, unit, category, selectedVtIds, formVariants, selectedDiscountIds, successMessage, resetForm, onSaved]);

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 disabled:opacity-40";
  const errorInputCls = "w-full bg-white/5 border border-red-500/50 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-red-400 disabled:opacity-40";

  const showOptional = cfg.showOptionalFields || isEditing;

  const formContent = (
    <>
      {submitResult?.status === "success" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <CheckCircle className="size-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">{submitResult.message}</p>
        </div>
      )}

      <div className={`rounded-xl border ${isEditing ? "border-white/20" : "border-white/10"} p-6 bg-white/5 space-y-4`}>
        {isEditing && (
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <p className="text-sm font-medium text-white/70">Editando: {editingProduct!.name}</p>
            <button onClick={onCancel} className="text-white/30 hover:text-white/60 transition-colors">
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Nombre */}
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Nombre <span className="text-red-400">*</span></label>
          <input type="text" value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => { const n = { ...p }; delete n.name; return n; }); }} disabled={!canInteract} placeholder="Nombre del producto" className={errors.name ? errorInputCls : inputCls} />
          {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
        </div>

        {/* SKU */}
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Código (SKU) <span className="text-red-400">*</span></label>
          <div className="flex gap-2">
            <input type="text" value={sku} onChange={(e) => { setSku(e.target.value); setErrors((p) => { const n = { ...p }; delete n.sku; return n; }); }} disabled={!canInteract} placeholder="Código único" className={`flex-1 ${errors.sku ? errorInputCls : inputCls}`} />
            {!isEditing && cfg.autoGenerateSku && canInteract && (
              <button type="button" onClick={regenerateSku} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors shrink-0">
                <RefreshCw className="size-3" /> Regenerar
              </button>
            )}
          </div>
          {!isEditing && cfg.autoGenerateSku && !errors.sku && <p className="text-[10px] text-white/20 mt-1">Autogenerado — puedes editarlo</p>}
          {errors.sku && <p className="text-xs text-red-400 mt-1">{errors.sku}</p>}
        </div>

        {/* Precio */}
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Precio base</label>
          <input type="number" value={price} onChange={(e) => { setPrice(e.target.value); setErrors((p) => { const n = { ...p }; delete n.price; return n; }); }} disabled={!canInteract} placeholder="0.00" min="0" step="0.01" className={errors.price ? errorInputCls : inputCls} />
          {errors.price && <p className="text-xs text-red-400 mt-1">{errors.price}</p>}
          {discountPreview && (
            <p className="text-[11px] mt-1" style={{ color: primaryColor }}>
              Precio estimado: ${Math.round(discountPreview.final).toLocaleString()} (−{discountPreview.pct}% sobre ${Number(price).toLocaleString()})
            </p>
          )}
        </div>

        {/* Stock */}
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Stock</label>
          <input type="number" value={stock} onChange={(e) => { setStock(e.target.value); setErrors((p) => { const n = { ...p }; delete n.stock; return n; }); }} disabled={!canInteract} placeholder="0" min="0" step="1" className={errors.stock ? errorInputCls : inputCls} />
          {errors.stock && <p className="text-xs text-red-400 mt-1">{errors.stock}</p>}
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Categoría</label>
          <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} disabled={!canInteract} placeholder="Ej: Electrónica" className={inputCls} />
        </div>

        {/* Optional fields */}
        {showOptional && (
          <>
            <div className="border-t border-white/5 pt-4">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Campos adicionales</p>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Descripción</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canInteract} placeholder="Descripción del producto" rows={3} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Marca</label>
                <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} disabled={!canInteract} placeholder="Marca" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Modelo</label>
                <input type="text" value={model} onChange={(e) => setModel(e.target.value)} disabled={!canInteract} placeholder="Modelo" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Unidad</label>
              <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!canInteract} placeholder="unidad, kg, lt..." className={inputCls} />
            </div>
          </>
        )}

        {/* --- Variant Types --- */}
        {variantTypes.length > 0 && canInteract && (
          <>
            <div className="border-t border-white/5 pt-4">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Tipos de variante</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {variantTypes.map((vt) => {
                const sel = selectedVtIds.includes(vt.id);
                return (
                  <button
                    key={vt.id}
                    onClick={() => toggleVariantType(vt.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${sel ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/40 hover:text-white/60"}`}
                  >
                    {vt.name} <span className="text-white/20 ml-1">({vt.key})</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* --- Variants list & add form --- */}
        {selectedVts.length > 0 && canInteract && (
          <>
            <div className="border-t border-white/5 pt-4">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-3">
                Variantes ({formVariants.length})
              </p>
            </div>

            {/* Existing variants */}
            {formVariants.length > 0 && (
              <div className="space-y-2">
                {formVariants.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {Object.entries(v.attributes).map(([k, val]) => (
                        <span key={k} className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                          {k}: {val}
                        </span>
                      ))}
                      {v.sku && <span className="text-white/20 font-mono">({v.sku})</span>}
                      {v.price && <span className="text-white/50">${Number(v.price).toLocaleString()}</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEditVariant(v)} className="text-white/20 hover:text-white/50 p-1">
                        <Pencil className="size-3" />
                      </button>
                      <button onClick={() => deleteVariant(v.id)} className="text-white/20 hover:text-red-400 p-1">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add/Edit variant form */}
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
              <p className="text-[10px] text-white/30 uppercase">
                {editingVariantId ? "Editar variante" : "Nueva variante"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {selectedVts.map((vt) => (
                  <input
                    key={vt.key}
                    type="text"
                    value={newVariantAttrs[vt.key] ?? ""}
                    onChange={(e) => setNewVariantAttrs((p) => ({ ...p, [vt.key]: e.target.value }))}
                    placeholder={vt.name}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-white/20"
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newVariantSku}
                  onChange={(e) => setNewVariantSku(e.target.value)}
                  placeholder="SKU variante (opcional)"
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-white/20 focus:outline-none focus:border-white/20"
                />
                <input
                  type="number"
                  value={newVariantPrice}
                  onChange={(e) => setNewVariantPrice(e.target.value)}
                  placeholder="Precio (opcional)"
                  min="0"
                  step="0.01"
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-white/20"
                />
              </div>
              {errors.variant && <p className="text-xs text-red-400">{errors.variant}</p>}
              <div className="flex gap-2">
                {editingVariantId && (
                  <button
                    onClick={() => { setEditingVariantId(null); setNewVariantAttrs({}); setNewVariantSku(""); setNewVariantPrice(""); }}
                    className="text-xs text-white/30 hover:text-white/60 px-3 py-1.5 rounded-lg border border-white/10"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={handleAddVariant}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Plus className="size-3" /> {editingVariantId ? "Guardar" : "Agregar variante"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* --- Discounts --- */}
        {allDiscounts.length > 0 && canInteract && (
          <>
            <div className="border-t border-white/5 pt-4">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Descuentos</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {allDiscounts.map((d) => {
                const sel = selectedDiscountIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => toggleDiscount(d.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${sel ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/40 hover:text-white/60"}`}
                  >
                    <Percent className="size-3 inline mr-1" />
                    {d.name} ({d.percentage}%)
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className={`flex gap-2 ${isEditing ? "" : "flex-col"}`}>
          {isEditing && (
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-white/60 font-medium text-sm border border-white/10 hover:bg-white/5 transition-colors">
              Cancelar
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canInteract}
            className={`${isEditing ? "flex-1" : "w-full"} py-2.5 rounded-lg text-white font-medium text-sm transition-opacity hover:opacity-90 disabled:opacity-40`}
            style={{ backgroundColor: primaryColor }}
          >
            {isEditing ? "Actualizar producto" : "Guardar producto"}
          </button>
        </div>

        {!canInteract && (
          <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
            <Lock className="size-3.5" />
            No tienes permisos para gestionar stock
          </div>
        )}
      </div>
    </>
  );

  if (isEditing) return <div className="max-w-lg mx-auto">{formContent}</div>;

  return (
    <section className="py-12 px-4">
      <div className="max-w-lg mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{section.title}</h2>
        )}
        {formContent}
      </div>
    </section>
  );
}

// ─── Calendar Booking Section ────────────────────────────────────────────────

const DAY_INDEX_TO_KEY: DayOfWeek[] = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

function CalendarBookingSection({ section, primaryColor, canInteract, frontId, session }: {
  section: FrontSection;
  primaryColor: string;
  canInteract: boolean;
  frontId?: string;
  session?: { visitorId?: string; email?: string; name?: string; role?: string } | null;
}) {
  const cfg = (section.config ?? {}) as CalendarBookingConfig;
  const { calendars, resources, getAvailableSlots, getBookingsByCalendar, addBooking, validateBooking, blockedPeriods, getBlocksByCalendar } = useCalendars();

  // Filter active calendars (optionally pre-filtered by config)
  const availableCalendars = useMemo(() => {
    const active = calendars.filter((c) => c.active);
    if (cfg.calendarId) return active.filter((c) => c.id === cfg.calendarId);
    return active;
  }, [calendars, cfg.calendarId]);

  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState("");

  // Contact form
  const [contactName, setContactName] = useState(session?.name ?? "");
  const [contactEmail, setContactEmail] = useState(session?.email ?? "");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  // States
  const [step, setStep] = useState<"calendar" | "date" | "slot" | "form" | "success">("calendar");
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmationCode, setConfirmationCode] = useState("");

  // Auto-select calendar if only one
  useEffect(() => {
    if (availableCalendars.length === 1 && !selectedCalendarId) {
      setSelectedCalendarId(availableCalendars[0].id);
      setStep("date");
    }
  }, [availableCalendars, selectedCalendarId]);

  const selectedCalendar = calendars.find((c) => c.id === selectedCalendarId);
  const calendarResources = useMemo(
    () => resources.filter((r) => r.calendarId === selectedCalendarId && r.active),
    [resources, selectedCalendarId],
  );
  const isHourly = selectedCalendar?.bookingMode === "hourly";

  // Auto-select resource if only one
  useEffect(() => {
    if (calendarResources.length === 1 && !selectedResourceId) {
      setSelectedResourceId(calendarResources[0].id);
    }
  }, [calendarResources, selectedResourceId]);

  // Build month grid
  const monthGrid = useMemo(() => {
    if (!selectedCalendar) return [];
    const [year, month] = currentMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDow = (firstDay.getDay() + 6) % 7; // Monday-based

    const cells: { date: string; day: number; inMonth: boolean; status: "available" | "blocked" | "closed" | "past" }[] = [];

    // Padding before
    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month - 1, -startDow + i + 1);
      cells.push({ date: d.toISOString().split("T")[0], day: d.getDate(), inMonth: false, status: "closed" });
    }

    const today = new Date().toISOString().split("T")[0];
    const calBlocks = getBlocksByCalendar(selectedCalendarId);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = dateObj.toISOString().split("T")[0];
      const dayKey = DAY_INDEX_TO_KEY[dateObj.getDay()];
      const schedule = selectedCalendar.schedule[dayKey];

      let status: "available" | "blocked" | "closed" | "past" = "available";
      if (dateStr < today) {
        status = "past";
      } else if (!schedule?.enabled) {
        status = "closed";
      } else {
        // Check if fully blocked
        const blocked = calBlocks.some((b) => {
          if (b.resourceId && selectedResourceId && b.resourceId !== selectedResourceId) return false;
          const sd = b.startDate;
          const ed = b.endDate;
          return dateStr >= sd && dateStr <= ed && !b.startTime; // full-day block
        });
        if (blocked) status = "blocked";
      }

      cells.push({ date: dateStr, day: d, inMonth: true, status });
    }

    // Padding after
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month, i);
        cells.push({ date: d.toISOString().split("T")[0], day: d.getDate(), inMonth: false, status: "closed" });
      }
    }

    return cells;
  }, [selectedCalendar, currentMonth, selectedCalendarId, selectedResourceId, getBlocksByCalendar]);

  // Available slots for selected date
  const slotsForDate = useMemo(() => {
    if (!selectedDate || !selectedCalendarId || !isHourly) return [];
    return getAvailableSlots(selectedCalendarId, selectedDate);
  }, [selectedDate, selectedCalendarId, isHourly, getAvailableSlots]);

  // Filter slots by selected resource
  const filteredSlots = useMemo(() => {
    if (!selectedResourceId) return slotsForDate;
    return slotsForDate.filter((s) => s.resourceId === selectedResourceId);
  }, [slotsForDate, selectedResourceId]);

  const handleSelectCalendar = (id: string) => {
    setSelectedCalendarId(id);
    setSelectedResourceId("");
    setSelectedDate("");
    setSelectedSlot(null);
    setSelectedEndDate("");
    setStep("date");
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSelectedEndDate(date); // default same day for daily
    if (isHourly) {
      setStep("slot");
    } else {
      // Daily mode → go to form (can select end date)
      setStep("form");
    }
  };

  const handleSelectSlot = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    if (cfg.showResourceSelector === false || calendarResources.length <= 1) {
      setSelectedResourceId(slot.resourceId);
    } else {
      setSelectedResourceId(slot.resourceId);
    }
    setStep("form");
  };

  const handleSubmitBooking = () => {
    const errs: string[] = [];
    if (!contactName.trim()) errs.push("El nombre es obligatorio");
    if (!selectedCalendarId) errs.push("Seleccioná un calendario");

    const resId = selectedResourceId || calendarResources[0]?.id;
    if (!resId) errs.push("No hay recursos disponibles");

    if (isHourly && !selectedSlot) errs.push("Seleccioná un horario");
    if (!isHourly && !selectedDate) errs.push("Seleccioná una fecha");

    if (errs.length > 0) { setErrors(errs); return; }

    // Validate
    const startTime = selectedSlot?.startTime;
    const endTime = selectedSlot?.endTime;
    const endDate = isHourly ? selectedDate : (selectedEndDate || selectedDate);

    const validation = validateBooking(selectedCalendarId, resId, selectedDate, endDate, startTime, endTime);
    if (!validation.valid) {
      setErrors([validation.error ?? "Sin disponibilidad para la fecha seleccionada"]);
      return;
    }

    const booking = addBooking({
      calendarId: selectedCalendarId,
      resourceId: resId,
      startDate: selectedDate,
      endDate,
      startTime,
      endTime,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      notes: (cfg.allowNotes !== false && notes.trim()) ? notes.trim() : undefined,
      status: "confirmed",
      source: "front",
    });

    setConfirmationCode(booking.confirmationCode);
    setStep("success");
    setErrors([]);
  };

  const handleBack = () => {
    setErrors([]);
    if (step === "form" && isHourly) setStep("slot");
    else if (step === "form") setStep("date");
    else if (step === "slot") setStep("date");
    else if (step === "date" && availableCalendars.length > 1) setStep("calendar");
  };

  const handleRestart = () => {
    setSelectedDate("");
    setSelectedSlot(null);
    setSelectedEndDate("");
    setContactName(session?.name ?? "");
    setContactEmail(session?.email ?? "");
    setContactPhone("");
    setNotes("");
    setConfirmationCode("");
    setErrors([]);
    setStep(availableCalendars.length > 1 ? "calendar" : "date");
  };

  const prevMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthLabel = (() => {
    const [y, m] = currentMonth.split("-").map(Number);
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    return `${months[m - 1]} ${y}`;
  })();

  const cellColor = (status: string) => {
    switch (status) {
      case "available": return "bg-emerald-900/30 hover:bg-emerald-800/40 text-white cursor-pointer border-emerald-800/30";
      case "blocked": return "bg-red-900/20 text-red-400/60 border-red-800/20";
      case "closed": return "bg-slate-800/30 text-slate-600 border-slate-700/20";
      case "past": return "bg-slate-800/20 text-slate-600 border-slate-700/10";
      default: return "bg-slate-800/30 text-slate-500 border-slate-700/20";
    }
  };

  const inputCls = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:ring-1 text-sm";

  if (availableCalendars.length === 0) {
    return (
      <section className="py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          {section.title && <h2 className="text-2xl font-bold text-white mb-4">{section.title}</h2>}
          <p className="text-white/50 text-sm">No hay calendarios disponibles en este momento.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {section.title && (
          <h2 className="text-2xl font-bold text-white mb-2 text-center">{section.title}</h2>
        )}
        {section.content && (
          <p className="text-white/60 text-sm mb-6 text-center">{section.content}</p>
        )}

        {errors.length > 0 && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 mb-4 space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-sm text-red-400 flex items-center gap-1.5">
                <AlertCircle className="size-3.5 shrink-0" /> {e}
              </p>
            ))}
          </div>
        )}

        {/* Step: Select calendar */}
        {step === "calendar" && (
          <div className="space-y-3">
            <p className="text-white/70 text-sm font-medium mb-3">Seleccioná un calendario</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {availableCalendars.map((cal) => (
                <button
                  key={cal.id}
                  onClick={() => handleSelectCalendar(cal.id)}
                  className="text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <p className="text-white font-medium text-sm">{cal.name}</p>
                  {cal.description && <p className="text-white/40 text-xs mt-1">{cal.description}</p>}
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                    {BOOKING_MODE_LABELS[cal.bookingMode].label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Select date (month grid) */}
        {step === "date" && selectedCalendar && (
          <div className="space-y-4">
            {/* Resource selector */}
            {cfg.showResourceSelector !== false && calendarResources.length > 1 && (
              <div>
                <label className="block text-sm text-white/60 mb-1">Recurso</label>
                <select
                  className={inputCls}
                  value={selectedResourceId}
                  onChange={(e) => { setSelectedResourceId(e.target.value); setSelectedDate(""); }}
                  style={{ borderColor: `${primaryColor}40` }}
                >
                  <option value="">Todos los recursos</option>
                  {calendarResources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}

            {/* Month navigation */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 transition-colors">
                <ChevronLeft className="size-5" />
              </button>
              <h3 className="text-white font-semibold">{monthLabel}</h3>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 transition-colors">
                <ChevronRight className="size-5" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d.key} className="text-center text-xs text-white/40 font-medium py-1">{d.short}</div>
              ))}
              {monthGrid.map((cell, i) => (
                <button
                  key={i}
                  disabled={cell.status !== "available" || !cell.inMonth || !canInteract}
                  onClick={() => cell.status === "available" && cell.inMonth && handleSelectDate(cell.date)}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm border transition-colors ${
                    cell.inMonth ? cellColor(cell.status) : "text-white/10"
                  } ${!cell.inMonth ? "pointer-events-none" : ""} ${
                    cell.date === selectedDate ? "" : ""
                  } disabled:cursor-not-allowed`}
                  style={cell.date === selectedDate ? { outlineColor: primaryColor, outlineWidth: 2, outlineStyle: "solid" } : undefined}
                >
                  {cell.day}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 justify-center text-xs text-white/40">
              <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-emerald-700/60" /> Disponible</span>
              <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-red-800/40" /> Bloqueado</span>
              <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-slate-700/40" /> Cerrado</span>
            </div>

            {availableCalendars.length > 1 && (
              <button onClick={handleBack} className="text-sm text-white/40 hover:text-white/70 transition-colors">
                &larr; Cambiar calendario
              </button>
            )}
          </div>
        )}

        {/* Step: Select time slot (hourly) */}
        {step === "slot" && isHourly && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={handleBack} className="text-sm text-white/40 hover:text-white/70 transition-colors">
                &larr; Cambiar fecha
              </button>
              <p className="text-white/70 text-sm">{selectedDate}</p>
            </div>

            {filteredSlots.length === 0 ? (
              <p className="text-center text-white/40 text-sm py-8">No hay horarios disponibles para esta fecha.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {filteredSlots.map((slot, i) => {
                  const resource = calendarResources.find((r) => r.id === slot.resourceId);
                  return (
                    <button
                      key={i}
                      disabled={!canInteract}
                      onClick={() => handleSelectSlot(slot)}
                      className={`p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-center disabled:opacity-40 disabled:cursor-not-allowed ${
                        selectedSlot?.startTime === slot.startTime && selectedSlot?.resourceId === slot.resourceId ? "" : ""
                      }`}
                      style={selectedSlot?.startTime === slot.startTime && selectedSlot?.resourceId === slot.resourceId ? { borderColor: primaryColor, outlineColor: primaryColor, outlineWidth: 2, outlineStyle: "solid" } : undefined}
                    >
                      <p className="text-white font-medium text-sm">{slot.startTime} - {slot.endTime}</p>
                      {calendarResources.length > 1 && resource && (
                        <p className="text-white/40 text-xs mt-0.5">{resource.name}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step: Contact form */}
        {step === "form" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={handleBack} className="text-sm text-white/40 hover:text-white/70 transition-colors">
                &larr; Volver
              </button>
              <div className="text-right text-sm text-white/50">
                <p>{selectedDate}{isHourly && selectedSlot ? ` · ${selectedSlot.startTime} - ${selectedSlot.endTime}` : ""}</p>
                {!isHourly && calendarResources.length > 0 && (
                  <p className="text-xs text-white/30">
                    {selectedResourceId ? calendarResources.find((r) => r.id === selectedResourceId)?.name : "Cualquier recurso"}
                  </p>
                )}
              </div>
            </div>

            {/* End date for daily mode */}
            {!isHourly && (
              <div>
                <label className="block text-sm text-white/60 mb-1">Fecha de salida</label>
                <input
                  type="date"
                  className={inputCls}
                  value={selectedEndDate}
                  min={selectedDate}
                  onChange={(e) => setSelectedEndDate(e.target.value)}
                  style={{ borderColor: `${primaryColor}40` }}
                />
              </div>
            )}

            {/* Resource selector for daily mode if not pre-selected */}
            {!isHourly && cfg.showResourceSelector !== false && calendarResources.length > 1 && !selectedResourceId && (
              <div>
                <label className="block text-sm text-white/60 mb-1">Recurso *</label>
                <select
                  className={inputCls}
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                  style={{ borderColor: `${primaryColor}40` }}
                >
                  <option value="">Seleccionar...</option>
                  {calendarResources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-white/60 mb-1">Nombre *</label>
                <input
                  className={inputCls}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Tu nombre"
                  style={{ borderColor: `${primaryColor}40` }}
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Email</label>
                <input
                  className={inputCls}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="tu@email.com"
                  style={{ borderColor: `${primaryColor}40` }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">Teléfono</label>
              <input
                className={inputCls}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+54 9 ..."
                style={{ borderColor: `${primaryColor}40` }}
              />
            </div>

            {cfg.allowNotes !== false && (
              <div>
                <label className="block text-sm text-white/60 mb-1">Notas</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                  style={{ borderColor: `${primaryColor}40` }}
                />
              </div>
            )}

            <button
              onClick={handleSubmitBooking}
              disabled={!canInteract}
              className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: primaryColor }}
            >
              Confirmar reserva
            </button>

            {!canInteract && (
              <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
                <Lock className="size-3.5" />
                Se requieren permisos para realizar reservas
              </div>
            )}
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="text-center py-8 space-y-4">
            <div className="size-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${primaryColor}20` }}>
              <CheckCircle className="size-8" style={{ color: primaryColor }} />
            </div>
            <p className="text-white font-medium">
              {(cfg.successMessage ?? "Reserva confirmada. Tu código de confirmación es: {{confirmationCode}}").replace(
                "{{confirmationCode}}",
                confirmationCode,
              )}
            </p>
            <p className="text-white/40 text-sm font-mono">{confirmationCode}</p>
            <button
              onClick={handleRestart}
              className="text-sm px-4 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Hacer otra reserva
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
