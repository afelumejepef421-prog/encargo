# Módulo 1: Arquitectura y Aspectos Técnicos
**Plataforma de Intermediación de Servicios «Encargo»**
*Versión del Documento: 2.4.0 · Entorno: Producción Cloud Serverless (Firebase)*

---

## 1.1 Infraestructura en la Nube y Topología de Red

La plataforma **Encargo** opera bajo una arquitectura integralmente serverless montada sobre la infraestructura elástica de **Google Cloud Platform (GCP)** y **Firebase**, diseñada para garantizar alta disponibilidad (99.95% SLA), baja latencia y tolerancia a fallos en todo el territorio colombiano.

```
                      +------------------------------------------+
                      |   Cliente Web (Desktop / Tablet / Móvil) |
                      +------------------------------------------+
                                           |
                                [HTTPS / TLS 1.3]
                                           v
                      +------------------------------------------+
                      |    Firebase Hosting CDN Edge Network     |
                      |  (https://encargo-app-8a98f.web.app)     |
                      +------------------------------------------+
                               /                       \
             [Archivos Estáticos / SPA]       [Tokens JWT / Auth SDK]
                             /                           \
                            v                             v
           +-------------------------------+    +------------------------+
           | Single Page Application (SPA) |    | Firebase Auth Service  |
           |   React 18 + Vite Production  |    |  (Identity Platform)   |
           +-------------------------------+    +------------------------+
                            \                             /
                   [Suscripciones en Tiempo Real / WebSockets]
                   [Operaciones ACID / runTransaction via gRPC]
                                      \         /
                                       v       v
                        +------------------------------------+
                        |       Cloud Firestore NoSQL        |
                        |   Multi-Region Database Cluster    |
                        |    (Motor de Reglas de Seguridad)  |
                        +------------------------------------+
                                         |
                        +------------------------------------+
                        |       Firebase Cloud Storage       |
                        |     (Comprobantes y Evidencias)    |
                        +------------------------------------+
```

### 1.1.1 Configuración de Firebase Hosting y CDN Global
- **Alojamiento:** El frontend se distribuye como una Single Page Application (SPA) estática optimizada a través de la red perimetral (Edge CDN) distribuida de Google.
- **Configuración (`firebase.json`):**
  - **Punto de montaje (public):** `frontend/dist`.
  - **Reglas de reescritura (Rewrites):** Todas las rutas de navegación SPA (`/**`) son dirigidas internamente hacia `/index.html`, permitiendo a `react-router-dom` gestionar el historial del navegador (`HTML5 History API`) sin errores HTTP 404.
  - **Directivas de Caché:** `/index.html` cuenta con cabecera `Cache-Control: no-cache, no-store, must-revalidate` para forzar a los navegadores a consultar siempre la versión más reciente del bundle compilado, previniendo discrepancias de versión en clientes concurrentes. Los assets estáticos versionados (`/assets/*.js`, `/assets/*.css`) disfrutan de caché inmutable con hashing criptográfico en el nombre del archivo.

### 1.1.2 Dominio en Producción y Gestión DNS
- **URL Canónica de Producción:** `https://encargo-app-8a98f.web.app`
- **Dominio Secundario de Firebase:** `https://encargo-app-8a98f.firebaseapp.com`
- **Infraestructura DNS:** Google Anycast DNS con resolución geolocalizada en nodos edge latinoamericanos (Bogotá, São Paulo, Santiago, Miami).

### 1.1.3 Ambientes de Ejecución
1. **Entorno de Desarrollo Local:**
   - Servidor de desarrollo basado en Vite (`localhost:5173`) con Hot Module Replacement (HMR).
   - Variables de entorno locales configuradas para depuración y consola interactiva.
2. **Entorno de Producción:**
   - Compilación minificada mediante Rollup / Vite (`npm run build`), generando fragmentos (chunks) optimizados.
   - Conexión directa desde el navegador cliente hacia los endpoints globales de Google Cloud Firestore vía WebSockets seguros (`wss://`) y llamadas RPC multiplexadas sobre HTTP/2.

### 1.1.4 Certificados SSL/HTTPS y Protocolos Criptográficos
- **Cifrado en Tránsito:** Tráfico 100% forzado sobre HTTPS (TLS 1.3 con retrocompatibilidad TLS 1.2). HSTS (HTTP Strict Transport Security) activo.
- **Autoridad Certificadora (CA):** Google Trust Services LLC, renovado automáticamente cada 90 días sin disrupción de servicio.

---

## 1.2 Pila Tecnológica y Arquitectura de Software

### 1.2.1 Frontend
- **Framework Núcleo:** React 18.2.0 (Componentes funcionales, Hooks avanzados: `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`).
- **Empaquetador y Herramienta de Construcción:** Vite 5.2.0 con plugin `@vitejs/plugin-react` 4.2.1.
- **Enrutamiento:** `react-router-dom` 6.30.6 con guardas de autenticación y verificación de roles (`ADMIN` vs `USUARIO`).
- **Iconografía e Interfaz:** Lucide Icons integrados para señalización semántica de acciones críticas.
- **Conexión HTTP/SDK:** Firebase Web SDK modular v10.14.1 (`firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/storage`).

### 1.2.2 Backend & Persistencia: Cloud Firestore
Cloud Firestore opera como una base de datos de documentos NoSQL distribuida con replicación multirregión y consistencia fuerte para lecturas y transacciones (`runTransaction`).

#### Esquema de Datos y Diccionario de Colecciones

```
+------------------------------------------------------------------------------------+
|                                 ESQUEMA FIRESTORE                                  |
+------------------------------------------------------------------------------------+
| 1. users/{userId}                                                                  |
|    ├── uid: string (identificador unívoco de Firebase Auth)                        |
|    ├── email: string (correo electrónico verificado)                               |
|    ├── nombre: string (nombre completo o razón social)                             |
|    ├── role: enum ['USUARIO', 'ADMIN']                                             |
|    ├── walletBalance: number (saldo líquido en COP, default: 0)                    |
|    ├── strikes: number (contador de penalizaciones por incumplimiento, default: 0) |
|    ├── suspendedUntil: timestamp | null (fecha hasta la cual está bloqueado)       |
|    ├── banned: boolean (indicador de expulsión permanente)                         |
|    ├── departamento: string (departamento de residencia en Colombia)               |
|    ├── municipio: string (municipio o ciudad en Colombia)                          |
|    ├── telefono: string | null                                                     |
|    └── createdAt: timestamp                                                        |
+------------------------------------------------------------------------------------+
| 2. solicitudes/{solicitudId}                                                       |
|    ├── id: string                                                                  |
|    ├── titulo: string (resumen del servicio requerido)                             |
|    ├── descripcion: string (detalle de la labor)                                   |
|    ├── categoria: string (ej. Plomería, Electricidad, Pintura, Tecnología, etc.)   |
|    ├── presupuesto: number (presupuesto inicial referencial en COP)                |
|    ├── departamento: string                                                        |
|    ├── municipio: string                                                           |
|    ├── autor_uid: string (UID del cliente demandante)                              |
|    ├── autor_email: string                                                         |
|    ├── autor_nombre: string                                                        |
|    ├── estado: enum ['PUBLICADO', 'acordada', 'en_progreso',                       |
|    |                 'completada_por_cliente', 'completada_por_proveedor',         |
|    |                 'COMPLETADO', 'cancelada']                                    |
|    ├── providerUid: string | null (UID del solucionador acordado)                  |
|    ├── providerEmail: string | null                                                |
|    ├── providerNombre: string | null                                               |
|    ├── valorAcordado: number | null (valor pactado en negociación COP)             |
|    ├── fechaHoraPactada: string | null (ISO 8601 o formato fecha acordada)         |
|    ├── clientConfirmed: boolean (confirmación bilateral del cliente)               |
|    ├── providerConfirmed: boolean (confirmación bilateral del prestador)           |
|    ├── escrowAmount: number (monto en COP retenido en custodia)                    |
|    ├── clientCompleted: boolean (aprobación de labor por el cliente)               |
|    ├── providerCompleted: boolean (declaración de entrega por el prestador)       |
|    ├── createdAt: timestamp                                                        |
|    └── updatedAt: timestamp                                                        |
+------------------------------------------------------------------------------------+
| 3. chats/{chatId}                                                                  |
|    ├── solicitudId: string (referencia a la solicitud vinculada)                   |
|    ├── participantes: string[] [uid_cliente, uid_proveedor]                        |
|    ├── clienteUid: string                                                          |
|    ├── proveedorUid: string                                                        |
|    ├── updatedAt: timestamp                                                        |
|    └── Subcolección: mensajes/{mensajeId}                                          |
|         ├── senderId: string (UID del emisor)                                      |
|         ├── remitenteEmail: string                                                 |
|         ├── remitenteNombre: string                                                |
|         ├── texto: string (cuerpo del mensaje)                                     |
|         └── timestamp: timestamp                                                   |
+------------------------------------------------------------------------------------+
| 4. penalties/{penaltyId}                                                           |
|    ├── userId: string (UID del infractor penalizado)                               |
|    ├── userEmail: string                                                           |
|    ├── reportedByUid: string (UID de la contraparte que reportó o del sistema)     |
|    ├── solicitudId: string                                                         |
|    ├── strikeNumber: number (1, 2 o 3)                                             |
|    ├── fineAmount: number (5000 o 10000 COP)                                       |
|    ├── suspendedUntil: timestamp | null (+7 días si strike >= 3)                   |
|    ├── motivo: string                                                              |
|    └── createdAt: timestamp                                                        |
+------------------------------------------------------------------------------------+
| 5. platform_revenue/{revId}                                                        |
|    ├── solicitudId: string                                                         |
|    ├── totalTransaccion: number (valor pactado en COP)                             |
|    ├── feePercentage: number (0.08 = 8% comisión de intermediación)                |
|    ├── feeAmount: number (8% en COP acreditado a la plataforma)                    |
|    ├── providerAmount: number (92% en COP acreditado al prestador)                 |
|    ├── clientUid: string                                                           |
|    ├── providerUid: string                                                         |
|    └── timestamp: timestamp                                                        |
+------------------------------------------------------------------------------------+
| 6. transactions/{txId}                                                             |
|    ├── userId: string                                                              |
|    ├── type: enum ['DEPOSITO_SIMULADO', 'RETENCION_CUSTODIA',                      |
|    |               'LIBERACION_PAGO', 'COMISION_PLATAFORMA',                       |
|    |               'MULTA_INCUMPLIMIENTO']                                         |
|    ├── amount: number                                                              |
|    ├── balanceAfter: number                                                        |
|    ├── referenceId: string (solicitudId)                                           |
|    └── timestamp: timestamp                                                        |
+------------------------------------------------------------------------------------+
```

### 1.2.3 Estructura de Directorios del Proyecto
```
encargo/
├── .firebase/                  # Metadatos del CLI de Firebase
├── frontend/                   # Aplicación Cliente React + Vite
│   ├── dist/                   # Artefactos compilados listos para producción
│   ├── public/                 # Favicons y manifiestos estáticos
│   ├── src/
│   │   ├── components/         # Componentes UI encapsulados
│   │   │   ├── AcuerdoChatPanel.jsx  # Negociación, custodia y penalizaciones
│   │   │   ├── Dialogo.jsx           # Modales de confirmación interactiva
│   │   │   ├── Estado.jsx            # Insignias visuales de estado
│   │   │   ├── FormField.jsx         # Campos de formulario estandarizados
│   │   │   ├── SelectorUbicacion.jsx # Selector cascada 32 departamentos Colombia
│   │   │   ├── SolicitudCard.jsx     # Tarjeta de solicitud en listados
│   │   │   └── StarRating.jsx        # Sistema de calificación por estrellas
│   │   ├── data/
│   │   │   └── municipiosColombia.js # Diccionario geográfico oficial DANE
│   │   ├── pages/              # Vistas completas de la aplicación
│   │   │   ├── Acceso.jsx            # Autenticación e ingreso
│   │   │   ├── AdminPanel.jsx        # Panel exclusivo de gestión de administradores
│   │   │   ├── Billetera.jsx         # Billetera virtual, recarga simulada y saldo
│   │   │   ├── Calificaciones.jsx    # Historial y reputación
│   │   │   ├── Chat.jsx              # Vista de mensajería privada
│   │   │   ├── DetalleSolicitud.jsx  # Vista detallada de solicitud y postulación
│   │   │   ├── MiPerfil.jsx          # Configuración de cuenta y strikes
│   │   │   ├── NuevaSolicitud.jsx    # Formulario de publicación de encargo
│   │   │   └── Panel.jsx             # Tablero principal de solicitudes abiertas
│   │   ├── App.jsx             # Enrutamiento principal y barra de navegación
│   │   ├── firebase.js         # Inicialización del SDK de Firebase
│   │   ├── firestoreService.js # Lógica de negocio transaccional y servicios
│   │   ├── main.jsx            # Entrada raíz de React DOM
│   │   └── styles.css          # Sistema de diseño, CSS responsive y variables
│   ├── index.html              # Plantilla HTML5 canónica
│   ├── package.json            # Dependencias y scripts del frontend
│   └── vite.config.js          # Configuración del compilador Vite
├── backend/                    # Scripts de soporte, migraciones y seeds Python
│   ├── seeds/                  # Inicialización y sembrado de datos en Firestore
│   └── tests/                  # Pruebas automatizadas de plataforma
├── docs/                       # Documentación técnica modular en Markdown
├── firebase.json               # Configuración de Hosting, Firestore y Storage
├── firestore.rules             # Reglas de seguridad declarativas del motor de base de datos
├── storage.rules               # Reglas de control de acceso para Cloud Storage
└── README.md                   # Resumen operativo de la plataforma
```

### 1.2.4 Flujo de Despliegue y Control de Versiones (CI/CD)
El flujo de despliegue se ejecuta mediante el Firebase CLI (`firebase-tools`):
1. **Validación y Pruebas Locales:** Ejecución de suites de prueba unitarias e integración.
2. **Compilación de Artefactos:** `npm run build` en el subdirectorio `frontend/`, generando archivos optimizados en `frontend/dist/`.
3. **Despliegue Atómico:** `firebase deploy --only hosting,firestore:rules,storage` publica en un solo paso los recursos estáticos y actualiza en caliente las reglas del motor de seguridad.

---

## 1.3 Rendimiento, Concurrencia y SEO Técnico

### 1.3.1 Suscripciones en Tiempo Real y Desacople
La plataforma implementa escuchadores reactivos mediante el método `onSnapshot` de Cloud Firestore. Para evitar fugas de memoria (*memory leaks*) o peticiones redundantes en clientes móviles:
- Toda suscripción retorna una función canceladora `unsubscribe()`.
- En los componentes React (`useEffect`), la función canceladora se invoca obligatoriamente en la rutina de limpieza (*cleanup callback*):
  ```javascript
  useEffect(() => {
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      // Actualización de estado local reactivo
    });
    return () => unsubscribe(); // Limpieza garantizada al desmontar
  }, [id]);
  ```

### 1.3.2 Concurrencia y Bloqueos Optimistas
Las operaciones críticas de billetera, retención en custodia y confirmaciones bilaterales no utilizan escrituras independientes (`updateDoc`), sino transacciones atómicas `runTransaction`:
- Si dos usuarios interactúan simultáneamente sobre el mismo documento, Firestore detecta la colisión mediante control de concurrencia optimista (OCC), reintentando automáticamente la transacción en memoria antes de persistirla o fallando limpiamente si los saldos ya no son válidos.

### 1.3.3 Métricas Core Web Vitals y Rendimiento
- **First Contentful Paint (FCP):** < 0.9 segundos (distribución por Edge CDN).
- **Largest Contentful Paint (LCP):** < 1.6 segundos (sin dependencias pesadas de fuentes externas ni librerías CSS monolíticas).
- **Cumulative Layout Shift (CLS):** 0.00 (dimensiones fijas en cabeceras y tarjetas dinámicas).
- **SEO y Metadatos:** Etiquetas OpenGraph, viewport responsivo (`width=device-width, initial-scale=1.0`) y títulos semánticos por vista.
