"use client";

import {
  MessageSquare,
  HelpCircle,
  GitBranch,
  Wrench,
  UserCheck,
  Square,
  ShoppingCart,
} from "lucide-react";
import type { DragEvent } from "react";

const NODE_ITEMS = [
  {
    type: "message",
    label: "Message",
    icon: MessageSquare,
    color: "text-orange-400 bg-orange-500/20",
  },
  {
    type: "ask",
    label: "Ask",
    icon: HelpCircle,
    color: "text-cyan-400 bg-cyan-500/20",
  },
  {
    type: "condition",
    label: "Condition",
    icon: GitBranch,
    color: "text-blue-400 bg-blue-500/20",
  },
  {
    type: "toolcall",
    label: "Tool Call",
    icon: Wrench,
    color: "text-purple-400 bg-purple-500/20",
  },
  {
    type: "handoff",
    label: "Handoff",
    icon: UserCheck,
    color: "text-amber-400 bg-amber-500/20",
  },
  {
    type: "end",
    label: "End",
    icon: Square,
    color: "text-red-400 bg-red-500/20",
  },
] as const;

const STOCK_ITEMS = [
  {
    type: "stocklookup",
    label: "Stock Lookup",
    icon: ShoppingCart,
    color: "text-emerald-400 bg-emerald-500/20",
  },
] as const;

interface FlowToolbarProps {
  useStock?: boolean;
}

export default function FlowToolbar({ useStock = false }: FlowToolbarProps) {
  const onDragStart = (e: DragEvent, nodeType: string) => {
    e.dataTransfer.setData("application/reactflow", nodeType);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-48 shrink-0 border-r border-slate-700 bg-slate-900/80 p-4 space-y-2 overflow-y-auto">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Nodos
      </h3>
      {NODE_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800/50 cursor-grab active:cursor-grabbing hover:border-slate-600 hover:bg-slate-800 transition-colors"
          >
            <div
              className={`flex size-7 items-center justify-center rounded-lg ${item.color}`}
            >
              <Icon className="size-4" />
            </div>
            <span className="text-sm font-medium text-slate-300">
              {item.label}
            </span>
          </div>
        );
      })}

      {useStock && (
        <>
          <div className="pt-2 pb-1">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Catálogo
            </h3>
          </div>
          {STOCK_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-emerald-700/40 bg-emerald-900/20 cursor-grab active:cursor-grabbing hover:border-emerald-600/60 hover:bg-emerald-900/30 transition-colors"
              >
                <div
                  className={`flex size-7 items-center justify-center rounded-lg ${item.color}`}
                >
                  <Icon className="size-4" />
                </div>
                <span className="text-sm font-medium text-slate-300">
                  {item.label}
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
