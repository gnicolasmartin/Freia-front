"use client";

import { ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  unit?: string;
  description?: string;
  icon?: React.ReactNode;
}

export default function StatCard({
  title,
  value,
  change,
  unit,
  description,
  icon,
}: StatCardProps) {
  const isPositive = change && change > 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm hover:border-slate-600 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-400 mb-2">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-white">{value}</p>
            {unit && <span className="text-slate-400 text-sm">{unit}</span>}
          </div>
          {description && (
            <p className="text-xs text-slate-500 mt-2">{description}</p>
          )}
        </div>
        {icon && (
          <div className="flex size-12 items-center justify-center rounded-lg bg-slate-700/50">
            {icon}
          </div>
        )}
      </div>

      {change !== undefined && (
        <div className="mt-4 flex items-center gap-2">
          {isPositive ? (
            <ArrowUpRight className="size-4 text-green-400" />
          ) : (
            <ArrowDownLeft className="size-4 text-red-400" />
          )}
          <span
            className={`text-sm font-medium ${
              isPositive ? "text-green-400" : "text-red-400"
            }`}
          >
            {Math.abs(change)}% comparado a período anterior
          </span>
        </div>
      )}
    </div>
  );
}
