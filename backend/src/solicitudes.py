"""
Encargo · solicitudes.py
Servicio de solicitudes de servicios: crear, listar, obtener, eliminar y cancelar.
"""
from __future__ import annotations

import uuid
from datetime import date
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from src.config import (
    ARCHIVO_MAX_BYTES,
    CATEGORIAS,
    IMAGENES_SOLICITUD_MAX,
    PAGINA_DEFAULT,
    PAGINA_MAX,
)
from src.firebase_config import bucket, db, SERVER_TIMESTAMP
from src.schemas import CrearSolicitud


# ──────────────────────────────────────────────
# Crear solicitud
# ──────────────────────────────────────────────
def crear_solicitud(uid: str, data: CrearSolicitud) -> dict:
    """
    Crea una nueva solicitud de servicio en Firestore.
    Guarda con estado PUBLICADO y datos denormalizados del autor.
    """
    solicitud_id = str(uuid.uuid4())

    # Obtener datos del autor para listados rápidos
    user_snap = db.collection("users").document(uid).get()
    nombre_autor = "Usuario"
    foto_autor = ""
    email_autor = ""
    if user_snap.exists:
        u_data = user_snap.to_dict()
        nombre_autor = u_data.get("displayName") or u_data.get("nombre") or "Usuario"
        foto_autor = u_data.get("photoURL", "")
        email_autor = u_data.get("email", "")

    fecha_deseada_str = None
    if data.fechaDeseada:
        fecha_deseada_str = data.fechaDeseada.isoformat()
    elif data.fecha_deseada:
        fecha_deseada_str = str(data.fecha_deseada)

    categoria_nombre = CATEGORIAS.get(data.categoria, data.categoria)

    documento = {
        "id": solicitud_id,
        "uid": uid,
        "autor_uid": uid,
        "autorUid": uid,
        "autor_email": email_autor,
        "autor_nombre": nombre_autor,
        "autorNombre": nombre_autor,
        "autor_foto": foto_autor,
        "autorFoto": foto_autor,
        "titulo": data.titulo.strip(),
        "descripcion": data.descripcion.strip(),
        "categoria": data.categoria,
        "categoriaNombre": categoria_nombre,
        "municipio": data.municipio.strip(),
        "fechaDeseada": fecha_deseada_str,
        "fecha_deseada": fecha_deseada_str,
        "estado": "PUBLICADO",
        "imagenes": [],
        "creadoEn": SERVER_TIMESTAMP,
        "creado_en": SERVER_TIMESTAMP,
        "actualizadoEn": SERVER_TIMESTAMP,
    }

    db.collection("solicitudes").document(solicitud_id).set(documento)

    return documento


# ──────────────────────────────────────────────
# Subir imágenes a una solicitud
# ──────────────────────────────────────────────
async def subir_imagenes_solicitud(
    uid: str, solicitud_id: str, archivos: list[UploadFile]
) -> list[str]:
    """
    Sube imágenes al Storage de Firebase y actualiza la solicitud con sus URLs.
    """
    sol_ref = db.collection("solicitudes").document(solicitud_id)
    sol_snap = sol_ref.get()

    if not sol_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada.",
        )

    sol_data = sol_snap.to_dict()
    if sol_data.get("uid") != uid and sol_data.get("autor_uid") != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el propietario puede subir imágenes a esta solicitud.",
        )

    imagenes_actuales = sol_data.get("imagenes", [])
    if len(imagenes_actuales) + len(archivos) > IMAGENES_SOLICITUD_MAX:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Máximo {IMAGENES_SOLICITUD_MAX} imágenes por solicitud.",
        )

    urls_nuevas: list[str] = []

    for archivo in archivos:
        contenido = await archivo.read()
        if len(contenido) > ARCHIVO_MAX_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El archivo '{archivo.filename}' supera los 5 MiB.",
            )

        extension = archivo.filename.rsplit(".", 1)[-1] if archivo.filename else "jpg"
        nombre_storage = f"solicitudes/{solicitud_id}/{uuid.uuid4().hex}.{extension}"

        blob = bucket.blob(nombre_storage)
        blob.upload_from_string(contenido, content_type=archivo.content_type or "image/jpeg")
        blob.make_public()
        urls_nuevas.append(blob.public_url)

    sol_ref.update(
        {
            "imagenes": imagenes_actuales + urls_nuevas,
            "actualizadoEn": SERVER_TIMESTAMP,
        }
    )

    return urls_nuevas


# ──────────────────────────────────────────────
# Listar solicitudes con filtros y paginación
# ──────────────────────────────────────────────
def listar_solicitudes(
    categoria: Optional[str] = None,
    municipio: Optional[str] = None,
    limite: int = PAGINA_DEFAULT,
    offset: int = 0,
) -> list[dict]:
    """
    Consulta solicitudes en Firestore con filtros opcionales.
    """
    limite = min(limite, PAGINA_MAX)

    consulta = db.collection("solicitudes")

    if categoria:
        consulta = consulta.where("categoria", "==", categoria)

    if municipio:
        consulta = consulta.where("municipio", "==", municipio.strip())

    consulta = consulta.order_by("creadoEn", direction="DESCENDING")
    consulta = consulta.offset(offset).limit(limite)

    resultados = []
    for doc in consulta.stream():
        datos = doc.to_dict()
        datos["id"] = datos.get("id", doc.id)
        resultados.append(datos)

    return resultados


# ──────────────────────────────────────────────
# Obtener una solicitud por ID
# ──────────────────────────────────────────────
def obtener_solicitud(solicitud_id: str) -> dict:
    """Obtiene una solicitud por su ID."""
    doc = db.collection("solicitudes").document(solicitud_id).get()

    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada.",
        )

    datos = doc.to_dict()
    datos["id"] = doc.id
    return datos


# ──────────────────────────────────────────────
# Eliminar solicitud (propietario o ADMIN)
# ──────────────────────────────────────────────
def eliminar_solicitud(uid: str, role: str, solicitud_id: str) -> dict:
    """
    Elimina una solicitud de Firestore.
    Un usuario solo puede eliminar las que él mismo haya creado.
    Un Administrador puede eliminar cualquier solicitud del sistema.
    """
    sol_ref = db.collection("solicitudes").document(solicitud_id)
    sol_snap = sol_ref.get()

    if not sol_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada.",
        )

    sol_data = sol_snap.to_dict()
    propietario_uid = sol_data.get("uid") or sol_data.get("autor_uid")

    if propietario_uid != uid and role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes autorización para eliminar esta solicitud.",
        )

    sol_ref.delete()

    return {
        "mensaje": "Solicitud eliminada exitosamente.",
        "id": solicitud_id,
    }


# ──────────────────────────────────────────────
# Cancelar solicitud (solo el creador)
# ──────────────────────────────────────────────
def cancelar_solicitud(uid: str, solicitud_id: str) -> dict:
    """
    Permite al usuario creador cancelar una solicitud previa.
    """
    sol_ref = db.collection("solicitudes").document(solicitud_id)
    sol_snap = sol_ref.get()

    if not sol_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada.",
        )

    sol_data = sol_snap.to_dict()
    propietario_uid = sol_data.get("uid") or sol_data.get("autor_uid")

    if propietario_uid != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el creador puede cancelar esta solicitud.",
        )

    sol_ref.update(
        {
            "estado": "CANCELADO",
            "actualizadoEn": SERVER_TIMESTAMP,
        }
    )

    return {
        "mensaje": "Solicitud cancelada exitosamente.",
        "id": solicitud_id,
        "estado": "CANCELADO",
    }
