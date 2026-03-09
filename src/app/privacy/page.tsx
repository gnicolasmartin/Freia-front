export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-200 px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-white">Política de Privacidad</h1>
      <p className="text-sm text-slate-400 mb-8">Última actualización: 9 de marzo de 2026</p>

      <section className="space-y-6 text-slate-300 leading-relaxed">
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">1. Introducción</h2>
          <p>
            Freia (&quot;nosotros&quot;, &quot;nuestro&quot;) es una plataforma de automatización de
            atención al cliente que se integra con canales de mensajería como WhatsApp. Esta política
            describe cómo recopilamos, usamos y protegemos la información procesada a través de
            nuestro servicio.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">2. Información que recopilamos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Número de teléfono del remitente y destinatario</li>
            <li>Nombre de perfil de WhatsApp (si está disponible)</li>
            <li>Contenido de los mensajes enviados y recibidos</li>
            <li>Metadatos de entrega (timestamps, estado del mensaje)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">3. Uso de la información</h2>
          <p>La información recopilada se utiliza exclusivamente para:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Procesar y responder mensajes de clientes</li>
            <li>Enrutar conversaciones al agente o flujo correspondiente</li>
            <li>Mejorar la calidad del servicio de atención</li>
            <li>Generar métricas agregadas de rendimiento</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">4. Almacenamiento y seguridad</h2>
          <p>
            Los datos se almacenan en servidores seguros con cifrado en tránsito (TLS) y en reposo.
            Las credenciales de acceso a canales se almacenan de forma cifrada y nunca se exponen en
            logs ni respuestas de API.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">5. Compartir información</h2>
          <p>
            No vendemos, alquilamos ni compartimos información personal con terceros, excepto cuando
            sea necesario para proveer el servicio (por ejemplo, enviar mensajes a través de la API
            de WhatsApp Business de Meta).
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">6. Retención de datos</h2>
          <p>
            Los mensajes y datos de conversación se retienen durante el período necesario para
            proveer el servicio. Los usuarios pueden solicitar la eliminación de sus datos
            contactándonos directamente.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">7. Derechos del usuario</h2>
          <p>Los usuarios tienen derecho a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Acceder a los datos personales que tenemos sobre ellos</li>
            <li>Solicitar la corrección de datos inexactos</li>
            <li>Solicitar la eliminación de sus datos</li>
            <li>Revocar el consentimiento para el procesamiento de datos</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">8. Contacto</h2>
          <p>
            Para consultas sobre esta política de privacidad o para ejercer sus derechos,
            contactarse a: <span className="text-orange-400">privacidad@freiatech.com</span>
          </p>
        </div>
      </section>
    </main>
  );
}
