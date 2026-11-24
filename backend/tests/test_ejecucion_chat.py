import os
import sys
import io
from datetime import datetime, timedelta, timezone

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(backend_dir))

from fastapi.testclient import TestClient
from backend.src.main import app
from backend.src.infra import repo

repo.inicializar()

def run_phase4_tests():
    print("--- INICIANDO TESTS FASE 4: EJECUCIÓN, CHAT Y LIQUIDACIÓN ---")

    client_sol = TestClient(app)
    client_pre = TestClient(app)
    client_ajeno = TestClient(app)

    ahora_utc = datetime.now(timezone.utc)
    ts = os.urandom(4).hex()

    # 1. Registrar usuarios de prueba
    foto_dummy = io.BytesIO(b"fake photo")
    soporte_dummy = io.BytesIO(b"%PDF-1.4 fake pdf")

    # Solicitante (Santiago)
    correo_sol = f"santiago_{ts}@test.com"
    cedula_sol = f"66{int(ts, 16) % 1000000:06d}"
    client_sol.post(
        "/api/cuentas",
        data={
            "tipo": "CLIENTE",
            "cedula": cedula_sol,
            "nombres": "Santiago",
            "apellidos": "Perez",
            "correo": correo_sol,
            "contrasena": "Password123456!",
            "municipio": "Bogotá",
            "mayor_edad_declarada": "true",
            "consentimiento": "true",
        },
        files={"foto": ("foto.jpg", foto_dummy, "image/jpeg")},
    )

    # Prestador (Javier)
    foto_dummy.seek(0)
    correo_pre = f"javier_{ts}@test.com"
    cedula_pre = f"77{int(ts, 16) % 1000000:06d}"
    client_pre.post(
        "/api/cuentas",
        data={
            "tipo": "PRESTADOR",
            "cedula": cedula_pre,
            "nombres": "Javier",
            "apellidos": "Mendoza",
            "correo": correo_pre,
            "contrasena": "Password123456!",
            "municipio": "Bogotá",
            "mayor_edad_declarada": "true",
            "consentimiento": "true",
            "categorias": '["ELEC"]',
        },
        files=[
            ("foto", ("foto.jpg", foto_dummy, "image/jpeg")),
            ("soportes", ("soporte.pdf", soporte_dummy, "application/pdf")),
        ],
    )

    # Tercero Ajeno (Camilo)
    foto_dummy.seek(0)
    correo_ajeno = f"camilo_{ts}@test.com"
    cedula_ajeno = f"88{int(ts, 16) % 1000000:06d}"
    client_ajeno.post(
        "/api/cuentas",
        data={
            "tipo": "CLIENTE",
            "cedula": cedula_ajeno,
            "nombres": "Camilo",
            "apellidos": "Torres",
            "correo": correo_ajeno,
            "contrasena": "Password123456!",
            "municipio": "Bogotá",
            "mayor_edad_declarada": "true",
            "consentimiento": "true",
        },
        files={"foto": ("foto.jpg", foto_dummy, "image/jpeg")},
    )

    # 2. Iniciar sesiones
    res_l_sol = client_sol.post("/api/sesiones", json={"correo": correo_sol, "contrasena": "Password123456!"})
    csrf_sol = res_l_sol.json()["csrf_token"]

    res_l_pre = client_pre.post("/api/sesiones", json={"correo": correo_pre, "contrasena": "Password123456!"})
    csrf_pre = res_l_pre.json()["csrf_token"]

    res_l_ajeno = client_ajeno.post("/api/sesiones", json={"correo": correo_ajeno, "contrasena": "Password123456!"})
    csrf_ajeno = res_l_ajeno.json()["csrf_token"]

    print("✓ Sesiones iniciadas para Solicitante, Prestador y Tercero Ajeno")

    # 3. Publicar solicitud y contratar con pago simulado
    fecha_futura = (ahora_utc + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    res_sol = client_sol.post(
        "/api/solicitudes",
        json={
            "titulo": "Instalación de tablero de tacos 220V",
            "descripcion": "Se requiere instalar tablero trifásico para horno y estufa eléctrica en cocina.",
            "categoria": "ELEC",
            "municipio": "Bogotá",
            "direccion_privada": "Calle 85 # 11-53 Apto 501",
            "fecha_deseada": fecha_futura,
            "clave_envio": f"envio-{ts}",
        },
        headers={"X-CSRF-Token": csrf_sol},
    )
    solicitud_id = res_sol.json()["id"]

    # Javier envía oferta por 350.000 COP
    res_of = client_pre.post(
        f"/api/solicitudes/{solicitud_id}/ofertas",
        json={
            "neto_cop": 350000,
            "fecha_ofrecida": fecha_futura,
            "descripcion": "Incluye cableado certificado calibre 8 AWG y breakers Schneider.",
        },
        headers={"X-CSRF-Token": csrf_pre},
    )
    oferta_id = res_of.json()["id"]

    # Santiago aprueba pago simulado
    res_pago = client_sol.post(
        "/api/intentos-pago",
        json={
            "oferta_id": oferta_id,
            "modo_demo": "APROBADO",
            "clave_operacion": f"pago-aprobado-{ts}",
        },
        headers={"X-CSRF-Token": csrf_sol},
    )
    contrato_id = res_pago.json()["contrato_id"]
    print(f"✓ Encargo contratado con ID: {contrato_id}. Reserva = RESERVADO.")

    # 4. Test Chat Privado (CU-09 / RF-15)
    # Santiago envía mensaje
    res_msg1 = client_sol.post(
        f"/api/encargos/{contrato_id}/mensajes",
        json={"texto": "Hola Javier, ¿puedes traer tacos de 30 amperios?", "clave_envio": f"msg1-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_msg1.status_code == 201, res_msg1.text

    # Javier responde
    res_msg2 = client_pre.post(
        f"/api/encargos/{contrato_id}/mensajes",
        json={"texto": "Confirmado Santiago, llevaré tacos de 30A certificados.", "clave_envio": f"msg2-{ts}"},
        headers={"X-CSRF-Token": csrf_pre},
    )
    assert res_msg2.status_code == 201, res_msg2.text

    # Lectura del chat
    res_chat = client_sol.get(f"/api/encargos/{contrato_id}/mensajes")
    assert res_chat.status_code == 200
    mensajes = res_chat.json()["mensajes"]
    assert len(mensajes) == 2
    assert "tacos de 30 amperios" in mensajes[0]["texto"]
    print("✓ Mensajes de chat intercambiados y orden cronológico verificado.")

    # Tercero ajeno intenta acceder al chat (debe dar 403)
    res_chat_ajeno = client_ajeno.get(f"/api/encargos/{contrato_id}/mensajes")
    assert res_chat_ajeno.status_code == 403
    print("✓ Tercero ajeno bloqueado del chat privado con 403.")

    # 5. Test Solicitud de Inicio (CU-10 / RF-16)
    # Javier (prestador) solicita inicio
    res_ini_sol = client_pre.post(
        f"/api/encargos/{contrato_id}/inicio",
        json={"clave_operacion": f"inicio-op-{ts}"},
        headers={"X-CSRF-Token": csrf_pre},
    )
    assert res_ini_sol.status_code == 200, res_ini_sol.text
    ini_data = res_ini_sol.json()
    assert ini_data["estado"] == "INICIO_PENDIENTE"
    assert ini_data["inicio_limite"] is not None
    print(f"✓ Solicitud de inicio registrada. Estado: INICIO_PENDIENTE. Límite: {ini_data['inicio_limite']}")

    # Solicitante intenta pedir inicio -> 403
    res_ini_error = client_sol.post(
        f"/api/encargos/{contrato_id}/inicio",
        json={"clave_operacion": f"inicio-err-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_ini_error.status_code == 403
    print("✓ Solicitante no puede auto-pedir inicio (restringido a prestador).")

    # 6. Test Confirmación de Inicio (CU-10 / RF-17)
    # Santiago (solicitante) confirma inicio
    res_ini_conf = client_sol.post(
        f"/api/encargos/{contrato_id}/inicio/respuesta",
        json={"decision": "APROBAR", "clave_operacion": f"conf-ini-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_ini_conf.status_code == 200, res_ini_conf.text
    assert res_ini_conf.json()["estado"] == "EN_CURSO"
    print("✓ Inicio confirmado. Estado pasó a EN_CURSO.")

    # 7. Subir Evidencia de Trabajo (RF-18 / RF-24)
    evidencia_dummy = io.BytesIO(b"fake photo of installed electric panel")
    res_evidencia = client_pre.post(
        f"/api/encargos/{contrato_id}/evidencias",
        files={"archivo": ("panel_instalado.jpg", evidencia_dummy, "image/jpeg")},
        headers={"X-CSRF-Token": csrf_pre},
    )
    assert res_evidencia.status_code == 201, res_evidencia.text
    evidencia_id = res_evidencia.json()["id"]
    print(f"✓ Evidencia de trabajo adjuntada con ID: {evidencia_id}")

    # 8. Test Solicitud de Finalización (CU-10 / RF-18)
    res_fin_sol = client_pre.post(
        f"/api/encargos/{contrato_id}/fin",
        json={"clave_operacion": f"fin-op-{ts}"},
        headers={"X-CSRF-Token": csrf_pre},
    )
    assert res_fin_sol.status_code == 200, res_fin_sol.text
    fin_data = res_fin_sol.json()
    assert fin_data["estado"] == "FIN_PENDIENTE"
    assert fin_data["fin_limite"] is not None
    print(f"✓ Solicitud de finalización registrada. Estado: FIN_PENDIENTE. Límite: {fin_data['fin_limite']}")

    # 9. Test Confirmación de Fin y Liquidación Atómica (CU-08, CU-10 / RF-14, RF-19)
    res_fin_conf = client_sol.post(
        f"/api/encargos/{contrato_id}/fin/respuesta",
        json={"decision": "APROBAR", "clave_operacion": f"conf-fin-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_fin_conf.status_code == 200, res_fin_conf.text
    fin_conf_data = res_fin_conf.json()
    assert fin_conf_data["estado"] == "COMPLETADO"
    assert fin_conf_data["saldo_estado"] == "LIBERADO"
    assert fin_conf_data["neto_cop"] == 350000
    assert fin_conf_data["comision_cop"] == 28000  # 350.000 * 0.08 = 28.000
    print("✓ Servicio COMPLETADO: Reserva simulada pasó a LIBERADO en destino único final.")
    print("  Neto desembolsado al prestador: $350.000 COP, Comisión Encargo: $28.000 COP.")

    # 10. Reintento de liquidación bloqueado (destino final inmutable, RN-05)
    res_reintento = client_sol.post(
        f"/api/encargos/{contrato_id}/fin/respuesta",
        json={"decision": "APROBAR", "clave_operacion": f"conf-fin-dup-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_reintento.status_code == 409
    print("✓ Intento de re-liquidar bloqueado con 409 (reserva ya liberada).")

    print("\n🎉 TODOS LOS TESTS DE LA FASE 4 PASARON SATISFACTORIAMENTE.")

if __name__ == "__main__":
    run_phase4_tests()
