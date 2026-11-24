# Encargo · Plataforma de Intermediación de Servicios

Plataforma comunitaria de servicios intermediados en la nube con **Python (FastAPI)**, **React.js (Vite)** y **Firebase (Authentication, Cloud Firestore, Firebase Storage)**.

---

## 1. Sistema de Roles Simplificado (2 tipos)

| Rol | Registro | Permisos en Solicitudes | Privilegios de Moderación |
|---|---|---|---|
| **`USUARIO`** | Registro público directo desde `/registro`. | Publica y explora solicitudes de todas las categorías. Puede cancelar y eliminar **únicamente** sus propias solicitudes. | Puede reportar solicitudes o conductas indebidas. Califica al contraparte al finalizar un servicio. |
| **`ADMIN`** | No accesible en registro público. Se otorga exclusivamente desde el panel por otro administrador existente. | Visibilidad global sin censura. Puede eliminar **cualquier** solicitud del sistema. | Panel exclusivo `/admin` para listar usuarios, promover a administradores, banear/desbanear y resolver reportes. |

---

## 2. Nuevas Funcionalidades

### 💬 Chat Privado Seguro
- Mensajería privada en tiempo real entre el solicitante y el prestador.
- **Privacidad estricta:** Solo muestra el nombre, foto de perfil y una breve biografía/historial. No se exponen correos electrónicos, números de teléfono ni datos de contacto privados.
- Acceso directo para **Calificar** o **Reportar** al interlocutor desde el propio chat.

### 🚩 Sistema de Reportes y Moderación
- Cualquier usuario puede reportar solicitudes dudosas o usuarios con comportamientos indebidos.
- Los administradores disponen de una bandeja de entrada (`/admin/reportes`) para revisar casos y tomar acciones directas:
  - `CERRAR`: Cerrar el reporte sin sanción.
  - `BAN_USUARIO`: Bloquear inmediatamente la cuenta del usuario infractor en Firebase Auth y Firestore.
  - `ELIMINAR_SOLICITUD`: Retirar la publicación reportada del sistema.

### ⭐ Calificaciones y Reputación Mutua
- Sistema recíproco de 1 a 5 estrellas con comentario opcional.
- Ambas partes se evalúan mutuamente: el contratante califica la calidad del servicio recibido y el prestador califica la experiencia con el contratante.
- Cálculo automático del promedio de confianza y número total de calificaciones mostrado públicamente en el perfil.

---

## 3. Estructura de la Base de Datos (Cloud Firestore)

- **`users/{uid}`**: Datos del perfil, rol (`USUARIO` / `ADMIN`), foto, bio, promedio de reputación y estado de baneo.
- **`solicitudes/{id}`**: Título, descripción, categoría, municipio, estado (`PUBLICADO`, `CANCELADO`), fotos e identificación del autor.
- **`chats/{chatId}`**: Conversaciones privadas. ID generado por orden alfabético de UIDs (`uidA_uidB`).
  - **`chats/{chatId}/mensajes/{id}`**: Subcolección de mensajes individuales.
- **`calificaciones/{id}`**: Evaluador, evaluado, solicitud asociada, puntuación (1-5) y comentario.
- **`reportes/{id}`**: Reportante, reportado/solicitud, motivo, estado (`PENDIENTE` / `RESUELTO`) y resolución del admin.

---

## 4. Reglas de Seguridad
- [firestore.rules](file:///C:/Users/luisk/.gemini/antigravity/scratch/encargo/firestore.rules): Seguridad granular para lectura, creación y actualización de documentos.
- [storage.rules](file:///C:/Users/luisk/.gemini/antigravity/scratch/encargo/storage.rules): Políticas de subida para fotos de perfil y evidencias de solicitudes (máx. 5MB por imagen).

---

## 5. Instrucciones de Ejecución

### Inicio Rápido (1 clic en Windows):
Haz doble clic en:
- `iniciar_servidores.bat` para arrancar el backend y el frontend simultáneamente.
- `probar_plataforma.bat` para ejecutar la suite de pruebas y la verificación del build.

### Ejecución Manual:

**Backend:**
```bash
cd backend
.venv\Scripts\python.exe -m uvicorn src.main:app --reload --port 8000
```
- API y docs: [http://localhost:8000/docs](http://localhost:8000/docs)

**Frontend:**
```bash
cd frontend
npm.cmd run dev
```
- Aplicación web: [http://localhost:5173](http://localhost:5173)

### Credenciales de Firebase en la Nube:
1. Coloca tu archivo `serviceAccountKey.json` descargado de la consola de Firebase dentro de `backend/`.
2. Actualiza `firebaseConfig` en `frontend/src/firebase.js` con las credenciales de tu proyecto.
*(Si no colocas credenciales, el sistema arranca automáticamente en modo simulado local con datos de prueba precargados para que puedas probar todas las funciones de inmediato).*
