"use client";

import { createContext, useContext } from "react";

export interface SimulationHighlight {
  currentNodeId: string | null;
  visitedNodeIds: string[];
}

const SimulationHighlightContext = createContext<SimulationHighlight>({
  currentNodeId: null,
  visitedNodeIds: [],
});

export const SimulationHighlightProvider = SimulationHighlightContext.Provider;

/**
 * Hook for node components to check their simulation state.
 * Returns border class string based on simulation / selection state.
 */
export function useSimulationBorder(
  nodeId: string,
  selected: boolean,
  selectedClass: string,
  defaultClass: string
): string {
  const ctx = useContext(SimulationHighlightContext);

  if (ctx.currentNodeId === nodeId) {
    return "border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg shadow-emerald-500/20";
  }
  if (ctx.visitedNodeIds.includes(nodeId)) {
    return "border-emerald-500/40";
  }
  return selected ? selectedClass : defaultClass;
}
