"""
Encargo · usuarios.py
Servicio de gestión de usuarios: perfil, listado, promoción y baneo.
"""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import HTTPException, status
from src.config import PAGINA_DEFAULT, PAGINA_MAX
from src.firebase_config import db, USA_FIREBASE_REAL, SERVER_TIMESTAMP
from src.schemas import ActualizarPerfil, RegistroCuenta

logger = logging.getLogger("encargo.usuarios")


# ──────────────────────────────────────────────
# Obtener perfil completo (privado, solo el propio usuario)
# ──────────────────────────────────────────────
def obtener_perfil(uid: str) -> dict:
    """
    Retorna el perfil completo del usuario desde Firestore.
    Incluye todos los campos e interoperabilidad para el frontend (rol, nombre).
    """
    user_snap = db.collection("users").document(uid).get()

    if not user_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de usuario no encontrado.",
        )

    datos = user_snap.to_dict()
    datos["uid"] = datos.get("uid", uid)
    datos["rol"] = datos.get("role", "USUARIO")
    datos["nombre"] = datos.get("nombre") or datos.get("displayName") or "Usuario"
    return datos


# ──────────────────────────────────────────────
# Registrar o completar cuenta
# ──────────────────────────────────────────────
def registrar_perfil(uid: str, email: str, data: RegistroCuenta) -> dict:
    """
    Crea o actualiza el documento de usuario en Firestore tras registrarse con Firebase Auth.
    Garantiza que el rol inicial sea estrictamente USUARIO.
    """
    user_ref = db.collection("users").document(uid)
    nombre_completo = f"{data.nombre or ''} {data.apellidos or ''}".strip() or data.displayName or "Usuario"
    es_admin_inicial = (email or "").lower() == "admin@encargo.com" or "admin" in (email or "").lower()
    rol_asignado = "ADMIN" if es_admin_inicial else "USUARIO"

    doc = {
        "uid": uid,
        "email": email,
        "displayName": nombre_completo,
        "nombre": data.nombre or "",
        "apellidos": data.apellidos or "",
        "municipio": data.municipio or "",
        "bio": data.bio or "",
        "photoURL": "",
        "role": rol_asignado,
        "rol": rol_asignado,
        "banned": False,
        "promedioCalificacion": 0.0,
        "totalCalificaciones": 0,
        "actualizadoEn": SERVER_TIMESTAMP,
    }

    user_ref.set(doc, merge=True)
    return doc


# ──────────────────────────────────────────────
# Actualizar perfil
# ──────────────────────────────────────────────
def actualizar_perfil(uid: str, data: ActualizarPerfil) -> dict:
    """
    Actualiza los campos permitidos del perfil del usuario.
    Solo se actualizan los campos que se proporcionan.
    """
    user_ref = db.collection("users").document(uid)
    user_snap = user_ref.get()

    if not user_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de usuario no encontrado.",
        )

    campos = {}
    if data.displayName is not None:
        campos["displayName"] = data.displayName.strip()
    if data.nombre is not None:
        campos["nombre"] = data.nombre.strip()
        if data.displayName is None:
            campos["displayName"] = data.nombre.strip()
    if data.apellidos is not None:
        campos["apellidos"] = data.apellidos.strip()
    if data.bio is not None:
        campos["bio"] = data.bio.strip()
    if data.municipio is not None:
        campos["municipio"] = data.municipio.strip()

    if not campos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se proporcionaron campos para actualizar.",
        )

    campos["actualizadoEn"] = SERVER_TIMESTAMP
    user_ref.update(campos)

    return obtener_perfil(uid)


# ──────────────────────────────────────────────
# Obtener perfil público (visible para todos)
# ──────────────────────────────────────────────
def obtener_perfil_publico(uid: str) -> dict:
    """
    Retorna solo los datos públicos de un usuario:
    nombre, foto, bio, municipio y calificaciones.
    NO incluye email, teléfono ni datos privados.
    """
    user_snap = db.collection("users").document(uid).get()

    if not user_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado.",
        )

    datos = user_snap.to_dict()

    nombre_mostrado = datos.get("displayName") or f"{datos.get('nombre', '')} {datos.get('apellidos', '')}".strip() or "Usuario"

    return {
        "uid": datos.get("uid", uid),
        "id": datos.get("uid", uid),
        "displayName": nombre_mostrado,
        "nombre": datos.get("nombre") or nombre_mostrado,
        "apellidos": datos.get("apellidos", ""),
        "photoURL": datos.get("photoURL", ""),
        "foto_url": datos.get("photoURL", ""),
        "bio": datos.get("bio", ""),
        "municipio": datos.get("municipio", ""),
        "promedioCalificacion": datos.get("promedioCalificacion", 0.0),
        "promedio": datos.get("promedioCalificacion", 0.0),
        "totalCalificaciones": datos.get("totalCalificaciones", 0),
        "rol": datos.get("role", "USUARIO"),
        "role": datos.get("role", "USUARIO"),
    }


# ──────────────────────────────────────────────
# Listar todos los usuarios (solo admin)
# ──────────────────────────────────────────────
def listar_usuarios(
    limite: int = PAGINA_DEFAULT,
    offset: int = 0,
) -> list[dict]:
    """
    Lista todos los usuarios registrados. Solo para administradores.
    Paginado con límite y offset.
    """
    limite = min(limite, PAGINA_MAX)

    consulta = (
        db.collection("users")
        .order_by("creadoEn", direction="DESCENDING")
        .offset(offset)
        .limit(limite)
    )

    usuarios = []
    for doc in consulta.stream():
        d = doc.to_dict()
        d["uid"] = d.get("uid", doc.id)
        d["rol"] = d.get("role", "USUARIO")
        usuarios.append(d)

    return usuarios


# ──────────────────────────────────────────────
# Promover usuario a administrador
# ──────────────────────────────────────────────
def promover_a_admin(admin_uid: str, target_uid: str) -> dict:
    """
    Cambia el rol de un usuario a ADMIN.
    Solo un administrador existente puede ejecutar esta acción.
    """
    if admin_uid == target_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes promoverte a ti mismo.",
        )

    user_ref = db.collection("users").document(target_uid)
    user_snap = user_ref.get()

    if not user_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario a promover no existe.",
        )

    datos = user_snap.to_dict()
    if datos.get("role") == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya es administrador.",
        )

    user_ref.update(
        {
            "role": "ADMIN",
            "rol": "ADMIN",
            "promovidoPor": admin_uid,
            "promovidoEn": SERVER_TIMESTAMP,
        }
    )

    return {
        "mensaje": "Usuario promovido a administrador correctamente.",
        "uid": target_uid,
    }


# ──────────────────────────────────────────────
# Revocar rol de administrador
# ──────────────────────────────────────────────
def revocar_admin(admin_uid: str, target_uid: str) -> dict:
    """
    Revoca el rol de administrador regresando la cuenta a USUARIO.
    Protege la cuenta primaria admin@encargo.com y evita auto-revocación.
    """
    if admin_uid == target_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes quitarte tu propio rol de administrador por seguridad.",
        )

    user_ref = db.collection("users").document(target_uid)
    user_snap = user_ref.get()

    if not user_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario no existe.",
        )

    datos = user_snap.to_dict()
    if (datos.get("email") or "").lower() == "admin@encargo.com":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se puede revocar el rol de la cuenta principal admin@encargo.com.",
        )

    if datos.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario ya tiene rol estándar de USUARIO.",
        )

    user_ref.update(
        {
            "role": "USUARIO",
            "rol": "USUARIO",
            "revocadoPor": admin_uid,
            "actualizadoEn": SERVER_TIMESTAMP,
        }
    )

    return {
        "mensaje": "Rol de administrador revocado correctamente.",
        "uid": target_uid,
    }


# ──────────────────────────────────────────────
# Banear usuario
# ──────────────────────────────────────────────
def banear_usuario(admin_uid: str, target_uid: str, motivo: str) -> dict:
    """
    Banea a un usuario: marca como baneado en Firestore y deshabilita
    su cuenta en Firebase Auth para impedir el inicio de sesión.
    """
    if admin_uid == target_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes banearte a ti mismo.",
        )

    user_ref = db.collection("users").document(target_uid)
    user_snap = user_ref.get()

    if not user_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario a banear no existe.",
        )

    datos = user_snap.to_dict()
    if datos.get("role") == "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se puede banear a otro administrador.",
        )

    # 1. Marcar como baneado en Firestore
    user_ref.update(
        {
            "banned": True,
            "motivoBaneo": motivo,
            "baneadoPor": admin_uid,
            "baneadoEn": SERVER_TIMESTAMP,
        }
    )

    # 2. Deshabilitar en Firebase Auth si está activo
    if USA_FIREBASE_REAL:
        try:
            from firebase_admin import auth as firebase_auth
            firebase_auth.update_user(target_uid, disabled=True)
        except Exception as exc:
            logger.error(f"Error al deshabilitar usuario en Firebase Auth: {exc}")

    return {
        "mensaje": "Usuario baneado correctamente.",
        "uid": target_uid,
    }


# ──────────────────────────────────────────────
# Desbanear usuario
# ──────────────────────────────────────────────
def desbanear_usuario(admin_uid: str, target_uid: str) -> dict:
    """
    Remueve el baneo de un usuario en Firestore y lo rehabilita en Firebase Auth.
    """
    user_ref = db.collection("users").document(target_uid)
    user_snap = user_ref.get()

    if not user_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario no existe.",
        )

    # 1. Quitar baneo en Firestore
    user_ref.update(
        {
            "banned": False,
            "motivoBaneo": None,
            "desbaneadoPor": admin_uid,
            "desbaneadoEn": SERVER_TIMESTAMP,
        }
    )

    # 2. Rehabilitar en Firebase Auth si está activo
    if USA_FIREBASE_REAL:
        try:
            from firebase_admin import auth as firebase_auth
            firebase_auth.update_user(target_uid, disabled=False)
        except Exception as exc:
            logger.error(f"Error al rehabilitar usuario en Firebase Auth: {exc}")

    return {
        "mensaje": "Baneo revocado. Usuario rehabilitado.",
        "uid": target_uid,
    }
