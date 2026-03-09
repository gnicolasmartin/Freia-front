export interface ProductVariant {
  id: string;
  /** Map of variantType.key → value, e.g. { color: "Rojo", talle: "M" } */
  attributes: Record<string, string>;
  sku?: string;
  price?: number;
  createdAt: string;
}

export interface Product {
  id: string;
  companyId?: string;
  name: string;
  sku: string;
  description: string;
  brand: string;
  model: string;
  price: number;
  stock: number;
  unit: string;
  category: string;
  variantTypeIds?: string[];
  variants?: ProductVariant[];
  discountIds?: string[];
  createdAt: string;
  updatedAt: string;
  updatedBy?: { id: string; name: string };
}

export interface VariantType {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  updatedAt: string;
}

export interface Discount {
  id: string;
  name: string;
  percentage: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}
