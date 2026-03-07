"use client";

import { Clock } from "lucide-react";

interface AverageConversationTimeProps {
  averageMinutes: number;
  totalConversations: number;
  shortestMinutes: number;
  longestMinutes: number;
  trend?: number;
}

export default function AverageConversationTime({
  averageMinutes,
  totalConversations,
  shortestMinutes,
  longestMinutes,
  trend,
}: AverageConversationTimeProps) {
  const formatTime = (minutes: number) => {
    if (minutes < 1) {
      return `${Math.round(minutes * 60)}s`;
    }
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-base font-semibold text-white">
          Tiempo de Conversación
        </h3>
        <div className="flex size-10 items-center justify-center rounded-lg bg-slate-700/50">
          <Clock className="size-5 text-[#dd7430]" />
        </div>
      </div>

      {/* Main metric */}
      <div className="mb-6">
        <p className="text-sm text-slate-400 mb-2">Tiempo Promedio</p>
        <p className="text-4xl font-bold text-white">
          {formatTime(averageMinutes)}
        </p>
        {trend !== undefined && (
          <p className={`text-xs mt-2 ${trend > 0 ? "text-red-400" : "text-green-400"}`}>
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% vs período anterior
          </p>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-slate-700/20">
          <p className="text-xs text-slate-400 mb-1">Más Corta</p>
          <p className="text-lg font-semibold text-white">
            {formatTime(shortestMinutes)}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-slate-700/20">
          <p className="text-xs text-slate-400 mb-1">Más Larga</p>
          <p className="text-lg font-semibold text-white">
            {formatTime(longestMinutes)}
          </p>
        </div>
        <div className="col-span-2 p-3 rounded-lg bg-slate-700/20">
          <p className="text-xs text-slate-400 mb-1">Total de Conversaciones</p>
          <p className="text-lg font-semibold text-white">{totalConversations}</p>
        </div>
      </div>
    </div>
  );
}
