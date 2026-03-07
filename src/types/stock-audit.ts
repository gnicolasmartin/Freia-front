export type StockAuditAction =
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "discount_created"
  | "discount_updated"
  | "discount_deleted"
  | "variant_type_created"
  | "variant_type_updated"
  | "variant_type_deleted";

export type StockAuditEntityType = "product" | "discount" | "variant_type";

export interface StockAuditChange {
  field: string;
  oldValue?: string;
  newValue?: string;
}

export interface StockAuditEntry {
  id: string;
  timestamp: string;
  action: StockAuditAction;
  entityType: StockAuditEntityType;
  entityId: string;
  entityName: string;
  userName: string;
  changes?: StockAuditChange[];
}

// ─── UI config ────────────────────────────────────────────────────────────────

export const ACTION_CONFIG: Record<
  StockAuditAction,
  { label: string; colorClass: string; bgClass: string }
> = {
  product_created:      { label: "Creado",     colorClass: "text-emerald-400", bgClass: "bg-emerald-500/10" },
  product_updated:      { label: "Modificado", colorClass: "text-sky-400",     bgClass: "bg-sky-500/10" },
  product_deleted:      { label: "Eliminado",  colorClass: "text-red-400",     bgClass: "bg-red-500/10" },
  discount_created:     { label: "Creado",     colorClass: "text-emerald-400", bgClass: "bg-emerald-500/10" },
  discount_updated:     { label: "Modificado", colorClass: "text-sky-400",     bgClass: "bg-sky-500/10" },
  discount_deleted:     { label: "Eliminado",  colorClass: "text-red-400",     bgClass: "bg-red-500/10" },
  variant_type_created: { label: "Creado",     colorClass: "text-emerald-400", bgClass: "bg-emerald-500/10" },
  variant_type_updated: { label: "Modificado", colorClass: "text-sky-400",     bgClass: "bg-sky-500/10" },
  variant_type_deleted: { label: "Eliminado",  colorClass: "text-red-400",     bgClass: "bg-red-500/10" },
};

export const ENTITY_LABELS: Record<StockAuditEntityType, string> = {
  product:      "Producto",
  discount:     "Descuento",
  variant_type: "Tipo de variante",
};
