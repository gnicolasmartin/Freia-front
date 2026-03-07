"use client";

import { Bell, X, AlertTriangle, CheckCheck } from "lucide-react";
import type { AdminNotification } from "@/types/integration";

interface NotificationsPanelProps {
  notifications: AdminNotification[];
  onDismiss: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

export default function NotificationsPanel({
  notifications,
  onDismiss,
  onMarkAllRead,
  onClose,
}: NotificationsPanelProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 shadow-2xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Bell className="size-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-white">Notificaciones</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold border border-red-700/30">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors px-1.5 py-1 rounded hover:bg-slate-700/50"
            >
              <CheckCheck className="size-3" />
              Marcar leídas
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-white transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Bell className="size-6 text-slate-600 mb-2" />
            <p className="text-xs text-slate-500">Sin notificaciones</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                  !n.read ? "bg-red-900/5" : ""
                }`}
              >
                <div className="flex size-6 items-center justify-center rounded-lg bg-red-900/20 border border-red-800/30 shrink-0 mt-0.5">
                  <AlertTriangle className="size-3 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-semibold text-white truncate">
                      {n.integrationName}
                    </span>
                    {!n.read && (
                      <span className="size-1.5 rounded-full bg-red-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{n.message}</p>
                  <p className="text-[9px] text-slate-600 mt-1">{relativeTime(n.failedAt)}</p>
                </div>
                <button
                  onClick={() => onDismiss(n.id)}
                  className="p-0.5 rounded text-slate-600 hover:text-slate-400 transition-colors shrink-0 mt-0.5"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
