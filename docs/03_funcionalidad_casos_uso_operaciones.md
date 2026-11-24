# Módulo 3: Funcionalidad, Casos de Uso y Operaciones
**Plataforma de Intermediación de Servicios «Encargo»**
*Especificación Formal de Casos de Uso, Lógica Transaccional y Manual de Operaciones*

---

## 3.1 Casos de Uso Formales del Sistema

### CU-01: Registro y Autenticación con Aislamiento por UID
- **Actores:** Usuario Anónimo (Cliente o Proveedor).
- **Precondiciones:** Disponer de correo electrónico válido y contraseña de mínimo 6 caracteres.
- **Flujo Principal:**
  1. El usuario accede a la vista `/registro`, ingresa nombre, email, contraseña, departamento y municipio de residencia.
  2. El cliente invoca `createUserWithEmailAndPassword(auth, email, password)`.
  3. Firebase Authentication valida y genera un identificador unívoco de seguridad (`uid`).
  4. Se crea de forma inmediata el documento `users/{uid}` en Cloud Firestore con rol por defecto `USUARIO`, saldo inicial `$0 COP`, `strikes: 0`, `banned: false` y `suspendedUntil: null`.
  5. El usuario es redirigido automáticamente a la vista `/solicitudes` con su sesión iniciada.
- **Flujo Alternativo (Login):**
  - Si el usuario ya está registrado, ingresa en `/login`. El sistema valida credenciales vía `signInWithEmailAndPassword`, recupera el perfil de `users/{uid}` y actualiza el estado de autenticación global.
- **Postcondiciones:** Toda operación futura queda firmada criptográficamente con el `request.auth.uid`, garantizando el aislamiento de datos entre cuentas.

---

### CU-02: Publicación y Filtrado Territorial de Solicitudes
- **Actores:** Cliente Autenticado (creador) y Proveedores (exploradores).
- **Precondiciones:** El creador debe tener una cuenta activa sin suspensiones vigentes (`suspendedUntil == null` o fecha expirada).
- **Flujo Principal:**
  1. El cliente accede a `/nueva`, completa título, categoría (ej. Plomería, Electricidad, Pintura, Carpintería, Limpieza, Jardinería, Tecnología, Cerrajería, Mudanza), presupuesto referencial en COP, departamento y municipio.
  2. El sistema valida los campos requeridos y ejecuta `crearSolicitud(datos)` en Firestore.
  3. El documento se persiste en `solicitudes/{id}` con estado `PUBLICADO` y `autor_uid = auth.currentUser.uid`.
  4. Los proveedores visualizan la solicitud en el tablero principal (`Panel.jsx`), pudiendo filtrar dinámicamente por categoría y municipio.
- **Postcondiciones:** La solicitud queda disponible públicamente para recibir postulaciones privadas.

---

### CU-03: Negociación Privada y Chat en Tiempo Real
- **Actores:** Cliente y Proveedor Interesado.
- **Precondiciones:** Solicitud en estado `PUBLICADO` o `acordada`.
- **Flujo Principal:**
  1. El proveedor ingresa al detalle de la solicitud y redacta un mensaje inicial de propuesta.
  2. Si no existe un hilo previo, se inicializa el documento `chats/{chatId}` vinculando `solicitudId` y la lista `participantes: [clienteUid, proveedorUid]`.
  3. Se añade el mensaje en la subcolección `chats/{chatId}/mensajes` con marca de tiempo precisa del servidor.
  4. La contraparte recibe el mensaje al instante mediante la suscripción reactiva `onSnapshot`.
  5. Ambas partes debaten y acuerdan en el panel superior el **Valor Acordado ($ COP)** y la **Fecha/Hora de Ejecución**.
- **Postcondiciones:** El historial de la negociación queda registrado e inmutable para efectos de auditoría o resolución de discrepancias.

---

### CU-04: Doble Confirmación de Compromiso
- **Actores:** Cliente y Proveedor.
- **Precondiciones:**
  1. Se ha definido un valor acordado (> 0 COP) y una fecha/hora válida.
  2. **Regla de Validación Previa:** Ambos participantes deben haber enviado al menos un mensaje en el chat privado vinculado (`clientMessageCount >= 1 && providerMessageCount >= 1`).
  3. El cliente debe contar con saldo disponible suficiente en su billetera (`walletBalance >= valorAcordado`).
- **Flujo Principal:**
  1. Una de las partes pulsa "Confirmar Compromiso". Se actualiza su flag respectivo (`clientConfirmed: true` o `providerConfirmed: true`).
  2. El botón de la contraparte indica que el otro usuario ya confirmó y está a la espera de su aceptación.
  3. La contraparte pulsa "Confirmar Compromiso".
  4. Al cumplirse la doble confirmación, el sistema ejecuta una transacción atómica `runTransaction`:
     - Deduce el 100% del valor acordado de la billetera del cliente (`walletBalance = walletBalance - valorAcordado`).
     - Asigna el monto a custodia dentro del documento de la solicitud (`escrowAmount = valorAcordado`).
     - Modifica el estado de la solicitud a `en_progreso` (o `acordada`).
     - Asigna definitivamente `providerUid = uid_del_proveedor`.
- **Postcondiciones:** La solicitud se bloquea para postulaciones de terceros y los fondos quedan congelados en garantía.

---

### CU-05: Sistema de Penalizaciones por Incumplimiento
- **Actores:** Parte afectada o Administrador.
- **Precondiciones:** Solicitud con compromiso confirmado (`en_progreso` / `acordada`).
- **Flujo Principal:**
  1. Una de las partes reporta incumplimiento o cancelación unilateral desde el panel del chat.
  2. El sistema identifica la parte infractora y consulta su histórico de faltas (`strikes`).
  3. Se ejecuta una transacción atómica en Firestore:
     - Incrementa el contador: `strikes = strikes + 1`.
     - Aplica la multa económica:
       - Si `strikes` actual es 1 o 2: Aplica multa de **$5.000 COP**, debitada de `walletBalance`.
       - Si `strikes` actual es >= 3: Aplica multa de **$10.000 COP** y establece `suspendedUntil = now() + 7 días`.
     - Si había fondos en custodia (`escrowAmount > 0`), se restituyen inmediatamente a la billetera del cliente no infractor.
     - Cambia el estado de la solicitud a `cancelada`.
     - Crea un registro auditado inmutable en la colección `penalties`.
- **Postcondiciones:** El infractor queda multado y, si alcanza 3 faltas, queda inhabilitado para operar en la plataforma durante 7 días continuos.

---

### CU-06: Pagos Simulados, Billetera y Liquidación con Comisión (8%)
- **Actores:** Cliente y Proveedor.
- **Precondiciones:** Solicitud en estado `en_progreso` con fondos en custodia (`escrowAmount > 0`).
- **Flujo Principal:**
  1. El proveedor finaliza el encargo y pulsa "Marcar Labor como Completada" (`providerCompleted = true`).
  2. El cliente inspecciona el resultado y pulsa "Aprobar y Liberar Pago" (`clientCompleted = true`).
  3. Al cumplirse ambas aprobaciones, `firestoreService` dispara `finalizarAcuerdoYDistribuirPago` bajo `runTransaction`:
     - Calcula la comisión del 8%: `feeAmount = escrowAmount * 0.08`.
     - Calcula el pago neto al proveedor (92%): `providerAmount = escrowAmount * 0.92`.
     - Transfiere `providerAmount` al saldo líquido del proveedor (`provider.walletBalance += providerAmount`).
     - Registra `feeAmount` en la colección `platform_revenue`.
     - Pone `escrowAmount = 0` y cambia el estado de la solicitud a `COMPLETADO`.
     - Genera los comprobantes correspondientes en `transactions`.
- **Postcondiciones:** La transacción concluye con éxito, los fondos son acreditados al prestador y se habilitan los formularios de calificación mutua (1 a 5 estrellas).

---

### CU-07: Gestión Exclusiva de Roles de Administrador
- **Actores:** Administrador Principal (`admin@encargo.com`) o Administrador Delegado.
- **Precondiciones:** Sesión iniciada con un usuario cuyo perfil en Firestore tenga `role == 'ADMIN'`.
- **Flujo Principal:**
  1. El administrador ingresa a `/admin`. La ruta está protegida tanto en la UI de React como por las reglas del backend `firestore.rules`.
  2. El sistema lista todos los usuarios registrados en la plataforma, mostrando: Nombre, Email, UID, Rol, Saldo, Strikes y Estado de Suspensión.
  3. El administrador puede pulsar "Promover a Administrador" o "Revocar Administrador" sobre cualquier usuario.
  4. La regla de seguridad en Firestore valida que la cuenta principal `admin@encargo.com` nunca pueda ser degradada a usuario común ni baneada bajo ninguna circunstancia.
- **Postcondiciones:** El nuevo rol cobra vigencia inmediata para el usuario afectado en su siguiente lectura de token o documento.

---

## 3.2 Lógica Transaccional y Concurrencia (runTransaction)

Para garantizar la integridad financiera de las billeteras y prevenir condiciones de carrera (*Race Conditions*) o pagos duplicados ante clics concurrentes:
- **Atomicidad y Aislamiento:** Toda mutación que involucre más de un documento (ej. Solicitud + Usuario Cliente + Usuario Proveedor + Ingresos de Plataforma) se ejecuta estrictamente dentro del bloque transaccional:
  ```javascript
  await runTransaction(db, async (transaction) => {
    // 1. Lecturas iniciales de todos los documentos involucrados
    const solicitudSnap = await transaction.get(solicitudRef);
    const clienteSnap = await transaction.get(clienteRef);
    const proveedorSnap = await transaction.get(proveedorRef);

    // 2. Validaciones de estado y balance
    if (solicitudSnap.data().estado !== 'en_progreso') {
      throw new Error('La solicitud no está en estado válido para liquidar');
    }

    // 3. Escrituras simultáneas
    transaction.update(clienteRef, { ... });
    transaction.update(proveedorRef, { ... });
    transaction.update(solicitudRef, { ... });
    transaction.set(platformRevenueRef, { ... });
  });
  ```
- **Control de Concurrencia Optimista (OCC):** Si otro proceso modifica cualquiera de estos documentos mientras la transacción se procesaba en el cliente, Firestore descarta la operación y la reintenta automáticamente con los datos actualizados, garantizando que jamás se acrediten montos superiores al saldo retenido en custodia.

---

## 3.3 Manual de Operaciones y Mantenimiento

### 3.3.1 Procedimiento de Inicialización y Sembrado de Datos (Seed)
Para desplegar un ambiente nuevo o regenerar datos de demostración limpios:
1. Asegurarse de tener configuradas las credenciales de Firebase en `frontend/src/firebase.js`.
2. Ejecutar el script automatizado de sembrado en Python:
   ```powershell
   & "backend/.venv/Scripts/python.exe" backend/seeds/seed_firebase_data.py
   ```
3. El script valida la existencia de las 4 cuentas canónicas:
   - `admin@encargo.com` (Administrador Principal, clave: `administradorEncargo@`)
   - `luis.morales@ejemplo.com` (Usuario Cliente/Proveedor)
   - `elena.vega@ejemplo.com` (Usuario Cliente/Proveedor)
   - `roberto.torres@ejemplo.com` (Usuario Cliente/Proveedor)
4. Si las solicitudes no existen, crea 9 solicitudes de ejemplo variando categorías (Plomería, Electricidad, Pintura, Carpintería, Limpieza, Jardinería, Tecnología, Cerrajería, Mudanza) asociándolas directamente a los UIDs reales de dichas cuentas.

### 3.3.2 Política de Respaldos y Exportación de Cloud Firestore
- **Exportación Programada:** Configurar una función programada de Google Cloud Backup a un bucket de Google Cloud Storage (`gs://encargo-backups/firestore-daily`).
- **Comando de exportación manual:**
  ```powershell
  gcloud firestore export gs://encargo-backups/$(Get-Date -Format 'yyyyMMdd-HHmm')
  ```

### 3.3.3 Matriz RACI y Propiedad del Sistema

| Componente / Módulo | Responsable (R) | Aprobador (A) | Consultado (C) | Informado (I) |
|---|---|---|---|---|
| **Reglas de Seguridad Firestore** | Arquitecto de Software | Lead de Seguridad | Desarrollador Full-Stack | DevOps |
| **Flujo de Escrow y Comisiones** | Ingeniero Full-Stack | Arquitecto de Software | Auditor Financiero | Operaciones |
| **Panel de Administración** | Ingeniero Frontend | Product Owner | Administrador Principal | Soporte |
| **Infraestructura Hosting & DNS** | DevOps / SRE | Arquitecto de Software | Lead de Seguridad | Equipo Completo |
