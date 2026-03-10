"use client";

import { useState } from "react";
import {
  CalendarDays,
  Layers,
  Ban,
  Clock,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
} from "lucide-react";
import { useCalendars } from "@/providers/CalendarsProvider";
import { BOOKING_MODE_LABELS, BOOKING_STATUS_CONFIG } from "@/types/calendar";
import type {
  Calendar,
  CalendarFormData,
  CalendarResource,
  ResourceFormData,
  BlockedPeriod,
  BlockedPeriodFormData,
  MinimumStayRule,
  MinimumStayRuleFormData,
  Booking,
  BookingFormData,
  BookingStatus,
} from "@/types/calendar";
import CalendarModal from "@/components/calendars/CalendarModal";
import ResourceModal from "@/components/calendars/ResourceModal";
import BlockedPeriodModal from "@/components/calendars/BlockedPeriodModal";
import MinStayRuleModal from "@/components/calendars/MinStayRuleModal";
import BookingModal from "@/components/calendars/BookingModal";
import CalendarViewPanel from "@/components/calendars/CalendarViewPanel";

type Tab = "calendars" | "resources" | "blocks" | "rules" | "bookings";

const TABS: { key: Tab; label: string; icon: typeof CalendarDays }[] = [
  { key: "calendars", label: "Calendarios", icon: CalendarDays },
  { key: "resources",  label: "Recursos",    icon: Layers },
  { key: "blocks",     label: "Bloqueos",    icon: Ban },
  { key: "rules",      label: "Reglas",      icon: Clock },
  { key: "bookings",   label: "Reservas",    icon: BookOpen },
];

export default function CalendarsPage() {
  const {
    calendars, addCalendar, updateCalendar, deleteCalendar,
    resources, getResourcesByCalendar, addResource, updateResource, deleteResource,
    blockedPeriods, getBlocksByCalendar, addBlockedPeriod, updateBlockedPeriod, deleteBlockedPeriod,
    minStayRules, getRulesByCalendar, addMinStayRule, updateMinStayRule, deleteMinStayRule,
    bookings, getBookingsByCalendar, addBooking, updateBooking, cancelBooking,
    validateBooking,
  } = useCalendars();

  const [activeTab, setActiveTab] = useState<Tab>("calendars");
  const [filterCalendarId, setFilterCalendarId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState<BookingStatus | "">("");

  // Modal states
  const [calendarModal, setCalendarModal] = useState<{ open: boolean; calendar?: Calendar }>({ open: false });
  const [resourceModal, setResourceModal] = useState<{ open: boolean; resource?: CalendarResource }>({ open: false });
  const [blockModal, setBlockModal] = useState<{ open: boolean; block?: BlockedPeriod }>({ open: false });
  const [ruleModal, setRuleModal] = useState<{ open: boolean; rule?: MinimumStayRule }>({ open: false });
  const [bookingModal, setBookingModal] = useState<{ open: boolean; booking?: Booking; preDate?: string }>({ open: false });

  // Calendar view state
  const [viewCalendarId, setViewCalendarId] = useState<string>("");

  const tabClasses = (tab: Tab) =>
    `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
      activeTab === tab
        ? "bg-[#dd7430] text-white shadow-lg shadow-orange-500/20"
        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
    }`;

  const handleDeleteCalendar = (cal: Calendar) => {
    const resCount = getResourcesByCalendar(cal.id).length;
    const bookCount = getBookingsByCalendar(cal.id).length;
    const msg = `¿Eliminar "${cal.name}"?${resCount > 0 ? ` Se eliminarán ${resCount} recurso(s)` : ""}${bookCount > 0 ? ` y ${bookCount} reserva(s)` : ""}.`;
    if (confirm(msg)) deleteCalendar(cal.id);
  };

  // Filtered data
  const filteredResources = filterCalendarId ? resources.filter((r) => r.calendarId === filterCalendarId) : resources;
  const filteredBlocks = filterCalendarId ? blockedPeriods.filter((b) => b.calendarId === filterCalendarId) : blockedPeriods;
  const filteredRules = filterCalendarId ? minStayRules.filter((r) => r.calendarId === filterCalendarId) : minStayRules;
  const filteredBookings = bookings.filter((b) => {
    if (filterCalendarId && b.calendarId !== filterCalendarId) return false;
    if (bookingStatusFilter && b.status !== bookingStatusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return b.contactName.toLowerCase().includes(q) || b.confirmationCode.toLowerCase().includes(q) || (b.contactPhone ?? "").includes(q);
    }
    return true;
  });

  const calName = (id: string) => calendars.find((c) => c.id === id)?.name ?? "—";
  const resName = (id: string) => resources.find((r) => r.id === id)?.name ?? "—";

  const viewCalendar = calendars.find((c) => c.id === viewCalendarId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendarios</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestión de calendarios, recursos y reservas
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)} className={tabClasses(key)}>
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Calendar filter (for non-calendars tabs) */}
      {activeTab !== "calendars" && (
        <div className="flex items-center gap-3 flex-wrap">
          <select
            className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-white text-sm focus:border-[#dd7430] focus:outline-none"
            value={filterCalendarId}
            onChange={(e) => setFilterCalendarId(e.target.value)}
          >
            <option value="">Todos los calendarios</option>
            {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {activeTab === "bookings" && (
            <>
              <select
                className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-white text-sm focus:border-[#dd7430] focus:outline-none"
                value={bookingStatusFilter}
                onChange={(e) => setBookingStatusFilter(e.target.value as BookingStatus | "")}
              >
                <option value="">Todos los estados</option>
                {(Object.keys(BOOKING_STATUS_CONFIG) as BookingStatus[]).map((s) => (
                  <option key={s} value={s}>{BOOKING_STATUS_CONFIG[s].label}</option>
                ))}
              </select>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <input
                  className="w-full rounded-lg border border-slate-600 bg-slate-800/50 pl-9 pr-3 py-2 text-white text-sm placeholder-slate-500 focus:border-[#dd7430] focus:outline-none"
                  placeholder="Buscar por nombre, código o teléfono..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </>
          )}

          <button
            onClick={() => {
              if (activeTab === "resources") setResourceModal({ open: true });
              else if (activeTab === "blocks") setBlockModal({ open: true });
              else if (activeTab === "rules") setRuleModal({ open: true });
              else if (activeTab === "bookings") setBookingModal({ open: true });
            }}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="size-4" />
            {activeTab === "resources" ? "Nuevo recurso" : activeTab === "blocks" ? "Nuevo bloqueo" : activeTab === "rules" ? "Nueva regla" : "Nueva reserva"}
          </button>
        </div>
      )}

      {/* ═══ Calendars Tab ═══ */}
      {activeTab === "calendars" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setCalendarModal({ open: true })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <Plus className="size-4" /> Nuevo calendario
            </button>
          </div>

          {calendars.length === 0 ? (
            <div className="text-center py-16">
              <CalendarDays className="size-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No hay calendarios configurados</p>
              <p className="text-sm text-slate-500 mt-1">Creá tu primer calendario para empezar a gestionar reservas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {calendars.map((cal) => {
                const calResources = getResourcesByCalendar(cal.id);
                const calBookings = getBookingsByCalendar(cal.id);
                const activeBookings = calBookings.filter((b) => b.status !== "cancelled").length;

                return (
                  <div key={cal.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-white">{cal.name}</h3>
                        {cal.description && <p className="text-xs text-slate-400 mt-0.5">{cal.description}</p>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        cal.bookingMode === "hourly" ? "bg-sky-900/20 text-sky-400 border border-sky-800/50" : "bg-purple-900/20 text-purple-400 border border-purple-800/50"
                      }`}>
                        {BOOKING_MODE_LABELS[cal.bookingMode].label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-900/50 rounded-lg py-2">
                        <p className="text-lg font-bold text-white">{calResources.length}</p>
                        <p className="text-xs text-slate-500">Recursos</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg py-2">
                        <p className="text-lg font-bold text-white">{activeBookings}</p>
                        <p className="text-xs text-slate-500">Reservas</p>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg py-2">
                        <p className="text-lg font-bold text-white">{cal.maxAdvanceDays}d</p>
                        <p className="text-xs text-slate-500">Anticipación</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                      <button
                        onClick={() => updateCalendar(cal.id, { active: !cal.active })}
                        className={`flex items-center gap-1.5 text-xs ${cal.active ? "text-emerald-400" : "text-slate-500"}`}
                      >
                        {cal.active ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
                        {cal.active ? "Activo" : "Inactivo"}
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setViewCalendarId(cal.id); setFilterCalendarId(cal.id); }}
                          className="p-1.5 text-slate-400 hover:text-[#dd7430] transition-colors"
                          aria-label="Ver calendario"
                        >
                          <CalendarDays className="size-4" />
                        </button>
                        <button
                          onClick={() => setCalendarModal({ open: true, calendar: cal })}
                          className="p-1.5 text-slate-400 hover:text-white transition-colors"
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCalendar(cal)}
                          className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Calendar visual view */}
          {viewCalendar && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Vista: {viewCalendar.name}</h3>
                <button onClick={() => setViewCalendarId("")} className="text-xs text-slate-400 hover:text-white">Cerrar</button>
              </div>
              <CalendarViewPanel
                calendar={viewCalendar}
                resources={resources}
                bookings={bookings}
                blockedPeriods={blockedPeriods}
                onDateClick={(date) => setBookingModal({ open: true, preDate: date })}
              />
            </div>
          )}
        </div>
      )}

      {/* ═══ Resources Tab ═══ */}
      {activeTab === "resources" && (
        filteredResources.length === 0 ? (
          <div className="text-center py-16">
            <Layers className="size-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No hay recursos{filterCalendarId ? " para este calendario" : ""}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredResources.map((res) => (
              <div key={res.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-white">{res.name}</h4>
                    <p className="text-xs text-slate-500">{calName(res.calendarId)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${res.active ? "bg-emerald-900/20 text-emerald-400" : "bg-slate-700 text-slate-500"}`}>
                    {res.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                {res.description && <p className="text-xs text-slate-400">{res.description}</p>}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Capacidad: {res.capacity}</span>
                  {Object.keys(res.metadata).length > 0 && (
                    <span>{Object.keys(res.metadata).length} metadato(s)</span>
                  )}
                </div>
                <div className="flex justify-end gap-1 pt-1 border-t border-slate-700/50">
                  <button onClick={() => setResourceModal({ open: true, resource: res })} className="p-1.5 text-slate-400 hover:text-white transition-colors">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => { if (confirm(`¿Eliminar "${res.name}"?`)) deleteResource(res.id); }} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ═══ Blocks Tab ═══ */}
      {activeTab === "blocks" && (
        filteredBlocks.length === 0 ? (
          <div className="text-center py-16">
            <Ban className="size-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No hay bloqueos{filterCalendarId ? " para este calendario" : ""}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBlocks.map((bp) => (
              <div key={bp.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white text-sm">{bp.name}</h4>
                    {bp.recurring && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/20 text-purple-400 border border-purple-800/50">Recurrente</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {calName(bp.calendarId)} {bp.resourceId ? `· ${resName(bp.resourceId)}` : "· Todos los recursos"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {bp.startDate} — {bp.endDate}
                    {bp.startTime && bp.endTime && ` · ${bp.startTime} - ${bp.endTime}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setBlockModal({ open: true, block: bp })} className="p-1.5 text-slate-400 hover:text-white transition-colors">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => { if (confirm(`¿Eliminar "${bp.name}"?`)) deleteBlockedPeriod(bp.id); }} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ═══ Rules Tab ═══ */}
      {activeTab === "rules" && (
        filteredRules.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="size-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No hay reglas de estadía mínima{filterCalendarId ? " para este calendario" : ""}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRules.map((rule) => (
              <div key={rule.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-medium text-white text-sm">{rule.name}</h4>
                  <p className="text-xs text-slate-400">{calName(rule.calendarId)}</p>
                  <p className="text-xs text-slate-500">
                    {rule.startDate} — {rule.endDate} · Mínimo: {rule.minimumUnits} {rule.unitType === "days" ? "días" : "minutos"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setRuleModal({ open: true, rule })} className="p-1.5 text-slate-400 hover:text-white transition-colors">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => { if (confirm(`¿Eliminar "${rule.name}"?`)) deleteMinStayRule(rule.id); }} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ═══ Bookings Tab ═══ */}
      {activeTab === "bookings" && (
        filteredBookings.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="size-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No hay reservas{filterCalendarId || bookingStatusFilter || search ? " con esos filtros" : ""}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-3 text-slate-400 font-medium">Código</th>
                  <th className="text-left py-3 px-3 text-slate-400 font-medium">Contacto</th>
                  <th className="text-left py-3 px-3 text-slate-400 font-medium">Calendario</th>
                  <th className="text-left py-3 px-3 text-slate-400 font-medium">Recurso</th>
                  <th className="text-left py-3 px-3 text-slate-400 font-medium">Fecha</th>
                  <th className="text-left py-3 px-3 text-slate-400 font-medium">Estado</th>
                  <th className="text-right py-3 px-3 text-slate-400 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((bk) => {
                  const sc = BOOKING_STATUS_CONFIG[bk.status];
                  return (
                    <tr key={bk.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-mono text-[#dd7430] text-xs">{bk.confirmationCode}</td>
                      <td className="py-3 px-3">
                        <p className="text-white">{bk.contactName}</p>
                        {bk.contactPhone && <p className="text-xs text-slate-500">{bk.contactPhone}</p>}
                      </td>
                      <td className="py-3 px-3 text-slate-300">{calName(bk.calendarId)}</td>
                      <td className="py-3 px-3 text-slate-300">{resName(bk.resourceId)}</td>
                      <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                        {bk.startDate === bk.endDate ? bk.startDate : `${bk.startDate} — ${bk.endDate}`}
                        {bk.startTime && <span className="text-slate-500 ml-1">{bk.startTime}-{bk.endTime}</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${sc.color} ${sc.bg} border ${sc.border}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setBookingModal({ open: true, booking: bk })} className="p-1.5 text-slate-400 hover:text-white transition-colors">
                            <Pencil className="size-3.5" />
                          </button>
                          {bk.status !== "cancelled" && (
                            <button onClick={() => { if (confirm("¿Cancelar esta reserva?")) cancelBooking(bk.id); }} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
                              <Ban className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ═══ Modals ═══ */}
      <CalendarModal
        open={calendarModal.open}
        onClose={() => setCalendarModal({ open: false })}
        onSave={(data: CalendarFormData) => calendarModal.calendar ? updateCalendar(calendarModal.calendar.id, data) : addCalendar(data)}
        calendar={calendarModal.calendar}
      />
      <ResourceModal
        open={resourceModal.open}
        onClose={() => setResourceModal({ open: false })}
        onSave={(data: ResourceFormData) => resourceModal.resource ? updateResource(resourceModal.resource.id, data) : addResource(data)}
        resource={resourceModal.resource}
        calendars={calendars}
        preselectedCalendarId={filterCalendarId}
      />
      <BlockedPeriodModal
        open={blockModal.open}
        onClose={() => setBlockModal({ open: false })}
        onSave={(data: BlockedPeriodFormData) => blockModal.block ? updateBlockedPeriod(blockModal.block.id, data) : addBlockedPeriod(data)}
        block={blockModal.block}
        calendars={calendars}
        resources={resources}
        preselectedCalendarId={filterCalendarId}
      />
      <MinStayRuleModal
        open={ruleModal.open}
        onClose={() => setRuleModal({ open: false })}
        onSave={(data: MinimumStayRuleFormData) => ruleModal.rule ? updateMinStayRule(ruleModal.rule.id, data) : addMinStayRule(data)}
        rule={ruleModal.rule}
        calendars={calendars}
        preselectedCalendarId={filterCalendarId}
      />
      <BookingModal
        open={bookingModal.open}
        onClose={() => setBookingModal({ open: false })}
        onSave={(data: BookingFormData) => bookingModal.booking ? updateBooking(bookingModal.booking.id, data) : addBooking(data)}
        booking={bookingModal.booking}
        calendars={calendars}
        resources={resources}
        preselectedCalendarId={filterCalendarId || viewCalendarId}
        preselectedDate={bookingModal.preDate}
        validateBooking={validateBooking}
      />
    </div>
  );
}
