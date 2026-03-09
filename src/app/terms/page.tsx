export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-200 px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-white">Términos y Condiciones</h1>
      <p className="text-sm text-slate-400 mb-8">Última actualización: 9 de marzo de 2026</p>

      <section className="space-y-6 text-slate-300 leading-relaxed">
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">1. Aceptación de los términos</h2>
          <p>
            Al utilizar Freia (&quot;el Servicio&quot;), aceptás estos términos y condiciones en su
            totalidad. Si no estás de acuerdo con alguna parte de estos términos, no debés utilizar
            el Servicio.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">2. Descripción del servicio</h2>
          <p>
            Freia es una plataforma de automatización de atención al cliente que permite gestionar
            conversaciones a través de canales de mensajería como WhatsApp. El Servicio incluye
            herramientas para configurar agentes virtuales, flujos conversacionales y reglas de
            enrutamiento.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">3. Uso aceptable</h2>
          <p>El usuario se compromete a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Utilizar el Servicio de acuerdo con las leyes aplicables</li>
            <li>No enviar mensajes no solicitados (spam) a través de la plataforma</li>
            <li>Cumplir con las políticas de uso de WhatsApp Business y Meta</li>
            <li>Mantener la confidencialidad de sus credenciales de acceso</li>
            <li>No intentar acceder a datos de otros usuarios del Servicio</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">4. Cuentas y credenciales</h2>
          <p>
            El usuario es responsable de mantener la seguridad de sus credenciales de acceso y de
            las claves de API configuradas en la plataforma. Freia no se hace responsable por
            accesos no autorizados derivados de la negligencia del usuario en la protección de sus
            credenciales.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">5. Propiedad intelectual</h2>
          <p>
            Todo el contenido, diseño y código del Servicio es propiedad de Freia. El usuario
            conserva la propiedad sobre los datos y contenidos que ingresa en la plataforma.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">6. Limitación de responsabilidad</h2>
          <p>
            Freia se proporciona &quot;tal cual&quot; sin garantías de ningún tipo. No nos hacemos
            responsables por interrupciones del servicio, pérdida de datos o daños indirectos
            derivados del uso de la plataforma. Esto incluye, pero no se limita a, fallos en la
            entrega de mensajes por parte de proveedores terceros como Meta/WhatsApp.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">7. Modificaciones</h2>
          <p>
            Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios
            serán efectivos desde su publicación en esta página. El uso continuado del Servicio
            después de la publicación de cambios constituye la aceptación de los nuevos términos.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">8. Terminación</h2>
          <p>
            Podemos suspender o cancelar el acceso al Servicio en cualquier momento si se detecta un
            uso que viole estos términos. El usuario puede dejar de usar el Servicio en cualquier
            momento.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white mb-2">9. Contacto</h2>
          <p>
            Para consultas sobre estos términos, contactarse a:{" "}
            <span className="text-orange-400">legal@freia.app</span>
          </p>
        </div>
      </section>
    </main>
  );
}
