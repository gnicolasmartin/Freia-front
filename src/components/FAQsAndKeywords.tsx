"use client";

interface Keyword {
  keyword: string;
  count: number;
  trend: "up" | "down" | "stable";
}

interface FAQsAndKeywordsProps {
  keywords: Keyword[];
}

export default function FAQsAndKeywords({ keywords }: FAQsAndKeywordsProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
      <h3 className="text-base font-semibold text-white mb-6">
        FAQs y Menciones Frecuentes
      </h3>

      <div className="space-y-3">
        {keywords.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-700/20 hover:bg-slate-700/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {item.keyword}
              </p>
              <p className="text-xs text-slate-400">
                Mencionado {item.count} veces
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                  item.trend === "up"
                    ? "bg-green-900/30 text-green-400"
                    : item.trend === "down"
                      ? "bg-red-900/30 text-red-400"
                      : "bg-slate-700/50 text-slate-300"
                }`}
              >
                {item.trend === "up" ? "↑ Sube" : item.trend === "down" ? "↓ Baja" : "→ Estable"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-blue-900/20 border border-blue-800/50">
        <p className="text-xs text-blue-300">
          💡 Estos temas son frecuentemente mencionados por usuarios. Considera
          crear respuestas automáticas o mejorar tu base de conocimiento.
        </p>
      </div>
    </div>
  );
}
