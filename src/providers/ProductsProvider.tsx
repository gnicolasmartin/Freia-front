"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Product, VariantType, Discount } from "@/types/product";
import { addStockAuditEntry } from "@/lib/stock-audit";
import { getSessionCompanyId } from "@/lib/get-session-company";
import type { StockAuditChange } from "@/types/stock-audit";

const AUDIT_USER = "Admin";

interface ProductsContextType {
  products: Product[];
  addProduct: (product: Omit<Product, "id" | "createdAt" | "updatedAt">) => void;
  updateProduct: (id: string, updates: Partial<Omit<Product, "id" | "createdAt">>) => void;
  deleteProduct: (id: string) => void;

  variantTypes: VariantType[];
  addVariantType: (data: Omit<VariantType, "id" | "createdAt" | "updatedAt">) => void;
  updateVariantType: (id: string, data: Omit<VariantType, "id" | "createdAt" | "updatedAt">) => void;
  deleteVariantType: (id: string) => void;
  /** Returns products that reference this variant type (for dependency check). */
  getVariantTypeUsage: (variantTypeId: string) => Product[];

  discounts: Discount[];
  addDiscount: (data: Omit<Discount, "id" | "createdAt" | "updatedAt">) => void;
  updateDiscount: (id: string, data: Omit<Discount, "id" | "createdAt" | "updatedAt">) => void;
  deleteDiscount: (id: string) => void;
  /** Returns products that reference this discount. */
  getDiscountUsage: (discountId: string) => Product[];
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

const PRODUCTS_KEY = "freia_products";
const VARIANT_TYPES_KEY = "freia_variant_types";
const DISCOUNTS_KEY = "freia_discounts";

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  useEffect(() => {
    const storedProducts = localStorage.getItem(PRODUCTS_KEY);
    if (storedProducts) {
      try { setProducts(JSON.parse(storedProducts)); } catch { localStorage.removeItem(PRODUCTS_KEY); }
    }
    const storedVariantTypes = localStorage.getItem(VARIANT_TYPES_KEY);
    if (storedVariantTypes) {
      try { setVariantTypes(JSON.parse(storedVariantTypes)); } catch { localStorage.removeItem(VARIANT_TYPES_KEY); }
    }
    const storedDiscounts = localStorage.getItem(DISCOUNTS_KEY);
    if (storedDiscounts) {
      try { setDiscounts(JSON.parse(storedDiscounts)); } catch { localStorage.removeItem(DISCOUNTS_KEY); }
    }
  }, []);

  const persistProducts = (updated: Product[]) => {
    setProducts(updated);
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(updated));
  };

  const persistVariantTypes = (updated: VariantType[]) => {
    setVariantTypes(updated);
    localStorage.setItem(VARIANT_TYPES_KEY, JSON.stringify(updated));
  };

  const persistDiscounts = (updated: Discount[]) => {
    setDiscounts(updated);
    localStorage.setItem(DISCOUNTS_KEY, JSON.stringify(updated));
  };

  // ── Products ──────────────────────────────────────────────

  const addProduct = (data: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    const newProduct = { ...data, companyId: data.companyId ?? getSessionCompanyId(), id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persistProducts([...products, newProduct]);
    addStockAuditEntry({
      action: "product_created",
      entityType: "product",
      entityId: newProduct.id,
      entityName: data.name,
      userName: AUDIT_USER,
    });
  };

  const updateProduct = (id: string, updates: Partial<Omit<Product, "id" | "createdAt">>) => {
    const prev = products.find((p) => p.id === id);
    persistProducts(
      products.map((p) => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p)
    );
    if (prev) {
      const changes: StockAuditChange[] = [];
      const tracked: (keyof Product)[] = ["name", "sku", "price", "stock", "description", "category", "unit", "brand", "model"];
      for (const field of tracked) {
        const oldVal = String(prev[field] ?? "");
        const newVal = String((updates as Record<string, unknown>)[field] ?? prev[field] ?? "");
        if (oldVal !== newVal) changes.push({ field, oldValue: oldVal, newValue: newVal });
      }
      addStockAuditEntry({
        action: "product_updated",
        entityType: "product",
        entityId: id,
        entityName: (updates.name ?? prev.name),
        userName: AUDIT_USER,
        changes: changes.length > 0 ? changes : undefined,
      });
    }
  };

  const deleteProduct = (id: string) => {
    const prev = products.find((p) => p.id === id);
    persistProducts(products.filter((p) => p.id !== id));
    if (prev) {
      addStockAuditEntry({
        action: "product_deleted",
        entityType: "product",
        entityId: id,
        entityName: prev.name,
        userName: AUDIT_USER,
      });
    }
  };

  // ── Variant Types ─────────────────────────────────────────

  const addVariantType = (data: Omit<VariantType, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    const newVT = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persistVariantTypes([...variantTypes, newVT]);
    addStockAuditEntry({
      action: "variant_type_created",
      entityType: "variant_type",
      entityId: newVT.id,
      entityName: data.name,
      userName: AUDIT_USER,
    });
  };

  const updateVariantType = (id: string, data: Omit<VariantType, "id" | "createdAt" | "updatedAt">) => {
    const prev = variantTypes.find((vt) => vt.id === id);
    persistVariantTypes(
      variantTypes.map((vt) =>
        vt.id === id ? { ...vt, ...data, updatedAt: new Date().toISOString() } : vt
      )
    );
    if (prev) {
      const changes: StockAuditChange[] = [];
      if (prev.name !== data.name) changes.push({ field: "name", oldValue: prev.name, newValue: data.name });
      if (prev.key !== data.key) changes.push({ field: "key", oldValue: prev.key, newValue: data.key });
      addStockAuditEntry({
        action: "variant_type_updated",
        entityType: "variant_type",
        entityId: id,
        entityName: data.name,
        userName: AUDIT_USER,
        changes: changes.length > 0 ? changes : undefined,
      });
    }
  };

  const deleteVariantType = (id: string) => {
    const prev = variantTypes.find((vt) => vt.id === id);
    persistVariantTypes(variantTypes.filter((vt) => vt.id !== id));
    if (prev) {
      addStockAuditEntry({
        action: "variant_type_deleted",
        entityType: "variant_type",
        entityId: id,
        entityName: prev.name,
        userName: AUDIT_USER,
      });
    }
  };

  const getVariantTypeUsage = (variantTypeId: string): Product[] =>
    products.filter((p) => p.variantTypeIds?.includes(variantTypeId));

  // ── Discounts ─────────────────────────────────────────────

  const addDiscount = (data: Omit<Discount, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    const newDiscount = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persistDiscounts([...discounts, newDiscount]);
    addStockAuditEntry({
      action: "discount_created",
      entityType: "discount",
      entityId: newDiscount.id,
      entityName: data.name,
      userName: AUDIT_USER,
    });
  };

  const updateDiscount = (id: string, data: Omit<Discount, "id" | "createdAt" | "updatedAt">) => {
    const prev = discounts.find((d) => d.id === id);
    persistDiscounts(
      discounts.map((d) => d.id === id ? { ...d, ...data, updatedAt: new Date().toISOString() } : d)
    );
    if (prev) {
      const changes: StockAuditChange[] = [];
      if (prev.name !== data.name) changes.push({ field: "name", oldValue: prev.name, newValue: data.name });
      if (prev.percentage !== data.percentage) changes.push({ field: "percentage", oldValue: String(prev.percentage), newValue: String(data.percentage) });
      if (prev.description !== data.description) changes.push({ field: "description", oldValue: prev.description, newValue: data.description });
      addStockAuditEntry({
        action: "discount_updated",
        entityType: "discount",
        entityId: id,
        entityName: data.name,
        userName: AUDIT_USER,
        changes: changes.length > 0 ? changes : undefined,
      });
    }
  };

  const deleteDiscount = (id: string) => {
    const prev = discounts.find((d) => d.id === id);
    persistDiscounts(discounts.filter((d) => d.id !== id));
    // Auto-unassign from all products that reference this discount
    const now = new Date().toISOString();
    persistProducts(
      products.map((p) =>
        p.discountIds?.includes(id)
          ? { ...p, discountIds: p.discountIds.filter((dId) => dId !== id), updatedAt: now }
          : p
      )
    );
    if (prev) {
      addStockAuditEntry({
        action: "discount_deleted",
        entityType: "discount",
        entityId: id,
        entityName: prev.name,
        userName: AUDIT_USER,
      });
    }
  };

  const getDiscountUsage = (discountId: string): Product[] =>
    products.filter((p) => p.discountIds?.includes(discountId));

  return (
    <ProductsContext.Provider value={{
      products, addProduct, updateProduct, deleteProduct,
      variantTypes, addVariantType, updateVariantType, deleteVariantType, getVariantTypeUsage,
      discounts, addDiscount, updateDiscount, deleteDiscount, getDiscountUsage,
    }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (context === undefined) throw new Error("useProducts debe ser usado dentro de ProductsProvider");
  return context;
}
