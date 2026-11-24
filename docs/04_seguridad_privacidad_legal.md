# Módulo 4: Seguridad, Privacidad y Cumplimiento Legal
**Plataforma de Intermediación de Servicios «Encargo»**
*Auditoría de Seguridad, Control de Accesos, Gestión de Incidentes y Marco Regulatorio Colombiano*

---

## 4.1 Control de Accesos y Auditoría de Reglas Firestore

La seguridad de la base de datos de **Encargo** reside en el motor de reglas declarativas de Cloud Firestore (`firestore.rules`), ejecutado en los servidores de Google antes de conceder cualquier lectura o escritura.

### 4.1.1 Matriz de Control de Accesos Basado en Roles (RBAC)

| Recurso / Colección | Rol Anónimo | Usuario Autenticado | Administrador (`role == 'ADMIN'`) | SuperAdmin (`admin@encargo.com`) |
|---|---|---|---|---|
| **`users` (Lectura)** | Denegado | Permitido (consultar nombres/perfiles) | Permitido | Permitido |
| **`users` (Creación)** | Denegado | Solo propio `uid` con `role: 'USUARIO'` | Permitido | Permitido (crea cuenta raíz como ADMIN) |
| **`users` (Edición)** | Denegado | Solo campos permitidos (no rol ni strikes) | Gestión de roles y baneos | Control total (inmune a degradación) |
| **`solicitudes` (Lectura)** | Permitido (Público) | Permitido | Permitido | Permitido |
| **`solicitudes` (Creación)** | Denegado | Permitido si no está suspendido | Permitido | Permitido |
| **`solicitudes` (Modificación)** | Denegado | Autor o Proveedor asignado | Control total | Control total |
| **`chats` y `mensajes`** | Denegado | Solo si su `uid` está en `participantes` | Control total de auditoría | Control total de auditoría |
| **`penalties` (Auditoría)** | Denegado | Solo ver sus propias faltas o reportes | Lectura y gestión total | Control total |
| **`platform_revenue`** | Denegado | Denegado (solo crear con comisión = 0.08) | Lectura de ingresos | Lectura y conciliación contable |
| **`transactions`** | Denegado | Solo ver sus propios comprobantes | Lectura y supervisión | Control total |

### 4.1.2 Auditoría Técnica de `firestore.rules`
1. **Protección contra Auto-Elevación de Privilegios:**
   - La regla prohíbe explícitamente que un usuario modifique su propio campo `role`.
   - Regla en `users/{userId}`:
     ```javascript
     allow update: if (esAdmin() && ...) || (
       esPropietario(userId) && noEstaBaneado()
       && request.resource.data.role == resource.data.role
       && request.resource.data.banned == resource.data.banned
       && request.resource.data.get('strikes', 0) >= resource.data.get('strikes', 0)
       && request.resource.data.get('suspendedUntil', null) == resource.data.get('suspendedUntil', null)
     );
     ```
2. **Inmunidad de la Cuenta Raíz Administradora:**
   - Para evitar bloqueos accidentales o secuestro de cuentas, ninguna operación de administrador puede degradar el rol de `admin@encargo.com` ni marcarlo como baneado:
     ```javascript
     !(resource.data.email == 'admin@encargo.com' && 
       (request.resource.data.role != 'ADMIN' || request.resource.data.banned == true))
     ```
3. **Privacidad Estricta en Mensajería:**
   - El acceso de lectura a `chats/{chatId}` y su subcolección `mensajes` exige que `request.auth.uid in resource.data.participantes`, haciendo que ninguna conversación sea interceptable por terceros no involucrados.

---

## 4.2 Seguridad en Formularios y Protección Transaccional

1. **Mitigación de Cross-Site Scripting (XSS):**
   - React escapa por defecto cualquier contenido renderizado en JSX.
   - En el chat de mensajes y descripciones de encargo, se evita el uso de `dangerouslySetInnerHTML`.
2. **Integridad de Billetera Virtual y Fondos:**
   - Todo movimiento de dinero simulado está protegido contra valores negativos (`amount > 0`).
   - El compromiso de custodia verifica previamente que `walletBalance >= valorAcordado`, impidiendo saldos rojos o sobregiros no autorizados.
3. **Seguridad en Tokens de Autenticación (JWT):**
   - Las sesiones son gestionadas por Firebase Auth mediante tokens JWT de corta duración (60 minutos) con refresco automático transparente en memoria y almacenamiento cifrado en IndexedDB.

---

## 4.3 Protocolo de Respuesta ante Incidentes de Seguridad

El equipo de operaciones clasifica los incidentes bajo la siguiente matriz de severidad:

| Nivel | Definición | Tiempos de Respuesta (SLA) | Acción Inmediata |
|---|---|---|---|
| **P1 - Crítico** | Compromiso de cuentas, vulnerabilidad en `firestore.rules` con acceso a datos privados | < 15 minutos | Despliegue de reglas en modo restrictivo temporal (`allow read, write: if false;`), revocación masiva de tokens y aislamiento del entorno |
| **P2 - Alto** | Inconsistencia en liquidación de custodia o fallo en deducción de multas | < 1 hora | Suspensión temporal de la función transaccional de acuerdos, auditoría de logs en `transactions` y reversión manual |
| **P3 - Medio** | Reporte de usuario infractor recurrente o comportamiento abusivo en chat | < 4 horas | Baneo de cuenta desde el panel de administración (`banned: true`) y cancelación de solicitudes activas |
| **P4 - Bajo** | Errores menores de visualización o discrepancias de interfaz | < 24 horas | Corrección en rama de desarrollo y despliegue regular |

---

## 4.4 Cumplimiento Normativo Colombiano y Protección de Datos

La plataforma **Encargo** opera bajo el marco jurídico de la República de Colombia, adaptando su arquitectura a la legislación vigente:

### 4.4.1 Ley 1581 de 2012 y Decreto 1377 de 2013 (Habeas Data)
- **Autorización Previa y Expresa:** En el proceso de registro (`/registro`), el usuario otorga autorización explícita para el tratamiento de sus datos personales (nombre, correo electrónico, ubicación geográfica).
- **Finalidad del Tratamiento:** Los datos son recolectados exclusivamente con el fin de facilitar el contacto entre cliente y proveedor para la ejecución de encargos y la auditoría de seguridad del servicio.
- **Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición):** Todo usuario puede acceder a su información en `/perfil` y solicitar la supresión definitiva de su cuenta mediante los canales de soporte.

### 4.4.2 Ley 1480 de 2011 (Estatuto del Consumidor en Comercio Electrónico)
- **Rol de Intermediación:** Encargo actúa como una plataforma tecnológica de contacto entre usuarios independientes (clientes y solucionadores independientes).
- **Transparencia en Precios y Tarifas:** Todos los precios se expresan de manera clara y visible en pesos colombianos ($ COP), sin cargos ocultos.
- **Mecanismo de Retención en Custodia (Escrow):** Se garantiza que el dinero del cliente permanece en garantía durante la ejecución de la labor y solo es liquidado al prestador (92%) cuando el cliente verifica la culminación satisfactoria, reteniendo el 8% por concepto de uso de la plataforma tecnológica.
- **Mecanismo PQR:** Los usuarios disponen del módulo de reportes y calificaciones para elevar quejas y evaluar la idoneidad del servicio prestado.
