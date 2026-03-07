"use client";

import { Target, Plus, Filter } from "lucide-react";

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Leads</h1>
          <p className="text-slate-400 mt-1">
            Administra y da seguimiento a tus leads
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 text-slate-200 font-medium hover:bg-slate-800/50 transition-colors">
            <Filter className="size-5" />
            <span>Filtrar</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors">
            <Plus className="size-5" />
            <span>Nuevo Lead</span>
          </button>
        </div>
      </div>

      {/* Placeholder Content */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 py-12 backdrop-blur-sm">
        <Target className="size-12 text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">
          Página de Leads
        </h2>
        <p className="text-slate-400 text-center max-w-md">
          Aquí podrás gestionar todos los leads y hacer seguimiento de su progreso a través del embudo de ventas.
        </p>
      </div>
    </div>
  );
}
