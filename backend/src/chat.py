"""
Encargo · chat.py
Servicio de mensajería privada entre usuarios.
Seguridad: solo se exponen displayName, photoURL y bio — nunca email ni teléfono ni datos privados.
"""
from __future__ import annotations

import uuid
from typing import Optional
from fastapi import HTTPException, status
from src.config import PAGINA_DEFAULT, PAGINA_MAX
from src.firebase_config import db, SERVER_TIMESTAMP


# ──────────────────────────────────────────────
# Obtener o crear chat entre dos usuarios
# ──────────────────────────────────────────────
def obtener_o_crear_chat(uid1: str, uid2: str) -> dict:
    """
    Busca un chat existente entre los dos usuarios. Si no existe, lo crea.
    Garantiza privacidad total: solo metadatos públicos de perfil.
    """
    if uid1 == uid2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes iniciar un chat contigo mismo.",
        )

    participantes = sorted([uid1, uid2])

    # Buscar chat existente
    chats_query = (
        db.collection("chats")
        .where("participantes", "==", participantes)
        .limit(1)
    )
    resultados = list(chats_query.stream())

    if resultados:
        chat_dict = resultados[0].to_dict()
        chat_dict["id"] = resultados[0].id
        return enriquecer_chat_para_usuario(chat_dict, uid1)

    # Obtener perfiles públicos para metadatos del chat
    perfiles = {}
    for uid in participantes:
        user_snap = db.collection("users").document(uid).get()
        if user_snap.exists:
            datos = user_snap.to_dict()
            perfiles[uid] = {
                "displayName": datos.get("displayName") or datos.get("nombre") or "Usuario",
                "photoURL": datos.get("photoURL", ""),
                "bio": datos.get("bio", ""),
            }
        else:
            perfiles[uid] = {"displayName": "Usuario", "photoURL": "", "bio": ""}

    chat_id = str(uuid.uuid4())
    chat_doc = {
        "id": chat_id,
        "participantes": participantes,
        "perfiles": perfiles,
        "ultimoMensaje": None,
        "ultimoMensajeEn": SERVER_TIMESTAMP,
        "creadoEn": SERVER_TIMESTAMP,
    }

    db.collection("chats").document(chat_id).set(chat_doc)
    return enriquecer_chat_para_usuario(chat_doc, uid1)


def enriquecer_chat_para_usuario(chat_doc: dict, mi_uid: str) -> dict:
    """Calcula campos de la contraparte para facilitar el renderizado en frontend."""
    participantes = chat_doc.get("participantes", [])
    perfiles = chat_doc.get("perfiles", {})
    otro_uid = next((u for u in participantes if u != mi_uid), None) or (participantes[0] if participantes else "")

    otro_perfil = perfiles.get(otro_uid, {})
    chat_doc["otro_uid"] = otro_uid
    chat_doc["otro_nombre"] = otro_perfil.get("displayName", "Usuario")
    chat_doc["otro_foto"] = otro_perfil.get("photoURL", "")
    chat_doc["otro_bio"] = otro_perfil.get("bio", "")
    chat_doc["ultimo_mensaje"] = chat_doc.get("ultimoMensaje", "")
    chat_doc["ultimo_mensaje_fecha"] = chat_doc.get("ultimoMensajeEn", "")
    return chat_doc


# ──────────────────────────────────────────────
# Enviar mensaje en un chat
# ──────────────────────────────────────────────
def enviar_mensaje(uid: str, chat_id: str, texto: str) -> dict:
    """
    Agrega un mensaje a la subcolección 'mensajes' del chat.
    Guarda explícitamente:
    - senderId (UID del remitente autenticado)
    - receiverId (UID del destinatario)
    - senderEmail y receiverEmail
    - content y timestamp de servidor
    """
    chat_ref = db.collection("chats").document(chat_id)
    chat_snap = chat_ref.get()

    if not chat_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat no encontrado.",
        )

    chat_data = chat_snap.to_dict()
    participantes = chat_data.get("participantes", [])

    if uid not in participantes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este chat.",
        )

    # Identificar destinatario
    destinatarios = [p for p in participantes if p != uid]
    receiver_id = destinatarios[0] if destinatarios else ""

    # Obtener correos y nombres reales de remitente y destinatario
    sender_snap = db.collection("users").document(uid).get()
    receiver_snap = db.collection("users").document(receiver_id).get() if receiver_id else None

    sender_email = sender_snap.to_dict().get("email", "") if sender_snap.exists else ""
    sender_name = sender_snap.to_dict().get("nombre") or sender_snap.to_dict().get("displayName") or "Usuario" if sender_snap.exists else "Usuario"

    receiver_email = receiver_snap.to_dict().get("email", "") if receiver_snap and receiver_snap.exists else ""
    receiver_name = receiver_snap.to_dict().get("nombre") or receiver_snap.to_dict().get("displayName") or "Usuario" if receiver_snap and receiver_snap.exists else "Usuario"

    mensaje_id = str(uuid.uuid4())
    texto_limpio = texto.strip()

    mensaje_doc = {
        "id": mensaje_id,
        "chatId": chat_id,
        "senderId": uid,
        "receiverId": receiver_id,
        "senderEmail": sender_email,
        "receiverEmail": receiver_email,
        "senderName": sender_name,
        "receiverName": receiver_name,
        "content": texto_limpio,
        "timestamp": SERVER_TIMESTAMP,
        # Retrocompatibilidad con esquemas previos
        "remitenteId": uid,
        "remitente_uid": uid,
        "texto": texto_limpio,
        "contenido": texto_limpio,
        "creadoEn": SERVER_TIMESTAMP,
        "fecha": SERVER_TIMESTAMP,
    }

    # Guardar en la subcolección
    chat_ref.collection("mensajes").document(mensaje_id).set(mensaje_doc)

    # Actualizar vista previa
    chat_ref.update(
        {
            "ultimoMensaje": texto_limpio[:120],
            "ultimoMensajeEn": SERVER_TIMESTAMP,
            "actualizado_en": SERVER_TIMESTAMP,
        }
    )

    return mensaje_doc


# ──────────────────────────────────────────────
# Listar chats de un usuario
# ──────────────────────────────────────────────
def listar_chats(uid: str) -> list[dict]:
    """
    Lista todos los chats en los que participa el usuario.
    Solo expone datos públicos de los participantes.
    """
    consulta = (
        db.collection("chats")
        .where("participantes", "array_contains", uid)
        .order_by("ultimoMensajeEn", direction="DESCENDING")
    )

    chats = []
    for doc in consulta.stream():
        datos = doc.to_dict()
        datos["id"] = datos.get("id", doc.id)
        chats.append(enriquecer_chat_para_usuario(datos, uid))

    return chats


# ──────────────────────────────────────────────
# Obtener detalle completo de un chat con mensajes
# ──────────────────────────────────────────────
def obtener_chat_detalle(uid: str, chat_id: str, limite: int = PAGINA_DEFAULT) -> dict:
    """
    Obtiene la información del chat y su historial de mensajes ordenados.
    """
    chat_ref = db.collection("chats").document(chat_id)
    chat_snap = chat_ref.get()

    if not chat_snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat no encontrado.",
        )

    chat_data = chat_snap.to_dict()
    chat_data["id"] = chat_id

    if uid not in chat_data.get("participantes", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este chat.",
        )

    info = enriquecer_chat_para_usuario(chat_data, uid)

    mensajes_query = (
        chat_ref.collection("mensajes")
        .order_by("creadoEn", direction="ASCENDING")
        .limit(limite)
    )

    mensajes = []
    for m in mensajes_query.stream():
        m_dict = m.to_dict()
        m_dict["id"] = m.id
        
        # Normalizar identificadores de remitente
        sender_id = m_dict.get("senderId") or m_dict.get("remitenteId") or m_dict.get("remitente_uid") or m_dict.get("autor_uid") or ""
        m_dict["senderId"] = sender_id
        m_dict["remitenteId"] = sender_id
        m_dict["remitente_uid"] = sender_id
        m_dict["autor_uid"] = sender_id

        # Identificadores de destinatario y correos
        m_dict["receiverId"] = m_dict.get("receiverId") or ""
        m_dict["senderEmail"] = m_dict.get("senderEmail") or ""
        m_dict["receiverEmail"] = m_dict.get("receiverEmail") or ""
        m_dict["senderName"] = m_dict.get("senderName") or ""
        m_dict["receiverName"] = m_dict.get("receiverName") or ""

        # Contenido de texto
        content_val = m_dict.get("content") or m_dict.get("contenido") or m_dict.get("texto") or ""
        m_dict["content"] = content_val
        m_dict["contenido"] = content_val
        m_dict["texto"] = content_val

        # Marcas de tiempo
        time_val = m_dict.get("timestamp") or m_dict.get("creadoEn") or m_dict.get("fecha") or ""
        m_dict["timestamp"] = time_val
        m_dict["fecha"] = time_val
        m_dict["creado_en"] = time_val

        mensajes.append(m_dict)

    return {
        "info": info,
        "mensajes": mensajes,
    }


def listar_mensajes(uid: str, chat_id: str, limite: int = PAGINA_DEFAULT) -> list[dict]:
    """Lista solo los mensajes de un chat."""
    detalle = obtener_chat_detalle(uid, chat_id, limite)
    return detalle["mensajes"]
