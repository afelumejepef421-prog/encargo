"""
Encargo · reportes.py
Servicio de reportes: creación, listado y resolución por administradores.
"""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from src.config import PAGINA_DEFAULT, PAGINA_MAX
from src.firebase_config import db, SERVER_TIMESTAMP, USA_FIREBASE_REAL
from src.schemas import AccionReporte, CrearReporte, ResolucionReporte


# ──────────────────────────────────────────────
# Crear reporte
# ──────────────────────────────────────────────
def crear_reporte(uid: str, data: CrearReporte) -> dict:
    """
    Crea un nuevo reporte en Firestore.
    Verifica que el objetivo (usuario o solicitud) exista.
    """
    # Verificar que el usuario no se reporte a sí mismo
    if data.tipo.value == "USUARIO" and data.objetivoId == uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes reportarte a ti mismo.",
        )

    # Verificar que el objetivo existe
    if data.tipo.value == "SOLICITUD":
        sol_snap = db.collection("solicitudes").document(data.objetivoId).get()
        if not sol_snap.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La solicitud reportada no existe.",
            )
    elif data.tipo.value == "USUARIO":
        user_snap = db.collection("users").document(data.objetivoId).get()
        if not user_snap.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El usuario reportado no existe.",
            )

    reporte_id = str(uuid.uuid4())

    documento = {
        "id": reporte_id,
        "reportadoPor": uid,
        "tipo": data.tipo.value,
        "objetivoId": data.objetivoId,
        "motivo": data.motivo.strip(),
        "descripcion": data.descripcion.strip(),
        "estado": "PENDIENTE",
        "resolucion": None,
        "accion": None,
        "resueltoPor": None,
        "resueltoEn": None,
        "creadoEn": SERVER_TIMESTAMP,
    }

    db.collection("reportes").document(reporte_id).set(documento)

    return documento


# ──────────────────────────────────────────────
# Listar reportes (solo administradores)
# ──────────────────────────────────────────────
def listar_reportes(
    estado: str | None = None,
    limite: int = PAGINA_DEFAULT,
    offset: int = 0,
) -> list[dict]:
    """
    Lista reportes con filtro opcional por estado.
    Paginación con límite y offset.
    """
    limite = min(limite, PAGINA_MAX)

    consulta = db.collection("reportes")

    if estado:
        consulta = consulta.where("estado", "==", estado.upper())

    consulta = consulta.order_by("creadoEn", direction="DESCENDING")
    consulta = consulta.offset(offset).limit(limite)

    resultados = []
    for doc in consulta.stream():
        resultados.append(doc.to_dict())

    return resultados


# ──────────────────────────────────────────────
# Resolver reporte
# ──────────────────────────────────────────────
def resolver_reporte(
    admin_uid: str, reporte_id: str, data: ResolucionReporte
) -> dict:
    """
    Resuelve un reporte aplicando la acción correspondiente:
    - CERRAR: solo cierra el reporte sin acción adicional.
    - BAN_USUARIO: banea al usuario objetivo en Firestore y deshabilita en Auth.
    - ELIMINAR_SOLICITUD: elimina la solicitud objetivo de Firestore.
    """
    reporte_ref = db.collection("reportes").document(reporte_id)
    reporte_snap = reporte_ref.get()

    if not reporte_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reporte no encontrado.",
        )

    reporte_data = reporte_snap.to_dict()

    if reporte_data.get("estado") != "PENDIENTE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este reporte ya fue resuelto.",
        )

    objetivo_id = reporte_data.get("objetivoId", "")

    # Ejecutar la acción correspondiente
    if data.accion == AccionReporte.BAN_USUARIO:
        # Determinar el UID del usuario a banear
        if reporte_data.get("tipo") == "USUARIO":
            uid_a_banear = objetivo_id
        elif reporte_data.get("tipo") == "SOLICITUD":
            # Si se reportó una solicitud, banear al dueño de la solicitud
            sol_snap = db.collection("solicitudes").document(objetivo_id).get()
            if not sol_snap.exists:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="La solicitud asociada al reporte ya no existe.",
                )
            uid_a_banear = sol_snap.to_dict().get("uid", "")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede determinar el usuario a banear.",
            )

        # Banear en Firestore
        user_ref = db.collection("users").document(uid_a_banear)
        user_snap = user_ref.get()
        if not user_snap.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El usuario a banear no existe.",
            )

        user_ref.update(
            {
                "banned": True,
                "banMotivo": data.resolucion.strip(),
                "baneadoPor": admin_uid,
                "baneadoEn": SERVER_TIMESTAMP,
            }
        )

        # Deshabilitar en Firebase Auth si está activo
        if USA_FIREBASE_REAL:
            try:
                from firebase_admin import auth as firebase_auth
                firebase_auth.update_user(uid_a_banear, disabled=True)
            except Exception as e:
                pass

    elif data.accion == AccionReporte.ELIMINAR_SOLICITUD:
        if reporte_data.get("tipo") != "SOLICITUD":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La acción ELIMINAR_SOLICITUD solo aplica a reportes de solicitudes.",
            )

        sol_ref = db.collection("solicitudes").document(objetivo_id)
        sol_snap = sol_ref.get()
        if not sol_snap.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La solicitud ya fue eliminada.",
            )

        sol_ref.delete()

    # Actualizar el reporte como resuelto
    reporte_ref.update(
        {
            "estado": "RESUELTO",
            "resolucion": data.resolucion.strip(),
            "accion": data.accion.value,
            "resueltoPor": admin_uid,
            "resueltoEn": SERVER_TIMESTAMP,
        }
    )

    return {
        "mensaje": "Reporte resuelto correctamente.",
        "id": reporte_id,
        "accion": data.accion.value,
    }
