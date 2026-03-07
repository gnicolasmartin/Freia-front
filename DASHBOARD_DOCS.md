# Freia Dashboard - Documentación

## Estructura General

La aplicación está organizada en dos secciones principales:

1. **Página de Login** (`/`) - Acceso público
2. **Área Autenticada** (`/(authenticated)`) - Páginas protegidas con navegación

## Archivos Creados

### 1. Componentes Reutilizables (`src/components/`)

#### **Sidebar.tsx**
Navegación principal de la aplicación:
- Desktop: Sidebar fijo con logo y menú
- Mobile: Menú hamburguesa que se desliza
- Menú items: Dashboard, Agentes, Conversaciones, Leads, Configuraciones
- Indicador de página activa con color orange (#dd7430)
- Sección de usuario con opción de logout
- Responsive en todos los breakpoints

#### **StatCard.tsx**
Tarjeta reutilizable para mostrar estadísticas:
- Título de la métrica
- Valor principal (grande y llamativo)
- Icono personalizado
- Cambio porcentual comparado a período anterior
- Descripción adicional opcional
- Colores adaptativos según el tipo de métrica

#### **LineChart.tsx**
Gráfico de línea SVG personalizado:
- Visualización de datos por período (día, semana, mes)
- Selector de período interactivo
- Gradient fill bajo la línea
- Grid lines para fácil lectura
- Puntos de datos interactivos
- Etiquetas en eje X y valores en eje Y

#### **InconclusiveConversions.tsx**
Componente para mostrar conversiones inconclusas:
- Lista de razones por qué fallan conversiones
- Barras de progreso con porcentaje
- Recuento absoluto de conversaciones
- Colores en gradiente naranja/amarillo

#### **FAQsAndKeywords.tsx**
Palabras clave y temas frecuentes:
- Listado de keywords más mencionados
- Contador de menciones
- Indicador de tendencia (sube/baja/estable)
- Sugerencia de mejora en alert box
- Ordenado por popularidad

#### **AverageConversationTime.tsx**
Tiempo promedio de conversaciones:
- Tiempo promedio destacado
- Conversación más corta y más larga
- Total de conversaciones procesadas
- Comparativa con período anterior
- Iconografía clara con Clock

### 2. Layouts

#### **app/layout.tsx** (Root Layout)
- Configuración global de la aplicación
- Fuentes (Geist Sans/Mono)
- Metadatos SEO
- Viewport configuration
- Gradiente de fondo

#### **(authenticated)/layout.tsx** (Authenticated Layout)
- Envuelve todas las páginas protegidas
- Importa Sidebar automáticamente
- Responsive: Sidebar sidebar desktop, hamburger mobile
- Padding adaptado para mobile vs desktop
- Scroll automático en main content

### 3. Páginas

#### **app/page.tsx** - Login
- Componente reutilizable y funcional
- Validación de campos (email/username, password)
- En submit → redirección a `/dashboard`
- Estados: idle, loading (con spinner), error

#### **(authenticated)/dashboard/page.tsx** - Dashboard Principal
**Indicadores principales:**
1. **Comunicaciones Activas** - Contador en tiempo real (1,247)
2. **Conversiones Completadas** - Estadística semanal (328)
3. **Tasa de Conversión** - Porcentaje (42.5%)
4. **Conversiones Inconclusas** - Pendientes de seguimiento (700)

**Gráficos:**
- Comunicaciones por Período (Día/Semana/Mes)
- Conversiones por Período (Día/Semana/Mes)
- Botones de período intercambiables

**Secciones adicionales:**
- Razones de conversiones inconclusas (5 causas principales)
- Tiempo promedio de conversación (3:27 minutos)
- FAQs y menciones frecuentes (5 keywords principales)
- Estado del sistema (última actualización, status, agentes activos)

#### **(authenticated)/agents/page.tsx** - Gestión de Agentes
- Página placeholder con estructura consistent
- Botón "Nuevo Agente"
- Descripción de funcionalidad

#### **(authenticated)/conversations/page.tsx** - Historial de Conversaciones
- Buscador de conversaciones
- Página placeholder
- Grid para futuro listado

#### **(authenticated)/leads/page.tsx** - Gestión de Leads
- Botones: Filtrar, Nuevo Lead
- Estructura lista para tabla de leads
- Página placeholder

#### **(authenticated)/settings/page.tsx** - Configuraciones
- **General**: Nombre empresa, email contacto
- **API Keys**: Generador de claves
- **Notificaciones**: Checkboxes para alertas
- **Guardar cambios**: Botón principal

## Flujo de Usuario

```
1. Usuario accede a http://localhost:3000
   ↓
2. Ve página de LOGIN
   ├── Ingresa email/username y password
   ├── Valida campos
   └── Si válido → redirección a /dashboard
   
3. HOME (DASHBOARD)
   ├── Ve Sidebar con navegación
   ├── Panel con estadísticas principales
   ├── Gráficos interactivos por período
   ├── Análisis de conversiones inconclusas
   ├── FAQs frecuentes
   └── Tiempo de conversación promedio

4. Puede navegar a:
   ├── Agentes (lista de agentes IA)
   ├── Conversaciones (historial completo)
   ├── Leads (gestión de oportunidades)
   └── Configuraciones (account settings)
```

## Características Implementadas

✅ **UI/UX**
- Dark mode profesional con paleta Freia
- Responsive design (mobile, tablet, desktop)
- Transiciones suaves y animaciones
- Indicadores visuales de estado

✅ **Funcionalidad**
- Navegación funcional y fluida
- Cambio de período en gráficos (día/semana/mes)
- Indicadores de tendencia (↑ ↓ →)
- Contador de conversiones inconclusas por razón

✅ **Accesibilidad**
- ARIA labels en componentes interactivos
- Keyboard navigation
- Focus rings personalizados
- Role attributes en elementos

✅ **Performance**
- Server Components donde es posible
- Client Components donde se requiere interacción
- Optimización de images con Next.js
- Build exitoso en 2.2 segundos

## Datos Mock

Todos los datos en el dashboard son simulados:
- **Comunicaciones**: 1,247 activas
- **Conversiones**: 328 completadas, 700 inconclusas
- **Tasa**: 42.5%
- **Tiempo promedio**: 3:27 minutos
- **Agentes**: 5 activos

Estos pueden ser reemplazados con datos reales conectando con el backend Nest.js.

## Próximos Pasos (Recomendaciones)

1. **Backend Integration**
   - Conectar con API de Nest.js
   - Implementar autenticación real (JWT tokens)
   - Fetch de datos dinámicos en lugar de mock data

2. **Auth Context**
   - Crear contexto React para estado de autenticación
   - Middleware para proteger rutas
   - Persistencia de sesión

3. **Real-time Updates**
   - WebSockets para comunicaciones activas
   - SSE para notificaciones

4. **Database Connection**
   - Implementar tablas en Conversaciones y Leads
   - Paginación y filtering
   - Búsqueda por keywords

5. **Charts Library**
   - Considerar recharts o Visx para gráficos más complejos
   - Exportar datos a PDF/CSV

## Variables y Colores

```css
--primary: #193749 (Deep Corporate Blue)
--accent: #dd7430 (Orange Vibrant)
--background: Gradient (slate-900 → slate-800)
--text: white / slate-400
--borders: slate-700
```

## Estructura de Carpetas

```
src/
├── app/
│   ├── page.tsx                          # Login page
│   ├── layout.tsx                        # Root layout
│   ├── globals.css                       # Estilos globales
│   └── (authenticated)/
│       ├── layout.tsx                    # Auth layout con Sidebar
│       ├── dashboard/
│       │   └── page.tsx                  # Dashboard principal
│       ├── agents/
│       │   └── page.tsx                  # Agentes
│       ├── conversations/
│       │   └── page.tsx                  # Conversaciones
│       ├── leads/
│       │   └── page.tsx                  # Leads
│       └── settings/
│           └── page.tsx                  # Configuraciones
└── components/
    ├── Sidebar.tsx
    ├── StatCard.tsx
    ├── LineChart.tsx
    ├── InconclusiveConversions.tsx
    ├── FAQsAndKeywords.tsx
    └── AverageConversationTime.tsx
```
