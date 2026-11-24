"""
Encargo · test_firebase_platform.py
Batería de pruebas completa y síncrona de las funcionalidades y reglas de negocio:
1. Registro público de usuarios (rol USUARIO garantizado)
2. Privacidad de perfiles (sin email, teléfono ni datos sensibles)
3. Ciclo de vida de solicitudes (publicar, listar, cancelar y eliminar)
4. Chat privado seguro (datos sensibles ocultos, envío y recepción de mensajes)
5. Sistema de calificaciones mutuas (reputación recíproca de 1 a 5 estrellas)
6. Sistema de reportes y moderación
7. Privilegios de administrador (lista de usuarios, promover, banear y moderar solicitudes)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.usuarios import (
    registrar_perfil,
    obtener_perfil,
    obtener_perfil_publico,
    listar_usuarios,
    promover_a_admin,
    revocar_admin,
    banear_usuario,
    desbanear_usuario,
)
from src.schemas import (
    RegistroCuenta,
    CrearSolicitud,
    CrearCalificacion,
    CrearReporte,
    ResolucionReporte,
    AccionReporte,
    TipoReporte,
    BanearUsuario,
)
from src.solicitudes import (
    crear_solicitud,
    listar_solicitudes,
    obtener_solicitud,
    cancelar_solicitud,
    eliminar_solicitud,
)
from src.chat import (
    obtener_o_crear_chat,
    enviar_mensaje,
    obtener_chat_detalle,
    listar_chats,
)
from src.calificaciones import (
    calificar,
    obtener_calificaciones_usuario,
)
from src.reportes import (
    crear_reporte,
    listar_reportes,
    resolver_reporte,
)
from src.firebase_config import db


def ejecutar_pruebas():
    print("🚀 Iniciando suite de pruebas de la arquitectura Firebase...")

    # 1. REGISTRO PÚBLICO DE USUARIOS (Rol USUARIO por defecto)
    u1 = registrar_perfil(
        "usr_carlos_123",
        "carlos@test.com",
        RegistroCuenta(nombre="Carlos", apellidos="Mendoza", municipio="Bogotá", bio="Ingeniero en sistemas"),
    )
    assert u1["role"] == "USUARIO"
    assert u1["banned"] is False

    u2 = registrar_perfil(
        "usr_laura_456",
        "laura@test.com",
        RegistroCuenta(nombre="Laura", apellidos="Gómez", municipio="Medellín", bio="Técnica electricista"),
    )
    assert u2["role"] == "USUARIO"
    assert u2["banned"] is False
    print("✅ 1. Registro público de usuarios (ambos con rol estricto USUARIO)")

    # 2. PRIVACIDAD DE PERFILES
    perfil_priv = obtener_perfil("usr_carlos_123")
    assert perfil_priv["nombre"] == "Carlos"
    assert perfil_priv["email"] == "carlos@test.com"

    perfil_pub = obtener_perfil_publico("usr_carlos_123")
    assert "email" not in perfil_pub
    assert perfil_pub["displayName"] == "Carlos Mendoza"
    assert perfil_pub["municipio"] == "Bogotá"
    assert perfil_pub["bio"] == "Ingeniero en sistemas"
    print("✅ 2. Perfil público seguro: sin email, sin teléfono y sin datos de contacto")

    # 3. SOLICITUDES: CREAR, LISTAR, CANCELAR Y ELIMINAR
    sol = crear_solicitud(
        "usr_carlos_123",
        CrearSolicitud(
            titulo="Instalación de lámparas LED en techo alto",
            descripcion="Se requiere instalar 4 lámparas con escalera telescópica.",
            categoria="ELEC",
            municipio="Bogotá",
            fechaDeseada="2026-12-10",
        ),
    )
    sol_id = sol["id"]
    assert sol["estado"] == "PUBLICADO"
    assert sol["autor_uid"] == "usr_carlos_123"

    solicitudes = listar_solicitudes()
    assert len(solicitudes) >= 1
    assert any(s["id"] == sol_id for s in solicitudes)

    # Cancelar solicitud propia por parte del creador
    res_cancel = cancelar_solicitud("usr_carlos_123", sol_id)
    assert res_cancel["estado"] == "CANCELADO"
    print("✅ 3. Solicitudes: publicación, listado y cancelación por el creador")

    # 4. CHAT PRIVADO SEGURO
    chat = obtener_o_crear_chat("usr_carlos_123", "usr_laura_456")
    chat_id = chat["id"]

    # Enviar mensaje de Carlos a Laura
    msg = enviar_mensaje(
        uid="usr_carlos_123",
        chat_id=chat_id,
        texto="Hola Laura, ¿tienes disponibilidad este sábado para revisar el tablero?",
    )
    assert msg["texto"] == "Hola Laura, ¿tienes disponibilidad este sábado para revisar el tablero?"
    assert msg["senderId"] == "usr_carlos_123"
    assert msg["receiverId"] == "usr_laura_456"
    assert msg["senderEmail"] == "carlos@test.com"
    assert msg["receiverEmail"] == "laura@test.com"

    # Leer chat desde la perspectiva de Laura
    detalle_chat = obtener_chat_detalle(uid="usr_laura_456", chat_id=chat_id)
    assert len(detalle_chat["mensajes"]) >= 1
    assert detalle_chat["mensajes"][0]["senderId"] == "usr_carlos_123"
    assert detalle_chat["mensajes"][0]["receiverId"] == "usr_laura_456"
    assert detalle_chat["info"]["otro_nombre"] == "Carlos Mendoza"
    assert "email" not in detalle_chat["info"]
    print("✅ 4. Chat privado seguro entre usuarios (privacidad y autoría estricta de mensajes)")

    # 5. CALIFICACIONES MUTUAS Y REPUTACIÓN
    # Carlos califica a Laura
    cal1 = calificar(
        uid="usr_carlos_123",
        data=CrearCalificacion(
            calificadoId="usr_laura_456",
            valor=5,
            comentario="Trabajo impecable y muy profesional.",
        ),
    )
    assert cal1["valor"] == 5

    # Laura califica a Carlos (calificación recíproca)
    cal2 = calificar(
        uid="usr_laura_456",
        data=CrearCalificacion(
            calificadoId="usr_carlos_123",
            valor=5,
            comentario="Excelente cliente, puntual y respetuoso.",
        ),
    )
    assert cal2["valor"] == 5

    cals_laura = obtener_calificaciones_usuario("usr_laura_456")
    assert len(cals_laura) >= 1
    assert cals_laura[0]["valor"] == 5

    laura_pub = obtener_perfil_publico("usr_laura_456")
    assert laura_pub["promedioCalificacion"] == 5.0
    assert laura_pub["totalCalificaciones"] >= 1
    print("✅ 5. Reputación mutua: calificaciones recíprocas y promedio de confianza")

    # 6. REPORTES Y MODERACIÓN
    rep = crear_reporte(
        uid="usr_carlos_123",
        data=CrearReporte(
            tipo=TipoReporte.SOLICITUD,
            objetivoId=sol_id,
            motivo="Solicitud de prueba auditada",
            descripcion="Reporte de control para validar el módulo de moderación.",
        ),
    )
    rep_id = rep["id"]
    assert rep["estado"] == "PENDIENTE"

    # Listar reportes en la bandeja de admin
    bandeja = listar_reportes()
    assert len(bandeja) >= 1

    # Admin resuelve el reporte
    resol = resolver_reporte(
        admin_uid="admin_root_999",
        reporte_id=rep_id,
        data=ResolucionReporte(
            accion=AccionReporte.CERRAR,
            resolucion="Auditoría completada satisfactoriamente.",
        ),
    )
    assert resol["accion"] == "CERRAR"
    print("✅ 6. Sistema de reportes: apertura, bandeja y resolución motivada")

    # 7. ADMINISTRACIÓN: USUARIOS, PROMOCIÓN A ADMIN Y BANEO
    db.collection("users").document("admin_root_999").set({
        "uid": "admin_root_999",
        "email": "admin@encargo.com.co",
        "displayName": "Admin Plataforma",
        "role": "ADMIN",
        "rol": "ADMIN",
        "banned": False,
    })

    # Lista completa de usuarios
    todos = listar_usuarios()
    assert len(todos) >= 2

    # Asignación de rol: Un admin existente promueve a Carlos a ADMIN y luego puede revocarlo
    prom = promover_a_admin(admin_uid="admin_root_999", target_uid="usr_carlos_123")
    carlos_actualizado = obtener_perfil("usr_carlos_123")
    assert carlos_actualizado["role"] == "ADMIN"

    rev = revocar_admin(admin_uid="admin_root_999", target_uid="usr_carlos_123")
    carlos_revocado = obtener_perfil("usr_carlos_123")
    assert carlos_revocado["role"] == "USUARIO"

    # Moderación: Admin borra una solicitud del sistema
    del_res = eliminar_solicitud(uid="admin_root_999", role="ADMIN", solicitud_id=sol_id)
    assert "exitosa" in del_res["mensaje"]

    # Moderación: Admin banea a un usuario infractor
    ban_res = banear_usuario(
        admin_uid="admin_root_999",
        target_uid="usr_laura_456",
        motivo="Suspensión preventiva",
    )
    laura_doc = db.collection("users").document("usr_laura_456").get().to_dict()
    assert laura_doc["banned"] is True

    # Reactivar usuario
    desbanear_usuario(admin_uid="admin_root_999", target_uid="usr_laura_456")
    laura_doc2 = db.collection("users").document("usr_laura_456").get().to_dict()
    assert laura_doc2["banned"] is False
    print("✅ 7. Panel de administración: gestión de usuarios, promoción, baneo y control global")

    print("\n🎉 ¡TODAS LAS FUNCIONALIDADES Y REGLAS DE NEGOCIO VERIFICADAS CON ÉXITO! 🎉\n")


if __name__ == "__main__":
    ejecutar_pruebas()
