"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useFrontData } from "@/providers/FrontDataProvider";
import type { FrontSection } from "@/types/front";
import type {
  WidgetDataBinding,
  WidgetGeneralConfig,
  DataTransform,
} from "@/types/front-widgets";

// --- Types ---

export type WidgetDataErrorType =
  | "no_bindings"
  | "no_data"
  | "insufficient_permissions"
  | "invalid_binding";

export interface WidgetDataError {
  type: WidgetDataErrorType;
  message: string;
}

export interface WidgetDataResult {
  /** Resolved data keyed by binding label or variableName */
  resolvedData: Record<string, unknown>;
  isLoading: boolean;
  error: WidgetDataError | null;
  lastUpdated: string | null;
  refresh: () => void;
}

// --- Transform helpers ---

function applyTransform(
  history: { timestamp: string; value: unknown }[],
  current: unknown,
  transform: DataTransform
): unknown {
  if (transform === "none" || transform === "last") {
    return current;
  }

  const numbers = history
    .map((h) => (typeof h.value === "number" ? h.value : NaN))
    .filter((n) => !isNaN(n));

  if (numbers.length === 0) return current;

  switch (transform) {
    case "sum":
      return numbers.reduce((a, b) => a + b, 0);
    case "avg":
      return Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 100) / 100;
    case "count":
      return numbers.length;
    default:
      return current;
  }
}

// --- Hook ---

export function useWidgetData(
  section: FrontSection,
  hasViewPermission: boolean
): WidgetDataResult {
  const frontData = useFrontData();
  const [resolvedData, setResolvedData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<WidgetDataError | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bindings = (section.config?._bindings as WidgetDataBinding[]) ?? [];
  const general = (section.config?._general as WidgetGeneralConfig) ?? undefined;
  const refreshSeconds = general?.refreshSeconds ?? 0;

  const resolve = useCallback(() => {
    // No bindings → no error, just empty (static data will be used)
    if (bindings.length === 0) {
      setResolvedData({});
      setError({ type: "no_bindings", message: "Sin data binding configurado" });
      return;
    }

    // Permission check
    if (!hasViewPermission) {
      setResolvedData({});
      setError({
        type: "insufficient_permissions",
        message: "No tienes permiso para ver los datos de este widget",
      });
      return;
    }

    const data: Record<string, unknown> = {};
    let hasAnyData = false;

    for (const binding of bindings) {
      if (!binding.flowId || !binding.variableName) {
        continue; // skip incomplete bindings
      }

      const current = frontData.getVariableValue(binding.flowId, binding.variableName);
      const history = frontData.getVariableHistory(binding.flowId, binding.variableName);

      if (current === undefined && history.length === 0) {
        continue; // no data for this binding
      }

      hasAnyData = true;
      const key = binding.label || binding.variableName;
      data[key] = applyTransform(history, current, binding.transform);
    }

    if (!hasAnyData && bindings.length > 0) {
      setResolvedData({});
      setError({
        type: "no_data",
        message: "No hay datos disponibles para los bindings configurados",
      });
      return;
    }

    setResolvedData(data);
    setError(null);
  }, [bindings, hasViewPermission, frontData]);

  // Resolve on mount and when deps change
  useEffect(() => {
    resolve();
  }, [resolve]);

  // Auto-refresh
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (refreshSeconds > 0 && bindings.length > 0 && hasViewPermission) {
      intervalRef.current = setInterval(() => {
        frontData.refreshData();
      }, refreshSeconds * 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshSeconds, bindings.length, hasViewPermission, frontData]);

  const refresh = useCallback(() => {
    frontData.refreshData();
  }, [frontData]);

  return {
    resolvedData,
    isLoading: frontData.isLoading,
    error,
    lastUpdated: frontData.lastUpdated,
    refresh,
  };
}
