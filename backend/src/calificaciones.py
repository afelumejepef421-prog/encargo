"""
Encargo · calificaciones.py
Servicio de calificaciones: crear calificación, listar y actualizar promedio.
"""
from __future__ import annotations

import uuid
from typing import Optional
from fastapi import HTTPException, status
from src.firebase_config import db, SERVER_TIMESTAMP
from src.schemas import CrearCalificacion


# ──────────────────────────────────────────────
# Crear calificación
# ──────────────────────────────────────────────
def calificar(uid: str, data: CrearCalificacion) -> dict:
    """
    Crea una nueva calificación para un usuario.
    - Impide calificarse a sí mismo.
    - Impide duplicados en la misma solicitud o directo.
    - Actualiza el promedio del usuario calificado en Firestore.
    """
    if data.calificadoId == uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes calificarte a ti mismo.",
        )

    # Verificar existencia de la solicitud solo si no es calificación directa
    if data.solicitudId and data.solicitudId != "directo":
        sol_snap = db.collection("solicitudes").document(data.solicitudId).get()
        # No bloquear si la solicitud ya fue eliminada o archivada

    # Verificar que el usuario calificado existe
    user_snap = db.collection("users").document(data.calificadoId).get()
    if not user_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El usuario a calificar no existe.",
        )

    # Obtener nombre del calificador
    calificador_snap = db.collection("users").document(uid).get()
    nombre_calificador = "Usuario"
    if calificador_snap.exists:
        c_datos = calificador_snap.to_dict()
        nombre_calificador = c_datos.get("displayName") or c_datos.get("nombre") or "Usuario"

    # Verificar duplicado
    duplicado_query = (
        db.collection("calificaciones")
        .where("calificadorId", "==", uid)
        .where("calificadoId", "==", data.calificadoId)
        .where("solicitudId", "==", data.solicitudId or "directo")
        .limit(1)
    )
    if list(duplicado_query.stream()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya has calificado a este usuario en esta ocasión.",
        )

    calificacion_id = str(uuid.uuid4())

    documento = {
        "id": calificacion_id,
        "solicitudId": data.solicitudId or "directo",
        "calificadorId": uid,
        "calificador_uid": uid,
        "calificadorNombre": nombre_calificador,
        "calificador_nombre": nombre_calificador,
        "calificadoId": data.calificadoId,
        "calificado_uid": data.calificadoId,
        "valor": data.valor,
        "puntuacion": data.valor,
        "estrellas": data.valor,
        "comentario": data.comentario.strip() if data.comentario else None,
        "creadoEn": SERVER_TIMESTAMP,
        "fecha": SERVER_TIMESTAMP,
    }

    db.collection("calificaciones").document(calificacion_id).set(documento)

    # Recalcular promedio del usuario calificado
    actualizar_promedio(data.calificadoId)

    return documento


# ──────────────────────────────────────────────
# Obtener calificaciones de un usuario
# ──────────────────────────────────────────────
def obtener_calificaciones_usuario(uid: str) -> list[dict]:
    """
    Obtiene todas las calificaciones recibidas por un usuario.
    """
    consulta = (
        db.collection("calificaciones")
        .where("calificadoId", "==", uid)
        .order_by("creadoEn", direction="DESCENDING")
    )

    calificaciones = []
    for doc in consulta.stream():
        d = doc.to_dict()
        d["id"] = d.get("id", doc.id)
        d["puntuacion"] = d.get("valor", 5)
        d["estrellas"] = d.get("valor", 5)
        calificaciones.append(d)

    return calificaciones


# ──────────────────────────────────────────────
# Actualizar promedio del usuario
# ──────────────────────────────────────────────
def actualizar_promedio(uid: str):
    """
    Recalcula el promedio de calificaciones y el total para un usuario
    y actualiza su documento en Firestore.
    """
    calificaciones = obtener_calificaciones_usuario(uid)

    if not calificaciones:
        db.collection("users").document(uid).update(
            {
                "promedioCalificacion": 0.0,
                "promedio": 0.0,
                "totalCalificaciones": 0,
            }
        )
        return

    total = len(calificaciones)
    suma = sum(c.get("valor", 0) for c in calificaciones)
    promedio = round(suma / total, 2)

    db.collection("users").document(uid).update(
        {
            "promedioCalificacion": promedio,
            "promedio": promedio,
            "totalCalificaciones": total,
        }
    )
