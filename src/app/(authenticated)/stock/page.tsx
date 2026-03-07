"use client";

import { useState, useEffect, useMemo } from "react";
import { Package, Plus, Lock, Pencil, Trash2, AlertTriangle, GitBranch, ExternalLink, Tag, Percent, Search, X, SlidersHorizontal, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { useProducts } from "@/providers/ProductsProvider";
import { useFlows } from "@/providers/FlowsProvider";
import { ProductModal } from "@/components/stock/ProductModal";
import { VariantTypesPanel } from "@/components/stock/VariantTypesPanel";
import { DiscountsPanel } from "@/components/stock/DiscountsPanel";
import type { Product } from "@/types/product";
import type { Flow } from "@/types/flow";

type StockTab = "products" | "variant-types" | "discounts";
type SortField = "category" | "brand" | "model" | "name" | "sku" | "updatedAt" | "price";
type SortDir = "asc" | "desc";

const STOCK_TOOL_IDS = new Set(["get_stock", "reserve_stock"]);

/** Returns flows that contain at least one toolcall node using a stock tool. */
function findStockFlows(flows: Flow[]): Flow[] {
  return flows.filter((flow) =>
    flow.nodes.some(
      (node) =>
        node.type === "toolcall" &&
        STOCK_TOOL_IDS.has((node.data as Record<string, unknown>).tool as string)
    )
  );
}

interface DeleteState {
  productId: string;
  blockingFlows: Flow[]; // non-empty = blocked
}

const tabClasses = (active: boolean) =>
  `flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
    active
      ? "bg-slate-700 text-white"
      : "text-slate-400 hover:text-white hover:bg-slate-700/40"
  }`;

export default function StockPage() {
  const { user } = useAuth();
  const { products, discounts, deleteProduct } = useProducts();
  const { flows } = useFlows();
  const [activeTab, setActiveTab] = useState<StockTab>("products");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("category");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterVariants, setFilterVariants] = useState<"yes" | "no" | null>(null);
  const [filterDiscounts, setFilterDiscounts] = useState<"yes" | "no" | null>(null);
  const [filterPriceMin, setFilterPriceMin] = useState("");
  const [filterPriceMax, setFilterPriceMax] = useState("");

  // Persist sort preference
  useEffect(() => {
    const f = localStorage.getItem("freia_stock_sort_field") as SortField | null;
    if (f && (["category", "brand", "model", "name", "sku", "updatedAt", "price"] as SortField[]).includes(f)) setSortField(f);
    const d = localStorage.getItem("freia_stock_sort_dir");
    if (d === "asc" || d === "desc") setSortDir(d);
  }, []);

  const handleSortField = (f: SortField) => {
    setSortField(f);
    localStorage.setItem("freia_stock_sort_field", f);
  };

  const toggleSortDir = () => {
    const next: SortDir = sortDir === "asc" ? "desc" : "asc";
    setSortDir(next);
    localStorage.setItem("freia_stock_sort_dir", next);
  };

  const clearFilters = () => {
    setFilterCategory("");
    setFilterBrand("");
    setFilterModel("");
    setFilterVariants(null);
    setFilterDiscounts(null);
    setFilterPriceMin("");
    setFilterPriceMax("");
  };

  // Unique values for filter dropdowns
  const uniqueCategories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [products]
  );
  const uniqueBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [products]
  );
  const uniqueModels = useMemo(
    () => [...new Set(products.map((p) => p.model ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [products]
  );

  const openCreate = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const requestDelete = (product: Product) => {
    const blockingFlows = findStockFlows(flows);
    setDeleteState({ productId: product.id, blockingFlows });
  };

  const handleDeleteConfirm = () => {
    if (deleteState && deleteState.blockingFlows.length === 0) {
      deleteProduct(deleteState.productId);
    }
    setDeleteState(null);
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Lock className="size-12 text-slate-600" />
        <h2 className="text-xl font-semibold text-white">Acceso denegado</h2>
        <p className="text-slate-400 text-center max-w-sm">
          No tenés permisos para acceder a este módulo. Contactá a un administrador.
        </p>
      </div>
    );
  }

  const searchLower = search.toLowerCase();
  const filteredProducts = search.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(searchLower) ||
        p.sku.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower) ||
        (p.brand ?? "").toLowerCase().includes(searchLower) ||
        (p.model ?? "").toLowerCase().includes(searchLower)
      )
    : products;

  const activeFilterCount =
    (filterCategory !== "" ? 1 : 0) +
    (filterBrand !== "" ? 1 : 0) +
    (filterModel !== "" ? 1 : 0) +
    (filterVariants !== null ? 1 : 0) +
    (filterDiscounts !== null ? 1 : 0) +
    (filterPriceMin !== "" || filterPriceMax !== "" ? 1 : 0);

  const displayProducts = [...filteredProducts]
    .filter((p) => {
      if (filterCategory && p.category !== filterCategory) return false;
      if (filterBrand && (p.brand ?? "") !== filterBrand) return false;
      if (filterModel && (p.model ?? "") !== filterModel) return false;
      if (filterVariants === "yes" && !((p.variants?.length ?? 0) > 0)) return false;
      if (filterVariants === "no" && (p.variants?.length ?? 0) > 0) return false;
      if (filterDiscounts === "yes" && !((p.discountIds?.length ?? 0) > 0)) return false;
      if (filterDiscounts === "no" && (p.discountIds?.length ?? 0) > 0) return false;
      if (filterPriceMin !== "") {
        const min = Number(filterPriceMin);
        if (!isNaN(min) && p.price < min) return false;
      }
      if (filterPriceMax !== "") {
        const max = Number(filterPriceMax);
        if (!isNaN(max) && p.price > max) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "category") cmp = a.category.localeCompare(b.category, "es");
      else if (sortField === "brand") cmp = (a.brand ?? "").localeCompare(b.brand ?? "", "es");
      else if (sortField === "model") cmp = (a.model ?? "").localeCompare(b.model ?? "", "es");
      else if (sortField === "name") cmp = a.name.localeCompare(b.name, "es");
      else if (sortField === "sku") cmp = a.sku.localeCompare(b.sku, "es");
      else if (sortField === "updatedAt") cmp = a.updatedAt.localeCompare(b.updatedAt);
      else if (sortField === "price") cmp = a.price - b.price;
      return sortDir === "asc" ? cmp : -cmp;
    });

  const productToDelete = deleteState
    ? products.find((p) => p.id === deleteState.productId)
    : null;

  const isBlocked = (deleteState?.blockingFlows.length ?? 0) > 0;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Stock / Productos</h1>
            <p className="text-slate-400 mt-1">
              Gestioná los productos disponibles para usar en flujos
            </p>
          </div>
          {activeTab === "products" && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
              aria-label="Nuevo producto"
            >
              <Plus className="size-5" />
              <span>Nuevo Producto</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-800/50 rounded-xl border border-slate-700 p-1 w-fit">
          <button onClick={() => setActiveTab("products")} className={tabClasses(activeTab === "products")}>
            <Package className="size-4" />
            Productos
          </button>
          <button onClick={() => setActiveTab("variant-types")} className={tabClasses(activeTab === "variant-types")}>
            <Tag className="size-4" />
            Tipos de variante
          </button>
          <button onClick={() => setActiveTab("discounts")} className={tabClasses(activeTab === "discounts")}>
            <Percent className="size-4" />
            Descuentos
          </button>
        </div>

        {/* Variant types tab */}
        {activeTab === "variant-types" && <VariantTypesPanel />}

        {/* Discounts tab */}
        {activeTab === "discounts" && <DiscountsPanel />}

        {/* Toolbar: search + sort + filter */}
        {activeTab === "products" && products.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-52 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por producto, código, marca, modelo…"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 pl-9 pr-9 py-2 text-sm text-white placeholder-slate-500 focus:border-[#dd7430] focus:ring-2 focus:ring-[#dd7430]/20 focus:outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {/* Sort field */}
              <select
                value={sortField}
                onChange={(e) => handleSortField(e.target.value as SortField)}
                className="rounded-lg border border-slate-700 bg-slate-800 text-sm text-slate-300 px-3 py-2 focus:border-[#dd7430] focus:outline-none"
                aria-label="Ordenar por"
              >
                <option value="category">Categoría</option>
                <option value="brand">Marca</option>
                <option value="model">Modelo</option>
                <option value="name">Nombre</option>
                <option value="sku">Código</option>
                <option value="updatedAt">Última actualización</option>
                <option value="price">Precio base</option>
              </select>

              {/* Sort direction */}
              <button
                onClick={toggleSortDir}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
                aria-label={sortDir === "asc" ? "Orden ascendente" : "Orden descendente"}
              >
                {sortDir === "asc" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
                {sortDir === "asc" ? "Asc" : "Desc"}
              </button>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  showFilters || activeFilterCount > 0
                    ? "border-[#dd7430]/40 bg-[#dd7430]/10 text-[#dd7430]"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-600"
                }`}
                aria-label="Mostrar filtros"
              >
                <SlidersHorizontal className="size-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-[#dd7430] text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Filter panel */}
            {showFilters && (
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-4">
                <div className="flex flex-wrap gap-6">
                  {/* Categoría */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-400">Categoría</p>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-[#dd7430] focus:outline-none"
                    >
                      <option value="">Todas</option>
                      {uniqueCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Marca */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-400">Marca</p>
                    <select
                      value={filterBrand}
                      onChange={(e) => setFilterBrand(e.target.value)}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-[#dd7430] focus:outline-none"
                    >
                      <option value="">Todas</option>
                      {uniqueBrands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Modelo */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-400">Modelo</p>
                    <select
                      value={filterModel}
                      onChange={(e) => setFilterModel(e.target.value)}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-[#dd7430] focus:outline-none"
                    >
                      <option value="">Todos</option>
                      {uniqueModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Variantes */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-400">Variantes</p>
                    <div className="flex gap-1.5">
                      {(["yes", "no"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setFilterVariants(filterVariants === v ? null : v)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            filterVariants === v
                              ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                              : "border-slate-600 text-slate-400 hover:text-white hover:border-slate-500"
                          }`}
                        >
                          {v === "yes" ? "Con variantes" : "Sin variantes"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Descuentos */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-400">Descuentos</p>
                    <div className="flex gap-1.5">
                      {(["yes", "no"] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setFilterDiscounts(filterDiscounts === v ? null : v)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            filterDiscounts === v
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                              : "border-slate-600 text-slate-400 hover:text-white hover:border-slate-500"
                          }`}
                        >
                          {v === "yes" ? "Con descuento" : "Sin descuento"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Precio base */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-400">Precio base</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={filterPriceMin}
                        onChange={(e) => setFilterPriceMin(e.target.value)}
                        placeholder="Mín"
                        className="w-24 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none"
                      />
                      <span className="text-slate-600 text-xs">—</span>
                      <input
                        type="number"
                        min="0"
                        value={filterPriceMax}
                        onChange={(e) => setFilterPriceMax(e.target.value)}
                        placeholder="Máx"
                        className="w-24 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#dd7430] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <div className="flex justify-end border-t border-slate-700 pt-3">
                    <button
                      onClick={clearFilters}
                      className="text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Product list */}
        {activeTab === "products" && (products.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 py-16 backdrop-blur-sm">
            <Package className="size-12 text-slate-600 mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Sin productos todavía
            </h2>
            <p className="text-slate-400 text-center max-w-md mb-6">
              Creá tu primer producto para poder usarlo en los flujos de atención.
            </p>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
              aria-label="Agregar primer producto"
            >
              <Plus className="size-5" />
              <span>Agregar producto</span>
            </button>
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 py-12 backdrop-blur-sm">
            <Search className="size-10 text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-white mb-1">Sin resultados</h3>
            <p className="text-slate-400 text-sm text-center max-w-xs mb-4">
              No hay productos que coincidan con los criterios aplicados.
            </p>
            <div className="flex gap-3">
              {search && (
                <button onClick={() => setSearch("")} className="text-sm text-[#dd7430] hover:underline">
                  Limpiar búsqueda
                </button>
              )}
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-sm text-[#dd7430] hover:underline">
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Marca</th>
                  <th className="px-4 py-3 font-medium">Modelo</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Precio</th>
                  <th className="px-4 py-3 font-medium w-20" />
                </tr>
              </thead>
              <tbody>
                {displayProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-4 py-4">
                      <span className="font-mono text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded text-xs">
                        {product.sku}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white font-medium">{product.name}</td>
                    <td className="px-4 py-4 text-slate-400 max-w-48 truncate">{product.description || <span className="text-slate-600 italic">—</span>}</td>
                    <td className="px-4 py-4 text-slate-300">{product.brand || <span className="text-slate-600 italic">—</span>}</td>
                    <td className="px-4 py-4 text-slate-300">{product.model || <span className="text-slate-600 italic">—</span>}</td>
                    <td className="px-4 py-4">
                      {product.category ? (
                        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300">
                          {product.category}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {product.price > 0 ? (() => {
                        const applied = discounts.filter((d) => product.discountIds?.includes(d.id));
                        const totalPct = applied.length > 0
                          ? Math.min(100, applied.reduce((sum, d) => sum + d.percentage, 0))
                          : 0;
                        const finalPrice = product.price * (1 - totalPct / 100);
                        return (
                          <div className="space-y-0.5">
                            <span className={`font-medium ${totalPct > 0 ? "text-slate-500 line-through text-xs" : "text-emerald-400"}`}>
                              $ {product.price.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {totalPct > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-emerald-400 font-medium">
                                  $ {finalPrice.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-xs text-emerald-600">−{totalPct % 1 === 0 ? totalPct : totalPct.toFixed(2)}%</span>
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        <span className="text-slate-600 text-xs italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(product)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          aria-label={`Editar ${product.name}`}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => requestDelete(product)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label={`Eliminar ${product.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ))}
      </div>

      <ProductModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editingProduct={editingProduct}
      />

      {/* Delete dialog */}
      {deleteState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteState(null)}
            aria-hidden="true"
          />

          <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
            {isBlocked ? (
              /* ── Blocked: flows with stock tools ── */
              <div className="p-6">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="size-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      No se puede eliminar este producto
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Los siguientes flujos tienen acciones de stock (consulta o reserva) que
                      podrían estar usando{" "}
                      <span className="font-mono text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded text-xs">
                        {productToDelete?.sku}
                      </span>
                      . Eliminá primero las acciones de stock de estos flujos.
                    </p>
                  </div>
                </div>

                <ul className="mb-5 space-y-2 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  {deleteState.blockingFlows.map((flow) => (
                    <li key={flow.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <GitBranch className="size-4 shrink-0 text-slate-500" />
                        <span className="truncate text-sm text-slate-300">{flow.name}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            flow.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-slate-700 text-slate-400"
                          }`}
                        >
                          {flow.status === "active" ? "Activo" : flow.status}
                        </span>
                      </div>
                      <Link
                        href={`/flows/${flow.id}`}
                        className="flex shrink-0 items-center gap-1 text-xs text-[#dd7430] hover:underline"
                        onClick={() => setDeleteState(null)}
                      >
                        <ExternalLink className="size-3" />
                        Abrir
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-end">
                  <button
                    onClick={() => setDeleteState(null)}
                    className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 transition-colors"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            ) : (
              /* ── Normal confirmation ── */
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  ¿Eliminar producto?
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                  Se eliminará{" "}
                  <span className="text-white font-medium">{productToDelete?.name}</span>{" "}
                  <span className="font-mono text-sky-400 text-xs bg-sky-400/10 px-1.5 py-0.5 rounded">
                    {productToDelete?.sku}
                  </span>
                  . Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteState(null)}
                    className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800/50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
