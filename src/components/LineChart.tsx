"use client";

interface ChartPoint {
  label: string;
  value: number;
  change?: number;
}

interface LineChartProps {
  title: string;
  data: ChartPoint[];
  maxValue?: number;
  period: "day" | "week" | "month";
  onPeriodChange?: (period: "day" | "week" | "month") => void;
}

export default function LineChart({
  title,
  data,
  maxValue,
  period,
  onPeriodChange,
}: LineChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 100);
  const height = 200;
  const width = 400;
  const padding = 40;

  // Calculate the actual drawing dimensions
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  // Create points for the line
  const points = data.map((d, idx) => ({
    x: padding + (idx / (data.length - 1 || 1)) * graphWidth,
    y: padding + graphHeight - (d.value / max) * graphHeight,
    value: d.value,
    label: d.label,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const periods = [
    { value: "day", label: "Día" },
    { value: "week", label: "Semana" },
    { value: "month", label: "Mes" },
  ] as const;

  return (
    <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <div className="flex gap-2">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange?.(p.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                period === p.value
                  ? "bg-[#dd7430] text-white"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="min-w-full">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding + (1 - ratio) * graphHeight;
            return (
              <g key={`grid-${ratio}`}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="#334155"
                  strokeDasharray="4"
                  opacity="0.3"
                />
                <text
                  x={padding - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#94a3b8"
                >
                  {Math.round(ratio * max)}
                </text>
              </g>
            );
          })}

          {/* Line */}
          <path d={pathD} stroke="#dd7430" strokeWidth="2" fill="none" />

          {/* Gradient area under line */}
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#dd7430" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#dd7430" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${pathD} L ${points[points.length - 1]?.x} ${padding + graphHeight} L ${padding} ${padding + graphHeight} Z`}
            fill="url(#lineGradient)"
          />

          {/* Data points */}
          {points.map((p, idx) => (
            <g key={`point-${idx}`}>
              <circle cx={p.x} cy={p.y} r="4" fill="#dd7430" />
              <circle cx={p.x} cy={p.y} r="6" fill="#dd7430" opacity="0.2" />
            </g>
          ))}

          {/* X-axis labels */}
          {points.map((p, idx) => (
            <text
              key={`label-${idx}`}
              x={p.x}
              y={height - 10}
              textAnchor="middle"
              fontSize="12"
              fill="#94a3b8"
            >
              {p.label}
            </text>
          ))}
        </svg>
      </div>

      {/* Additional info */}
      {data.some((d) => d.change !== undefined) && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {data.map((d, idx) => (
            <div key={idx} className="text-center">
              <p className="text-xs text-slate-400">{d.label}</p>
              <p className="text-sm font-semibold text-white">{d.value}</p>
              {d.change !== undefined && (
                <p
                  className={`text-xs font-medium ${
                    d.change > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {d.change > 0 ? "+" : ""}{d.change}%
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
