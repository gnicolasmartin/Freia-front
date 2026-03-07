"use client";

interface InconclusiveReason {
  reason: string;
  count: number;
  percentage: number;
}

interface InconclusiveConversionsProps {
  reasons: InconclusiveReason[];
  total: number;
}

export default function InconclusiveConversions({
  reasons,
  total,
}: InconclusiveConversionsProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
      <h3 className="text-base font-semibold text-white mb-6">
        Conversiones Inconclusas
      </h3>

      <div className="space-y-4">
        {reasons.map((reason, idx) => (
          <div key={idx}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-300">{reason.reason}</p>
              <p className="text-sm font-semibold text-white">
                {reason.count} ({reason.percentage}%)
              </p>
            </div>
            {/* Progress bar */}
            <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-300"
                style={{ width: `${reason.percentage}%` }}
                role="progressbar"
                aria-valuenow={reason.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-700">
        <p className="text-xs text-slate-400 mb-1">Total inconclusas</p>
        <p className="text-2xl font-bold text-white">{total}</p>
      </div>
    </div>
  );
}
