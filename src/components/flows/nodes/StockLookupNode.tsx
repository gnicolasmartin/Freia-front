import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ShoppingCart } from "lucide-react";
import { useSimulationBorder } from "../SimulationHighlightContext";

export default function StockLookupNode({ id, data, selected }: NodeProps) {
  const nodeData = data as Record<string, unknown>;
  const label = (nodeData.label as string) || "Buscar Producto";
  const searchMode = (nodeData.searchMode as string) || "variable";
  const searchVariable = nodeData.searchVariable as string | undefined;
  const searchLiteral = nodeData.searchLiteral as string | undefined;

  const borderClass = useSimulationBorder(
    id,
    !!selected,
    "border-emerald-400 ring-2 ring-emerald-400/30",
    "border-emerald-500/60"
  );

  const savedOutputs = [
    { key: "saveProductId", label: "product_id" },
    { key: "saveProductName", label: "product_name" },
    { key: "saveVariantId", label: "variant_id" },
    { key: "savePrice", label: "price" },
    { key: "saveFinalPrice", label: "final_price" },
    { key: "saveDiscounts", label: "discounts[]" },
  ].filter((o) => nodeData[o.key]);

  return (
    <div
      className={`rounded-xl border-2 bg-slate-800 px-4 py-3 shadow-lg min-w-[190px] ${borderClass}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-500 !border-emerald-400 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20">
          <ShoppingCart className="size-4 text-emerald-400" />
        </div>
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>

      {/* Search mode */}
      <p className="text-xs text-emerald-300 mt-1.5 truncate">
        {searchMode === "literal"
          ? searchLiteral
            ? `"${searchLiteral}"`
            : "Texto fijo (sin configurar)"
          : searchVariable
            ? `var: ${searchVariable}`
            : "Variable (sin configurar)"}
      </p>

      {/* Output variables summary */}
      {savedOutputs.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {savedOutputs.slice(0, 3).map((o) => (
            <p
              key={o.key}
              className="text-[10px] text-slate-400 font-mono truncate"
            >
              <span className="text-emerald-400">{nodeData[o.key] as string}</span>
              <span className="text-slate-600"> ← {o.label}</span>
            </p>
          ))}
          {savedOutputs.length > 3 && (
            <p className="text-[10px] text-slate-500 italic">
              +{savedOutputs.length - 3} más
            </p>
          )}
        </div>
      )}

      {/* Handle labels */}
      <div className="flex justify-between mt-1.5 text-[9px] font-medium px-1">
        <span className="text-emerald-400">✓ Encontrado</span>
        <span className="text-amber-400">✗ No encontrado</span>
      </div>
      <Handle
        type="source"
        id="found"
        position={Position.Bottom}
        style={{ left: "30%" }}
        className="!bg-emerald-500 !border-emerald-400 !w-3 !h-3"
      />
      <Handle
        type="source"
        id="not_found"
        position={Position.Bottom}
        style={{ left: "70%" }}
        className="!bg-amber-500 !border-amber-400 !w-3 !h-3"
      />
    </div>
  );
}
