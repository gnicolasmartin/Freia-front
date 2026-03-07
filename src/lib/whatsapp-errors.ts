/**
 * whatsapp-errors.ts
 *
 * Maps WhatsApp Business API error codes to actionable Spanish-language suggestions.
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */

const ERROR_SUGGESTIONS: Record<number, string> = {
  // Rate limiting
  130429: "Rate limit excedido. Espera unos minutos antes de reintentar.",
  131056: "Demasiados mensajes enviados en poco tiempo. Reduce la frecuencia de envío.",
  80007:  "Límite de tasa de la API alcanzado. Espera antes de reintentar.",

  // Recipient issues
  131026: "El número no está registrado en WhatsApp. Verifica el destinatario.",
  131053: "El destinatario bloqueó tu número. No se pueden enviar mensajes a este contacto.",
  131045: "Número del destinatario no registrado. Verifica que sea un número de WhatsApp activo.",

  // Conversation window / compliance
  131047: "Ventana de 24h cerrada. Usa un template aprobado para iniciar esta conversación.",
  131016: "No se puede reabrir la conversación. Envía un template para contactar al usuario.",

  // Account / permission issues
  131031: "Cuenta de negocio suspendida o marcada. Revisa el estado en Meta Business Suite.",
  131042: "Problema de pago con la cuenta de negocio. Verifica tu suscripción en Meta.",
  131048: "Número remitente limitado. Puede haber detección de spam o uso inapropiado.",
  368:    "Cuenta temporalmente bloqueada por violaciones de política. Contacta al soporte de Meta.",

  // Template errors
  132001: "Template no encontrado. Verifica el nombre y el código de idioma del template.",
  132000: "Cantidad de parámetros no coincide con el template. Revisa las variables enviadas.",
  132005: "Error al hidratar el template. Verifica los valores de las variables.",
  132007: "Componentes del template inválidos. Revisa el formato y los parámetros.",
  132012: "Título del botón del template excede el límite de caracteres.",
  132015: "Template pausado por baja calidad. Revisá el contenido en Meta Business Manager.",
  132016: "Template desactivado. Actívalo desde el Meta Business Manager.",

  // Parameter / message issues
  131005: "Permiso denegado. Verifica que el token tenga los permisos necesarios.",
  131008: "Parámetro requerido faltante. Revisa el cuerpo de la solicitud.",
  131009: "Valor de parámetro inválido. Verifica el formato de los datos enviados.",
  131051: "Tipo de mensaje no soportado para este destinatario.",

  // Auth
  190:    "Token de acceso vencido o inválido. Actualiza el Access Token en configuración de canales.",
};

/**
 * Returns an actionable suggestion in Spanish for a given WhatsApp error code.
 * Falls back to a generic message when the code is unknown.
 */
export function getErrorSuggestion(code?: number): string {
  if (!code) {
    return "Verifica las credenciales y el estado de la cuenta en Meta Business Suite.";
  }
  return (
    ERROR_SUGGESTIONS[code] ??
    "Error desconocido. Consulta el código en la documentación de WhatsApp Business API."
  );
}
