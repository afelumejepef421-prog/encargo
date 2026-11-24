"""
Encargo · auth.py
Dependencias de autenticación y autorización basadas en Firebase Auth.
"""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from src.firebase_config import db, verificar_token, SERVER_TIMESTAMP


# ──────────────────────────────────────────────
# Dependencia principal: obtener usuario actual
# ──────────────────────────────────────────────
async def get_current_user(
    authorization: str = Header(
        ...,
        description="Token Bearer de Firebase Auth",
    ),
) -> dict:
    """
    Extrae el Bearer token del header Authorization, lo verifica con
    Firebase Auth, consulta el perfil en Firestore y comprueba que el
    usuario no esté baneado.

    Retorna un diccionario con: uid, email, role, displayName, banned.
    """
    # Extraer el token del header "Bearer <token>"
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato de autorización inválido. Use 'Bearer <token>'.",
        )

    id_token = authorization[len("Bearer "):]

    # Verificar el token con Firebase Auth
    try:
        decoded = verificar_token(id_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )

    uid: str = decoded["uid"]

    # Consultar el perfil del usuario en Firestore
    user_ref = db.collection("users").document(uid)
    user_snap = user_ref.get()

    if not user_snap.exists:
        # Si el documento no existe todavía, crearlo con valores por defecto
        # (primer inicio de sesión tras registro en Firebase Auth)
        perfil_inicial = {
            "uid": uid,
            "email": decoded.get("email", ""),
            "displayName": decoded.get("name", ""),
            "photoURL": decoded.get("picture", ""),
            "role": "USUARIO",
            "banned": False,
            "bio": "",
            "municipio": "",
            "apellidos": "",
            "promedioCalificacion": 0.0,
            "totalCalificaciones": 0,
            "creadoEn": SERVER_TIMESTAMP,
        }
        user_ref.set(perfil_inicial)
        return {
            "uid": uid,
            "email": perfil_inicial["email"],
            "role": perfil_inicial["role"],
            "displayName": perfil_inicial["displayName"],
            "banned": False,
        }

    datos = user_snap.to_dict()

    # Verificar si el usuario está baneado
    if datos.get("banned", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta ha sido suspendida. Contacta al soporte.",
        )

    return {
        "uid": uid,
        "email": datos.get("email", ""),
        "role": datos.get("role", "USUARIO"),
        "displayName": datos.get("displayName", ""),
        "banned": datos.get("banned", False),
    }


# ──────────────────────────────────────────────
# Dependencia: requerir rol ADMIN
# ──────────────────────────────────────────────
async def require_admin(
    usuario: dict = Depends(get_current_user),
) -> dict:
    """
    Dependencia que exige que el usuario autenticado tenga rol ADMIN.
    Lanza 403 si el rol no es ADMIN.
    """
    if usuario.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido a administradores.",
        )
    return usuario
