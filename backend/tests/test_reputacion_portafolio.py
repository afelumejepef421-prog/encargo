import os
import sys
import io
import json
from datetime import datetime, timedelta, timezone

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(backend_dir))

from fastapi.testclient import TestClient
from backend.src.main import app, sembrar_datos_iniciales
from backend.src.infra import repo

repo.inicializar()
sembrar_datos_iniciales()

def run_phase6_tests():
    print("--- INICIANDO TESTS FASE 6: REPUTACIÓN Y PORTAFOLIO AUTORIZADO ---")

    client_sol = TestClient(app)
    client_pre = TestClient(app)
    client_ajeno = TestClient(app)

    ahora_utc = datetime.now(timezone.utc)
    ts = os.urandom(4).hex()

    # 1. Registrar usuarios
    foto_dummy = io.BytesIO(b"fake photo")
    soporte_dummy = io.BytesIO(b"%PDF-1.4 fake pdf")

    # Solicitante (Lorena)
    correo_sol = f"lorena_{ts}@test.com"
    cedula_sol = f"41{int(ts, 16) % 1000000:06d}"
    client_sol.post(
        "/api/cuentas",
        data={
            "tipo": "CLIENTE",
            "cedula": cedula_sol,
            "nombres": "Lorena",
            "apellidos": "Vargas",
            "correo": correo_sol,
            "contrasena": "Password123456!",
            "municipio": "Bogotá",
            "mayor_edad_declarada": "true",
            "consentimiento": "true",
        },
        files={"foto": ("foto.jpg", foto_dummy, "image/jpeg")},
    )

    # Prestador (Fabian)
    foto_dummy.seek(0)
    correo_pre = f"fabian_{ts}@test.com"
    cedula_pre = f"42{int(ts, 16) % 1000000:06d}"
    res_pre = client_pre.post(
        "/api/cuentas",
        data={
            "tipo": "PRESTADOR",
            "cedula": cedula_pre,
            "nombres": "Fabian",
            "apellidos": "Ruiz",
            "correo": correo_pre,
            "contrasena": "Password123456!",
            "municipio": "Bogotá",
            "mayor_edad_declarada": "true",
            "consentimiento": "true",
            "categorias": '["REPA"]',
        },
        files=[
            ("foto", ("foto.jpg", foto_dummy, "image/jpeg")),
            ("soportes", ("soporte.pdf", soporte_dummy, "application/pdf")),
        ],
    )
    prestador_id = res_pre.json()["id"]

    # Tercero ajeno (Monica)
    foto_dummy.seek(0)
    correo_ajeno = f"monica_{ts}@test.com"
    cedula_ajeno = f"43{int(ts, 16) % 1000000:06d}"
    client_ajeno.post(
        "/api/cuentas",
        data={
            "tipo": "CLIENTE",
            "cedula": cedula_ajeno,
            "nombres": "Monica",
            "apellidos": "Duarte",
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

    print("✓ Sesiones iniciadas: Solicitante, Prestador y Tercero Ajeno.")

    # 3. Flujo completo hasta COMPLETADO
    fecha_futura = (ahora_utc + timedelta(days=6)).strftime("%Y-%m-%dT%H:%M:%SZ")
    res_sol = client_sol.post(
        "/api/solicitudes",
        json={
            "titulo": "Enchape y pintura de muro de sala",
            "descripcion": "Estuco plástico y dos manos de pintura vinilo tipo 1 lavable.",
            "categoria": "REPA",
            "municipio": "Bogotá",
            "direccion_privada": "Calle 72 # 10-34 Casa 2",
            "fecha_deseada": fecha_futura,
            "clave_envio": f"rep-sol-{ts}",
        },
        headers={"X-CSRF-Token": csrf_sol},
    )
    solicitud_id = res_sol.json()["id"]

    res_of = client_pre.post(
        f"/api/solicitudes/{solicitud_id}/ofertas",
        json={"neto_cop": 400000, "fecha_ofrecida": fecha_futura, "descripcion": "Incluye rodillos antigota y lijado con aspiradora."},
        headers={"X-CSRF-Token": csrf_pre},
    )
    oferta_id = res_of.json()["id"]

    res_pago = client_sol.post(
        "/api/intentos-pago",
        json={"oferta_id": oferta_id, "modo_demo": "APROBADO", "clave_operacion": f"pago-f6-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    contrato_id = res_pago.json()["contrato_id"]

    # 4. Intentar calificar antes de completar -> debe fallar con 409
    res_calif_temprana = client_sol.post(
        f"/api/encargos/{contrato_id}/calificaciones",
        json={"valor": 5, "comentario": "Excelente trabajo previo."},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_calif_temprana.status_code == 409
    print("✓ Calificación antes de COMPLETADO bloqueada con 409.")

    # 5. Prestador sube foto de evidencia del trabajo (RF-18, RF-24)
    evidencia_dummy = io.BytesIO(b"fake photo of painted room wall")
    res_evid = client_pre.post(
        f"/api/encargos/{contrato_id}/evidencias",
        files={"archivo": ("muro_pintado.jpg", evidencia_dummy, "image/jpeg")},
        headers={"X-CSRF-Token": csrf_pre},
    )
    archivo_id = res_evid.json()["id"]
    print(f"✓ Evidencia de trabajo adjunta: {archivo_id}")

    # Verificar que inicialmente NO aparece en el portafolio público del prestador
    res_perfil_inicial = client_ajeno.get(f"/api/prestadores/{prestador_id}/perfil-publico")
    assert res_perfil_inicial.status_code == 200
    assert len(res_perfil_inicial.json()["portafolio"]) == 0
    print("✓ Evidencia privada no autorizada no se muestra en el portafolio público.")

    # 6. Prestador solicita inicio, cliente aprueba
    client_pre.post(f"/api/encargos/{contrato_id}/inicio", json={"clave_operacion": f"ini-{ts}"}, headers={"X-CSRF-Token": csrf_pre})
    client_sol.post(f"/api/encargos/{contrato_id}/inicio/respuesta", json={"decision": "APROBAR", "clave_operacion": f"conf-ini-{ts}"}, headers={"X-CSRF-Token": csrf_sol})

    # Prestador solicita fin, cliente aprueba -> Estado COMPLETADO y fondos LIBERADOS
    client_pre.post(f"/api/encargos/{contrato_id}/fin", json={"clave_operacion": f"fin-{ts}"}, headers={"X-CSRF-Token": csrf_pre})
    client_sol.post(f"/api/encargos/{contrato_id}/fin/respuesta", json={"decision": "APROBAR", "clave_operacion": f"conf-fin-{ts}"}, headers={"X-CSRF-Token": csrf_sol})
    print("✓ Encargo transitado a COMPLETADO y saldo a LIBERADO.")

    # 7. Test Calificaciones Recíprocas (CU-13 / RF-23)
    # Solicitante califica a Prestador con 5 estrellas
    res_cal_sol = client_sol.post(
        f"/api/encargos/{contrato_id}/calificaciones",
        json={"valor": 5, "comentario": "Puntual, pulcro y excelente acabado en la pintura de la sala."},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_cal_sol.status_code == 201, res_cal_sol.text
    print("✓ Solicitante calificó a Prestador con 5 estrellas.")

    # Reintento de calificar por el mismo usuario -> debe dar 409 (inmutable)
    res_cal_dup = client_sol.post(
        f"/api/encargos/{contrato_id}/calificaciones",
        json={"valor": 4, "comentario": "Cambiando mi voto."},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_cal_dup.status_code == 409
    print("✓ Re-calificación bloqueada con 409 (voto inmutable).")

    # Prestador califica a Solicitante con 5 estrellas
    res_cal_pre = client_pre.post(
        f"/api/encargos/{contrato_id}/calificaciones",
        json={"valor": 5, "comentario": "Excelente cliente, muy amable y puntual con las confirmaciones."},
        headers={"X-CSRF-Token": csrf_pre},
    )
    assert res_cal_pre.status_code == 201, res_cal_pre.text
    print("✓ Prestador calificó a Solicitante con 5 estrellas.")

    # Tercero ajeno intentando calificar -> 403
    res_cal_ajeno = client_ajeno.post(
        f"/api/encargos/{contrato_id}/calificaciones",
        json={"valor": 3, "comentario": "Calificación ajena."},
        headers={"X-CSRF-Token": csrf_ajeno},
    )
    assert res_cal_ajeno.status_code == 403
    print("✓ Calificación ajena bloqueada con 403.")

    # 8. Test Autorización de Evidencias de Portafolio (CU-14 / RF-24)
    # Prestador o ajeno no puede autorizar la foto de la casa del cliente -> 403
    res_aut_pre = client_pre.put(
        f"/api/archivos/{archivo_id}/autorizacion",
        json={"autoriza": True},
        headers={"X-CSRF-Token": csrf_pre},
    )
    assert res_aut_pre.status_code == 403
    print("✓ Prestador bloqueado de auto-autorizar fotos de la propiedad del cliente (403).")

    # Cliente autoriza publicación en portafolio
    res_aut_sol = client_sol.put(
        f"/api/archivos/{archivo_id}/autorizacion",
        json={"autoriza": True},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_aut_sol.status_code == 200, res_aut_sol.text
    print("✓ Cliente autorizó fotografía para portafolio público.")

    # Verificar que AHORA SÍ aparece en el portafolio público del prestador
    res_perfil_aut = client_ajeno.get(f"/api/prestadores/{prestador_id}/perfil-publico")
    assert res_perfil_aut.status_code == 200
    perfil_data = res_perfil_aut.json()
    assert len(perfil_data["portafolio"]) == 1
    assert perfil_data["portafolio"][0]["id"] == archivo_id
    assert perfil_data["promedio"] == 5.0
    assert perfil_data["total_calificaciones"] == 1
    print(f"✓ Perfil público del prestador actualizado: Promedio {perfil_data['promedio']}★, {perfil_data['total_calificaciones']} opiniones, 1 foto en portafolio.")

    # Cliente revoca la autorización
    res_rev_sol = client_sol.put(
        f"/api/archivos/{archivo_id}/autorizacion",
        json={"autoriza": False},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_rev_sol.status_code == 200
    print("✓ Cliente revocó autorización de fotografía.")

    # Verificar que desapareció del portafolio público
    res_perfil_rev = client_ajeno.get(f"/api/prestadores/{prestador_id}/perfil-publico")
    assert len(res_perfil_rev.json()["portafolio"]) == 0
    print("✓ Fotografía revocada desapareció de inmediato del portafolio público.")

    # 9. Test Historial de Servicios (RF-25 / UI-12)
    # Historial solicitante
    res_hist_sol = client_sol.get("/api/historial?rol=SOLICITADOS")
    assert res_hist_sol.status_code == 200
    hist_sol_data = res_hist_sol.json()
    assert hist_sol_data["total"] >= 1
    assert hist_sol_data["items"][0]["estado"] == "COMPLETADO"
    assert hist_sol_data["items"][0]["calificacion_dada"] == 5
    print("✓ Historial de solicitante consultado correctamente con calificaciones y estado COMPLETADO.")

    # Historial prestador
    res_hist_pre = client_pre.get("/api/historial?rol=PRESTADOS")
    assert res_hist_pre.status_code == 200
    hist_pre_data = res_hist_pre.json()
    assert hist_pre_data["total"] >= 1
    assert hist_pre_data["items"][0]["estado"] == "COMPLETADO"
    assert hist_pre_data["items"][0]["calificacion_dada"] == 5
    print("✓ Historial de prestador consultado correctamente con trabajos realizados.")

    print("\n🎉 TODOS LOS TESTS DE LA FASE 6 PASARON SATISFACTORIAMENTE.")

if __name__ == "__main__":
    run_phase6_tests()
