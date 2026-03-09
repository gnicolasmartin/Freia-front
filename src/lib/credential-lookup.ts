/**
 * credential-lookup.ts
 *
 * Server-side helper to resolve WhatsApp credentials from the backend
 * channel_configs table. Used by webhook and send API routes for multi-tenant.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export interface ChannelCredentials {
  companyId: string;
  phoneNumberId: string;
  accessToken: string;
  appSecret?: string;
}

interface LookupResponse {
  found: boolean;
  channel?: {
    id: string;
    companyId: string;
    metadata: Record<string, string> | null;
  };
}

/**
 * Lookup WhatsApp credentials by phone_number_id from the backend DB.
 * Returns null if no matching channel config is found.
 */
export async function lookupByPhoneNumberId(
  phoneNumberId: string
): Promise<ChannelCredentials | null> {
  try {
    const res = await fetch(
      `${API_URL}/channels/lookup/${encodeURIComponent(phoneNumberId)}`,
      { next: { revalidate: 60 } } // cache for 60s
    );
    if (!res.ok) return null;

    const data = (await res.json()) as LookupResponse;
    if (!data.found || !data.channel?.metadata) return null;

    const { metadata, companyId } = data.channel;
    if (!metadata.phone_number_id || !metadata.access_token) return null;

    return {
      companyId,
      phoneNumberId: metadata.phone_number_id,
      accessToken: metadata.access_token,
      appSecret: metadata.app_secret,
    };
  } catch (err) {
    console.error(
      `[CredentialLookup] Failed to lookup phone_number_id=${phoneNumberId}:`,
      err
    );
    return null;
  }
}

interface ChannelConfigResponse {
  id: string;
  companyId: string;
  channel: string;
  metadata: Record<string, string> | null;
}

/**
 * Lookup WhatsApp credentials by companyId from the backend DB.
 * Returns null if no matching channel config is found.
 */
export async function lookupByCompanyId(
  companyId: string
): Promise<ChannelCredentials | null> {
  try {
    const res = await fetch(
      `${API_URL}/channels?companyId=${encodeURIComponent(companyId)}`
    );
    if (!res.ok) return null;

    const channels = (await res.json()) as ChannelConfigResponse[];
    const waChannel = channels.find((c) => c.channel === "whatsapp");
    if (!waChannel?.metadata?.phone_number_id || !waChannel.metadata.access_token)
      return null;

    return {
      companyId,
      phoneNumberId: waChannel.metadata.phone_number_id,
      accessToken: waChannel.metadata.access_token,
      appSecret: waChannel.metadata.app_secret,
    };
  } catch (err) {
    console.error(
      `[CredentialLookup] Failed to lookup companyId=${companyId}:`,
      err
    );
    return null;
  }
}
