/**
 * server-send-fn.ts
 *
 * Builds a SendMessageFn that calls the WhatsApp Cloud API directly
 * (via whatsapp-sender.ts) instead of going through the browser-side
 * /api/channels/whatsapp/send route.
 *
 * Used by the webhook route to process messages server-side.
 */

import type { SendMessageFn, WACredentials } from "./message-processor";
import {
  sendWhatsAppTextWithRetry,
  sendWhatsAppButtons,
  sendWhatsAppList,
} from "./whatsapp-sender";

interface InteractivePayload {
  type: "buttons" | "list";
  buttons?: Array<{ id: string; title: string }>;
  buttonTitle?: string;
  rows?: Array<{ id: string; title: string; description?: string }>;
}

/**
 * Normalize Argentine phone numbers for the WhatsApp Cloud API.
 * Inbound messages arrive with "9" (e.g. 5491160527827),
 * but outbound sends require it without (e.g. 541160527827).
 */
function normalizePhoneForSend(phone: string): string {
  if (phone.startsWith("549") && phone.length === 13) {
    return "54" + phone.slice(3);
  }
  return phone;
}

/**
 * Build a SendMessageFn that calls the WhatsApp API directly.
 * The returned function matches the SendMessageFn signature expected
 * by processInboundMessage.
 */
export function buildServerSendFn(
  phoneNumberId: string,
  accessToken: string
): SendMessageFn {
  return async (
    to: string,
    text: string,
    _credentials: WACredentials | null,
    testMode: boolean,
    interactive?: InteractivePayload
  ) => {
    const normalizedTo = normalizePhoneForSend(to);

    if (testMode) {
      console.info(
        `[ServerSend] TEST MODE — would send to ${normalizedTo}: "${text.slice(0, 80)}..."`
      );
      return { success: true, messageId: `wamid.test.${Date.now()}` };
    }

    try {
      // Buttons (up to 3)
      if (
        interactive?.type === "buttons" &&
        interactive.buttons?.length
      ) {
        const r = await sendWhatsAppButtons(
          normalizedTo,
          text,
          interactive.buttons,
          phoneNumberId,
          accessToken
        );
        return { success: true, messageId: r.messageId };
      }

      // List (>3 options)
      if (
        interactive?.type === "list" &&
        interactive.rows?.length
      ) {
        const r = await sendWhatsAppList(
          normalizedTo,
          text,
          interactive.buttonTitle ?? "Ver opciones",
          interactive.rows,
          phoneNumberId,
          accessToken
        );
        return { success: true, messageId: r.messageId };
      }

      // Plain text (with retry)
      const r = await sendWhatsAppTextWithRetry(
        normalizedTo,
        text,
        phoneNumberId,
        accessToken
      );
      return { success: true, messageId: r.messageId };
    } catch (err) {
      console.error("[ServerSend] Error:", err);
      return { success: false, error: String(err) };
    }
  };
}
