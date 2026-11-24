"""
Encargo · seed_firebase.py
Script de siembra inicial de datos para Cloud Firestore (y modo Local Mock).
Puebla:
- 1 Administrador principal
- 2 Usuarios de prueba
- Solicitudes públicas de servicios en diferentes categorías y municipios
- Chat de prueba con mensajes recíprocos
- Calificaciones mutuas y promedios de reputación
- Reporte pendiente en la bandeja de moderación
"""
from __future__ import annotations

import datetime
import logging
import os
import sys

# Asegurar que 'backend' está en el path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from src.firebase_config import db, USA_FIREBASE_REAL

logger = logging.getLogger("encargo.seed")
logging.basicConfig(level=logging.INFO)

def ahora_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def sembrar_datos_iniciales():
    """Siembra los datos base de usuarios, solicitudes, chat, calificaciones y reportes."""
    logger.info("🌱 Iniciando siembra de datos iniciales en Firestore...")

    # 1. USUARIOS Y ADMINISTRADOR
    usuarios_base = [
        {
            "uid": "admin-master-uid",
            "email": "admin@encargo.com",
            "nombre": "Carlos",
            "apellidos": "Administrador",
            "telefono": "3005550100",
            "municipio": "Bogotá D.C.",
            "role": "ADMIN",
            "photoURL": "",
            "bio": "Administrador principal de la plataforma comunitaria Encargo.",
            "reputacion_promedio": 5.0,
            "total_calificaciones": 1,
            "banned": False,
            "creado_en": ahora_iso(),
        },
        {
            "uid": "usr-luis-uid",
            "email": "luis.morales@ejemplo.com",
            "nombre": "Luis",
            "apellidos": "Morales",
            "telefono": "3005550201",
            "municipio": "Medellín (Antioquia)",
            "role": "USUARIO",
            "photoURL": "",
            "bio": "Residente de Medellín. Busco técnicos calificados para mejoras en el hogar.",
            "reputacion_promedio": 4.9,
            "total_calificaciones": 4,
            "banned": False,
            "creado_en": ahora_iso(),
        },
        {
            "uid": "usr-elena-uid",
            "email": "elena.vega@ejemplo.com",
            "nombre": "Elena",
            "apellidos": "Vega",
            "telefono": "3005550202",
            "municipio": "Cali (Valle del Cauca)",
            "role": "USUARIO",
            "photoURL": "",
            "bio": "Especialista en plomería residencial, filtraciones e instalaciones sanitarias.",
            "reputacion_promedio": 5.0,
            "total_calificaciones": 6,
            "banned": False,
            "creado_en": ahora_iso(),
        },
        {
            "uid": "usr-roberto-uid",
            "email": "roberto.torres@ejemplo.com",
            "nombre": "Roberto",
            "apellidos": "Torres",
            "telefono": "3005550203",
            "municipio": "Barranquilla (Atlántico)",
            "role": "USUARIO",
            "photoURL": "",
            "bio": "Electricista certificado. Instalaciones eléctricas y paneles solares.",
            "reputacion_promedio": 4.7,
            "total_calificaciones": 3,
            "banned": False,
            "creado_en": ahora_iso(),
        },
    ]

    for u in usuarios_base:
        ref = db.collection("users").document(u["uid"])
        if not ref.get().exists:
            ref.set(u)
    logger.info(f"✅ Usuarios base verificados/sembrados sin duplicados ({len(usuarios_base)}).")

    # 2. SOLICITUDES DE SERVICIO (Base existente + 5 adicionales variadas e idempotentes)
    solicitudes_base = [
        {
            "id": "sol-plomeria-01",
            "autor_uid": "usr-luis-uid",
            "autor_email": "luis.morales@ejemplo.com",
            "autor_nombre": "Luis Morales",
            "autor_foto": "",
            "autor_municipio": "Medellín (Antioquia)",
            "titulo": "Reparación urgente de tubería en cocina",
            "descripcion": "Tengo una filtración bajo el fregadero de la cocina que está dañando el gabinete. Se requiere cambio de tubería PVC y ajuste de llaves de paso.",
            "categoria": "Plomería",
            "municipio": "Medellín (Antioquia)",
            "fecha_deseada": "2026-11-28",
            "estado": "PUBLICADO",
            "imagenes": [],
            "creado_en": ahora_iso(),
            "actualizado_en": ahora_iso(),
        },
        {
            "id": "sol-electricidad-02",
            "autor_uid": "usr-elena-uid",
            "autor_email": "elena.vega@ejemplo.com",
            "autor_nombre": "Elena Vega",
            "autor_foto": "",
            "autor_municipio": "Cali (Valle del Cauca)",
            "titulo": "Instalación de 6 lámparas empotradas LED",
            "descripcion": "Busco electricista para instalar 6 lámparas en cielo raso de la sala. El cableado principal ya está colocado.",
            "categoria": "Electricidad",
            "municipio": "Cali (Valle del Cauca)",
            "fecha_deseada": "2026-11-30",
            "estado": "PUBLICADO",
            "imagenes": [],
            "creado_en": ahora_iso(),
            "actualizado_en": ahora_iso(),
        },
        {
            "id": "sol-pintura-03",
            "autor_uid": "usr-luis-uid",
            "autor_email": "luis.morales@ejemplo.com",
            "autor_nombre": "Luis Morales",
            "autor_foto": "",
            "autor_municipio": "Medellín (Antioquia)",
            "titulo": "Pintura exterior para fachada de 2 niveles",
            "descripcion": "Se requiere preparación de pared (lavado a presión, sellador) y aplicación de dos manos de pintura exterior de alta durabilidad.",
            "categoria": "Pintura",
            "municipio": "Medellín (Antioquia)",
            "fecha_deseada": "2026-12-05",
            "estado": "PUBLICADO",
            "imagenes": [],
            "creado_en": ahora_iso(),
            "actualizado_en": ahora_iso(),
        },
        {
            "id": "sol-carpinteria-04",
            "autor_uid": "usr-roberto-uid",
            "autor_email": "roberto.torres@ejemplo.com",
            "autor_nombre": "Roberto Torres",
            "autor_foto": "",
            "autor_municipio": "Barranquilla (Atlántico)",
            "titulo": "Fabricación e instalación de repisas flotantes",
            "descripcion": "Necesito 3 repisas flotantes en madera tratada para una oficina pequeña en Barranquilla. Dimensiones 1.20m x 25cm.",
            "categoria": "Carpintería",
            "municipio": "Barranquilla (Atlántico)",
            "fecha_deseada": "2026-12-02",
            "estado": "PUBLICADO",
            "imagenes": [],
            "creado_en": ahora_iso(),
            "actualizado_en": ahora_iso(),
        },
        # 5 solicitudes adicionales variadas por usuario y categoría
        {
            "id": "seed-sol-limpieza-05",
            "autor_uid": "usr-elena-uid",
            "autor_email": "elena.vega@ejemplo.com",
            "autor_nombre": "Elena Vega",
            "autor_foto": "",
            "autor_municipio": "Cali (Valle del Cauca)",
            "titulo": "Limpieza profunda de apartamento después de remodelación",
            "descripcion": "Requiero servicio de aseo general y desinfección en apartamento de 85 m2 en el sur de Cali, incluyendo vidrios y cocina integral.",
            "categoria": "Limpieza",
            "municipio": "Cali (Valle del Cauca)",
            "fecha_deseada": "2026-12-03",
            "estado": "PUBLICADO",
            "imagenes": [],
            "creado_en": ahora_iso(),
            "actualizado_en": ahora_iso(),
        },
        {
            "id": "seed-sol-jardineria-06",
            "autor_uid": "usr-luis-uid",
            "autor_email": "luis.morales@ejemplo.com",
            "autor_nombre": "Luis Morales",
            "autor_foto": "",
            "autor_municipio": "Envigado (Antioquia)",
            "titulo": "Poda de árboles y mantenimiento de jardín residencial",
            "descripcion": "Necesito jardinero con herramienta propia para corte de césped, poda de arbustos ornamentales y limpieza de terraza.",
            "categoria": "Jardinería",
            "municipio": "Envigado (Antioquia)",
            "fecha_deseada": "2026-12-04",
            "estado": "PUBLICADO",
            "imagenes": [],
            "creado_en": ahora_iso(),
            "actualizado_en": ahora_iso(),
        },
        {
            "id": "seed-sol-tecnologia-07",
            "autor_uid": "usr-roberto-uid",
            "autor_email": "roberto.torres@ejemplo.com",
            "autor_nombre": "Roberto Torres",
            "autor_foto": "",
            "autor_municipio": "Barranquilla (Atlántico)",
            "titulo": "Configuración de red WiFi Mesh y cableado de oficina",
            "descripcion": "Busco técnico en redes para instalar 3 nodos WiFi Mesh, ponchar 4 puntos de red Cat6 y optimizar la cobertura en oficina.",
            "categoria": "Tecnología",
            "municipio": "Barranquilla (Atlántico)",
            "fecha_deseada": "2026-12-06",
            "estado": "PUBLICADO",
            "imagenes": [],
            "creado_en": ahora_iso(),
            "actualizado_en": ahora_iso(),
        },
        {
            "id": "seed-sol-cerrajeria-08",
            "autor_uid": "usr-elena-uid",
            "autor_email": "elena.vega@ejemplo.com",
            "autor_nombre": "Elena Vega",
            "autor_foto": "",
            "autor_municipio": "Palmira (Valle del Cauca)",
            "titulo": "Cambio de cerradura de seguridad en puerta principal",
            "descripcion": "Requiero cerrajero confiable para reemplazar cerradura multipunto en puerta metálica e instalar pasador adicional.",
            "categoria": "Cerrajería",
            "municipio": "Palmira (Valle del Cauca)",
            "fecha_deseada": "2026-12-07",
            "estado": "PUBLICADO",
            "imagenes": [],
            "creado_en": ahora_iso(),
            "actualizado_en": ahora_iso(),
        },
        {
            "id": "seed-sol-mudanza-09",
            "autor_uid": "usr-luis-uid",
            "autor_email": "luis.morales@ejemplo.com",
            "autor_nombre": "Luis Morales",
            "autor_foto": "",
            "autor_municipio": "Medellín (Antioquia)",
            "titulo": "Servicio de trasteo urbano con camión cubierto y 2 ayudantes",
            "descripcion": "Mudanza de enseres de apartamento de 2 habitaciones dentro de Medellín. Incluye nevera, lavadora, cama doble y cajas.",
            "categoria": "Mudanza",
            "municipio": "Medellín (Antioquia)",
            "fecha_deseada": "2026-12-09",
            "estado": "PUBLICADO",
            "imagenes": [],
            "creado_en": ahora_iso(),
            "actualizado_en": ahora_iso(),
        },
    ]

    creadas = 0
    for s in solicitudes_base:
        ref = db.collection("solicitudes").document(s["id"])
        if not ref.get().exists:
            ref.set(s)
            creadas += 1
    logger.info(f"✅ Solicitudes verificadas sin duplicados: {creadas} nuevas sembradas, {len(solicitudes_base)} en total.")

    # 3. CHAT PRIVADO ENTRE LUIS Y ELENA
    uids_chat = sorted(["usr-luis-uid", "usr-elena-uid"])
    chat_id = f"{uids_chat[0]}_{uids_chat[1]}"
    chat_doc = {
        "id": chat_id,
        "participantes": uids_chat,
        "ultimo_mensaje": "Perfecto, coordinamos para el viernes en la mañana.",
        "actualizado_en": ahora_iso(),
        "creado_en": ahora_iso(),
    }
    db.collection("chats").document(chat_id).set(chat_doc)

    mensajes_chat = [
        {
            "id": "msg-01",
            "senderId": "usr-luis-uid",
            "receiverId": "usr-elena-uid",
            "senderEmail": "luis.morales@ejemplo.com",
            "receiverEmail": "elena.vega@ejemplo.com",
            "senderName": "Luis Morales",
            "receiverName": "Elena Vega",
            "content": "Hola Elena, vi tu experiencia en plomería. ¿Estás disponible para revisar la filtración en Medellín?",
            "timestamp": ahora_iso(),
            "remitente_uid": "usr-luis-uid",
            "remitenteId": "usr-luis-uid",
            "texto": "Hola Elena, vi tu experiencia en plomería. ¿Estás disponible para revisar la filtración en Medellín?",
            "creado_en": ahora_iso(),
        },
        {
            "id": "msg-02",
            "senderId": "usr-elena-uid",
            "receiverId": "usr-luis-uid",
            "senderEmail": "elena.vega@ejemplo.com",
            "receiverEmail": "luis.morales@ejemplo.com",
            "senderName": "Elena Vega",
            "receiverName": "Luis Morales",
            "content": "¡Hola Luis! Sí, tengo espacio este viernes. ¿Tienes fotos o detalles del tipo de tubería?",
            "timestamp": ahora_iso(),
            "remitente_uid": "usr-elena-uid",
            "remitenteId": "usr-elena-uid",
            "texto": "¡Hola Luis! Sí, tengo espacio este viernes. ¿Tienes fotos o detalles del tipo de tubería?",
            "creado_en": ahora_iso(),
        },
        {
            "id": "msg-03",
            "senderId": "usr-luis-uid",
            "receiverId": "usr-elena-uid",
            "senderEmail": "luis.morales@ejemplo.com",
            "receiverEmail": "elena.vega@ejemplo.com",
            "senderName": "Luis Morales",
            "receiverName": "Elena Vega",
            "content": "Perfecto, coordinamos para el viernes en la mañana.",
            "timestamp": ahora_iso(),
            "remitente_uid": "usr-luis-uid",
            "remitenteId": "usr-luis-uid",
            "texto": "Perfecto, coordinamos para el viernes en la mañana.",
            "creado_en": ahora_iso(),
        },
    ]

    mensajes_col = db.collection("chats").document(chat_id).collection("mensajes")
    for m in mensajes_chat:
        mensajes_col.document(m["id"]).set(m)
    logger.info(f"✅ Chat inicial creado con {len(mensajes_chat)} mensajes de prueba.")

    # 4. CALIFICACIONES MUTUAS
    calificaciones_base = [
        {
            "id": "calif-01",
            "evaluador_uid": "usr-luis-uid",
            "evaluado_uid": "usr-elena-uid",
            "solicitud_id": "sol-plomeria-01",
            "estrellas": 5,
            "comentario": "Trabajo impecable. Llegó a tiempo, resolvió la fuga en menos de una hora y dejó todo limpio. ¡100% recomendada!",
            "creado_en": ahora_iso(),
        },
        {
            "id": "calif-02",
            "evaluador_uid": "usr-elena-uid",
            "evaluado_uid": "usr-luis-uid",
            "solicitud_id": "sol-plomeria-01",
            "estrellas": 5,
            "comentario": "Excelente cliente. Trato muy cordial, instrucciones claras y pago inmediato.",
            "creado_en": ahora_iso(),
        },
    ]

    for c in calificaciones_base:
        db.collection("calificaciones").document(c["id"]).set(c)
    logger.info(f"✅ {len(calificaciones_base)} calificaciones mutuas registradas.")

    # 5. REPORTE DE EJEMPLO
    reporte_base = {
        "id": "rep-ejemplo-01",
        "reportante_uid": "usr-roberto-uid",
        "reportado_uid": "usr-luis-uid",
        "solicitud_id": "sol-pintura-03",
        "tipo": "SOLICITUD",
        "motivo": "Verificación de requisitos de seguridad en trabajos de altura para pintura exterior.",
        "estado": "PENDIENTE",
        "resolucion": None,
        "atendido_por": None,
        "creado_en": ahora_iso(),
    }
    db.collection("reportes").document(reporte_base["id"]).set(reporte_base)
    logger.info("✅ Reporte de prueba registrado en la bandeja de moderación.")

    logger.info("🎉 ¡Siembra inicial de Firestore completada con éxito!")

if __name__ == "__main__":
    sembrar_datos_iniciales()
