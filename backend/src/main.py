"""
Encargo · main.py
Aplicación principal FastAPI con todas las rutas y servicios modulares.
Arquitectura migrada a Firebase (Firestore, Firebase Auth, Firebase Storage).
Roles simplificados: USUARIO y ADMIN.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
    Body,
    Request,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.auth import get_current_user, require_admin
from src.calificaciones import calificar, obtener_calificaciones_usuario
from src.chat import (
    enviar_mensaje,
    listar_chats,
    listar_mensajes,
    obtener_chat_detalle,
    obtener_o_crear_chat,
)
from src.config import APP_ORIGIN, PAGINA_DEFAULT
from src.firebase_config import USA_FIREBASE_REAL, bucket, db
from src.reportes import crear_reporte, listar_reportes, resolver_reporte
from src.schemas import (
    ActualizarPerfil,
    BanearUsuario,
    CrearCalificacion,
    CrearMensaje,
    CrearReporte,
    CrearSolicitud,
    IniciarChat,
    RegistroCuenta,
    ResolucionReporte,
)
from src.solicitudes import (
    cancelar_solicitud,
    crear_solicitud,
    eliminar_solicitud,
    listar_solicitudes,
    obtener_solicitud,
    subir_imagenes_solicitud,
)
from src.usuarios import (
    actualizar_perfil,
    banear_usuario,
    desbanear_usuario,
    listar_usuarios,
    obtener_perfil,
    obtener_perfil_publico,
    promover_a_admin,
    registrar_perfil,
    revocar_admin,
)

logger = logging.getLogger("encargo")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida del servidor: verifica conexión a Firebase."""
    if USA_FIREBASE_REAL:
        logger.info("✅ Servidor iniciado y conectado a Firebase en la nube.")
    else:
        logger.info("ℹ️ Servidor iniciado en modo Mock/Local. Inicializando datos de prueba...")
        try:
            from seeds.seed_firebase import sembrar_datos_iniciales
            sembrar_datos_iniciales()
        except Exception as e:
            logger.warning(f"No se pudieron sembrar datos locales: {e}")
    yield


app = FastAPI(
    title="Encargo API (Firebase Edition)",
    description="Plataforma comunitaria de servicios intermediados en la nube",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        APP_ORIGIN,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"codigo": f"HTTP_{exc.status_code}", "mensaje": exc.detail},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    logger.exception(f"Error no controlado: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"codigo": "ERROR_INTERNO", "mensaje": "Ocurrió un error interno en el servidor."},
    )


# ══════════════════════════════════════════════
#  1. SALUD
# ══════════════════════════════════════════════
@app.get("/api/salud", tags=["Salud"])
async def salud():
    return {
        "estado": "operativo",
        "servicio": "Encargo API",
        "version": "2.0.0",
        "firebase_cloud": USA_FIREBASE_REAL,
    }


# ══════════════════════════════════════════════
#  2. CUENTAS Y PERFILES DE USUARIO
# ══════════════════════════════════════════════
@app.post("/api/cuentas", status_code=status.HTTP_201_CREATED, tags=["Cuentas"])
async def registrar_cuenta(
    data: RegistroCuenta,
    usuario: dict = Depends(get_current_user),
):
    """Completa el registro inicial de una cuenta en Firestore."""
    return registrar_perfil(usuario["uid"], usuario["email"], data)


@app.get("/api/perfil", tags=["Perfil"])
async def get_mi_perfil(usuario: dict = Depends(get_current_user)):
    """Obtiene el perfil privado del usuario autenticado."""
    return obtener_perfil(usuario["uid"])


@app.patch("/api/perfil", tags=["Perfil"])
async def patch_mi_perfil(
    data: ActualizarPerfil,
    usuario: dict = Depends(get_current_user),
):
    """Actualiza datos básicos del perfil (nombre, apellidos, bio, municipio)."""
    return actualizar_perfil(usuario["uid"], data)


@app.post("/api/perfil/foto", tags=["Perfil"])
async def subir_foto_perfil(
    foto: UploadFile = File(...),
    usuario: dict = Depends(get_current_user),
):
    """Sube y actualiza la foto de perfil del usuario en Firebase Storage."""
    contenido = await foto.read()
    ext = foto.filename.rsplit(".", 1)[-1] if foto.filename else "jpg"
    storage_path = f"perfiles/{usuario['uid']}.{ext}"

    blob = bucket.blob(storage_path)
    blob.upload_from_string(contenido, content_type=foto.content_type or "image/jpeg")
    blob.make_public()
    url = blob.public_url

    db.collection("users").document(usuario["uid"]).update({"photoURL": url})
    return {"mensaje": "Foto de perfil actualizada", "photoURL": url, "url": url}


@app.get("/api/usuarios/{uid}", tags=["Perfil"])
@app.get("/api/usuarios/{uid}/perfil-publico", tags=["Perfil"])
async def get_perfil_publico(uid: str):
    """Obtiene el perfil público seguro (sin email, teléfono ni datos sensibles)."""
    return obtener_perfil_publico(uid)


# ══════════════════════════════════════════════
#  3. SOLICITUDES
# ══════════════════════════════════════════════
@app.post("/api/solicitudes", status_code=status.HTTP_201_CREATED, tags=["Solicitudes"])
async def post_solicitud(
    data: CrearSolicitud,
    usuario: dict = Depends(get_current_user),
):
    """Publica una nueva solicitud de servicio."""
    return crear_solicitud(usuario["uid"], data)


@app.get("/api/solicitudes", tags=["Solicitudes"])
async def get_solicitudes(
    categoria: Optional[str] = None,
    municipio: Optional[str] = None,
    limite: int = PAGINA_DEFAULT,
    offset: int = 0,
):
    """Lista las solicitudes con filtros opcionales de categoría y municipio."""
    return listar_solicitudes(categoria=categoria, municipio=municipio, limite=limite, offset=offset)


@app.get("/api/solicitudes/{solicitud_id}", tags=["Solicitudes"])
async def get_solicitud(solicitud_id: str):
    """Obtiene el detalle de una solicitud."""
    return obtener_solicitud(solicitud_id)


@app.delete("/api/solicitudes/{solicitud_id}", tags=["Solicitudes"])
async def delete_solicitud(
    solicitud_id: str,
    usuario: dict = Depends(get_current_user),
):
    """
    Elimina una solicitud.
    Un USUARIO solo puede borrar las que él mismo haya creado.
    Un ADMIN puede borrar cualquier solicitud del sistema.
    """
    return eliminar_solicitud(usuario["uid"], usuario["role"], solicitud_id)


@app.post("/api/solicitudes/{solicitud_id}/cancelar", tags=["Solicitudes"])
@app.patch("/api/solicitudes/{solicitud_id}", tags=["Solicitudes"])
async def post_cancelar_solicitud(
    solicitud_id: str,
    usuario: dict = Depends(get_current_user),
):
    """Cancela una solicitud previa. Solo el usuario creador puede cancelarla."""
    return cancelar_solicitud(usuario["uid"], solicitud_id)


@app.post("/api/solicitudes/{solicitud_id}/imagenes", status_code=status.HTTP_201_CREATED, tags=["Solicitudes"])
async def post_imagenes_solicitud(
    solicitud_id: str,
    request: Request,
    usuario: dict = Depends(get_current_user),
):
    """Sube imágenes a una solicitud (máximo 5 imágenes). Acepta cualquier nombre de campo multipart."""
    form = await request.form()
    archivos = []
    for k, v in form.multi_items():
        if isinstance(v, UploadFile) and v.filename:
            archivos.append(v)
    if not archivos:
        raise HTTPException(status_code=400, detail="Debe adjuntar al menos un archivo de imagen.")
    urls = await subir_imagenes_solicitud(usuario["uid"], solicitud_id, archivos)
    return {"mensaje": "Imágenes subidas correctamente.", "urls": urls}


# ══════════════════════════════════════════════
#  4. CHAT PRIVADO SEGURO
# ══════════════════════════════════════════════
@app.post("/api/chats", status_code=status.HTTP_200_OK, tags=["Chat"])
async def post_chat(
    data: Optional[IniciarChat] = Body(None),
    otro_uid: Optional[str] = Query(None),
    usuario: dict = Depends(get_current_user),
):
    """Obtiene o inicia un chat privado entre dos usuarios."""
    destinatario = otro_uid
    if not destinatario and data:
        destinatario = data.get_destinatario()

    if not destinatario:
        raise HTTPException(status_code=400, detail="Debe indicar el usuario destinatario.")

    return obtener_o_crear_chat(usuario["uid"], destinatario)


@app.get("/api/chats", tags=["Chat"])
async def get_mis_chats(usuario: dict = Depends(get_current_user)):
    """Lista las conversaciones privadas del usuario autenticado."""
    return listar_chats(usuario["uid"])


@app.get("/api/chats/{chat_id}", tags=["Chat"])
async def get_chat_detalle(
    chat_id: str,
    limite: int = PAGINA_DEFAULT,
    usuario: dict = Depends(get_current_user),
):
    """Obtiene la información segura del chat y sus mensajes."""
    return obtener_chat_detalle(usuario["uid"], chat_id, limite)


@app.get("/api/chats/{chat_id}/mensajes", tags=["Chat"])
async def get_mensajes(
    chat_id: str,
    limite: int = PAGINA_DEFAULT,
    usuario: dict = Depends(get_current_user),
):
    """Lista los mensajes de una conversación."""
    return listar_mensajes(usuario["uid"], chat_id, limite)


@app.post("/api/chats/{chat_id}/mensajes", status_code=status.HTTP_201_CREATED, tags=["Chat"])
async def post_mensaje(
    chat_id: str,
    data: CrearMensaje,
    usuario: dict = Depends(get_current_user),
):
    """Envía un mensaje de texto en un chat privado."""
    return enviar_mensaje(usuario["uid"], chat_id, data.get_texto())


# ══════════════════════════════════════════════
#  5. SISTEMA DE REPORTES Y MODERACIÓN
# ══════════════════════════════════════════════
@app.post("/api/reportes", status_code=status.HTTP_201_CREATED, tags=["Reportes"])
async def post_reporte(
    data: CrearReporte,
    usuario: dict = Depends(get_current_user),
):
    """Permite a los usuarios reportar solicitudes o comportamientos indebidos."""
    return crear_reporte(usuario["uid"], data)


@app.get("/api/admin/reportes", tags=["Reportes"])
async def get_reportes(
    estado: Optional[str] = None,
    limite: int = PAGINA_DEFAULT,
    offset: int = 0,
    admin: dict = Depends(require_admin),
):
    """Bandeja administrativa para atender reportes de la comunidad."""
    return listar_reportes(estado=estado, limite=limite, offset=offset)


@app.post("/api/admin/reportes/{reporte_id}/resolver", tags=["Reportes"])
async def post_resolver_reporte(
    reporte_id: str,
    data: ResolucionReporte,
    admin: dict = Depends(require_admin),
):
    """Atiende y resuelve un reporte aplicando sanciones o moderación."""
    return resolver_reporte(admin["uid"], reporte_id, data)


# ══════════════════════════════════════════════
#  6. REPUTACIÓN Y CALIFICACIONES RECÍPROCAS
# ══════════════════════════════════════════════
@app.post("/api/calificaciones", status_code=status.HTTP_201_CREATED, tags=["Calificaciones"])
async def post_calificacion(
    data: CrearCalificacion,
    usuario: dict = Depends(get_current_user),
):
    """Registra una calificación (1-5 estrellas) y actualiza la reputación comunitaria."""
    return calificar(usuario["uid"], data)


@app.get("/api/calificaciones/recibidas", tags=["Calificaciones"])
async def get_mis_calificaciones(usuario: dict = Depends(get_current_user)):
    """Obtiene las opiniones y calificaciones recibidas por el usuario actual."""
    return obtener_calificaciones_usuario(usuario["uid"])


@app.get("/api/usuarios/{uid}/calificaciones", tags=["Calificaciones"])
@app.get("/api/calificaciones/usuario/{uid}", tags=["Calificaciones"])
async def get_calificaciones_usuario(uid: str):
    """Consulta pública de calificaciones recibidas por un usuario."""
    return obtener_calificaciones_usuario(uid)


# ══════════════════════════════════════════════
#  7. GESTIÓN DE USUARIOS Y ROLES (ADMIN EXCLUSIVO)
# ══════════════════════════════════════════════
@app.get("/api/admin/usuarios", tags=["Administración"])
async def get_usuarios(
    limite: int = PAGINA_DEFAULT,
    offset: int = 0,
    admin: dict = Depends(require_admin),
):
    """Panel para visualizar la lista completa de usuarios registrados."""
    return listar_usuarios(limite=limite, offset=offset)


@app.post("/api/admin/usuarios/{uid}/promover", tags=["Administración"])
async def post_promover(
    uid: str,
    admin: dict = Depends(require_admin),
):
    """
    Otorga el rol de Administrador a un usuario.
    Solo un administrador existente puede asignar este rol.
    """
    return promover_a_admin(admin["uid"], uid)


@app.post("/api/admin/usuarios/{uid}/revocar", tags=["Administración"])
async def post_revocar(
    uid: str,
    admin: dict = Depends(require_admin),
):
    """
    Revoca el rol de Administrador regresando al usuario a rol USUARIO.
    Protege la cuenta primaria y evita auto-revocación.
    """
    return revocar_admin(admin["uid"], uid)


@app.post("/api/admin/usuarios/{uid}/banear", tags=["Administración"])
async def post_banear(
    uid: str,
    data: BanearUsuario = Body(default_factory=BanearUsuario),
    admin: dict = Depends(require_admin),
):
    """Banea a un usuario: suspende su acceso y deshabilita sus credenciales."""
    return banear_usuario(admin["uid"], uid, data.motivo)


@app.post("/api/admin/usuarios/{uid}/desbanear", tags=["Administración"])
async def post_desbanear(
    uid: str,
    admin: dict = Depends(require_admin),
):
    """Rehabilita a un usuario previamente suspendido."""
    return desbanear_usuario(admin["uid"], uid)
