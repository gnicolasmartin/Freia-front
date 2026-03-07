import type { ChannelScope } from "./agent";

export type ChannelConnectionStatus = "connected" | "disconnected" | "not_required";

export interface ChannelConfig {
  channel: ChannelScope;
  /** Whether this channel is enabled for use in agents/flows. */
  enabled: boolean;
  /**
   * Channels like WhatsApp, Instagram, Facebook require OAuth / API credentials.
   * Web and Email do not.
   */
  requiresConnection: boolean;
  connectionStatus: ChannelConnectionStatus;
  connectedAt?: string;
  /** Channel-specific metadata (e.g. phone number, account name). */
  metadata?: Record<string, string>;
}

export interface ChannelMeta {
  label: string;
  description: string;
  /** Shown inside the connect form. */
  connectDescription?: string;
  iconBgClass: string;
  iconTextClass: string;
  borderClass: string;
}

export const CHANNEL_META: Record<ChannelScope, ChannelMeta> = {
  web: {
    label: "Web Chat",
    description: "Chat embebido en tu sitio web o aplicación.",
    iconBgClass: "bg-sky-500/20",
    iconTextClass: "text-sky-400",
    borderClass: "border-sky-500/30",
  },
  whatsapp: {
    label: "WhatsApp",
    description: "Conecta con clientes vía WhatsApp Business API.",
    connectDescription:
      "Requiere un número de teléfono empresarial registrado en Meta Business y acceso a la WhatsApp Business API.",
    iconBgClass: "bg-emerald-500/20",
    iconTextClass: "text-emerald-400",
    borderClass: "border-emerald-500/30",
  },
  instagram: {
    label: "Instagram",
    description: "Recibe y responde mensajes directos de Instagram.",
    connectDescription:
      "Requiere cuenta de Instagram Business y autorización de Meta.",
    iconBgClass: "bg-pink-500/20",
    iconTextClass: "text-pink-400",
    borderClass: "border-pink-500/30",
  },
  facebook: {
    label: "Facebook Messenger",
    description: "Gestiona conversaciones de Facebook Messenger.",
    connectDescription:
      "Requiere Página de Facebook vinculada a una app de Meta.",
    iconBgClass: "bg-blue-500/20",
    iconTextClass: "text-blue-400",
    borderClass: "border-blue-500/30",
  },
  email: {
    label: "Email",
    description: "Gestiona conversaciones por correo electrónico.",
    iconBgClass: "bg-amber-500/20",
    iconTextClass: "text-amber-400",
    borderClass: "border-amber-500/30",
  },
};

/** Factory — creates the initial channel registry. */
export const DEFAULT_CHANNEL_CONFIGS: ChannelConfig[] = [
  {
    channel: "web",
    enabled: true,
    requiresConnection: false,
    connectionStatus: "not_required",
  },
  {
    channel: "whatsapp",
    enabled: false,
    requiresConnection: true,
    connectionStatus: "disconnected",
  },
  {
    channel: "instagram",
    enabled: false,
    requiresConnection: true,
    connectionStatus: "disconnected",
  },
  {
    channel: "facebook",
    enabled: false,
    requiresConnection: true,
    connectionStatus: "disconnected",
  },
  {
    channel: "email",
    enabled: false,
    requiresConnection: false,
    connectionStatus: "not_required",
  },
];
