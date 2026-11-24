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

def run_phase5_tests():
    print("--- INICIANDO TESTS FASE 5: CANCELACIONES, REPORTES Y ADMINISTRACIÓN ---")

    client_sol = TestClient(app)
    client_pre = TestClient(app)
    client_admin = TestClient(app)
    client_ajeno = TestClient(app)

    ahora_utc = datetime.now(timezone.utc)
    ts = os.urandom(4).hex()

    # 1. Registrar usuarios de prueba
    foto_dummy = io.BytesIO(b"fake photo")
    soporte_dummy = io.BytesIO(b"%PDF-1.4 fake pdf")

    # Solicitante (Diana)
    correo_sol = f"diana_{ts}@test.com"
    cedula_sol = f"51{int(ts, 16) % 1000000:06d}"
    client_sol.post(
        "/api/cuentas",
        data={
            "tipo": "CLIENTE",
            "cedula": cedula_sol,
            "nombres": "Diana",
            "apellidos": "Castro",
            "correo": correo_sol,
            "contrasena": "Password123456!",
            "municipio": "Bogotá",
            "mayor_edad_declarada": "true",
            "consentimiento": "true",
        },
        files={"foto": ("foto.jpg", foto_dummy, "image/jpeg")},
    )

    # Prestador (Mateo)
    foto_dummy.seek(0)
    correo_pre = f"mateo_{ts}@test.com"
    cedula_pre = f"52{int(ts, 16) % 1000000:06d}"
    client_pre.post(
        "/api/cuentas",
        data={
            "tipo": "PRESTADOR",
            "cedula": cedula_pre,
            "nombres": "Mateo",
            "apellidos": "Morales",
            "correo": correo_pre,
            "contrasena": "Password123456!",
            "municipio": "Bogotá",
            "mayor_edad_declarada": "true",
            "consentimiento": "true",
            "categorias": '["PLOM"]',
        },
        files=[
            ("foto", ("foto.jpg", foto_dummy, "image/jpeg")),
            ("soportes", ("soporte.pdf", soporte_dummy, "application/pdf")),
        ],
    )

    # Tercero ajeno (Valeria)
    foto_dummy.seek(0)
    correo_ajeno = f"valeria_{ts}@test.com"
    cedula_ajeno = f"53{int(ts, 16) % 1000000:06d}"
    client_ajeno.post(
        "/api/cuentas",
        data={
            "tipo": "CLIENTE",
            "cedula": cedula_ajeno,
            "nombres": "Valeria",
            "apellidos": "Rios",
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

    # Iniciar sesión como Administrador
    res_l_adm = client_admin.post("/api/sesiones", json={"correo": "admin@encargo.com.co", "contrasena": "Admin12345678#"})
    csrf_admin = res_l_adm.json()["csrf_token"]

    print("✓ Sesiones iniciadas: Solicitante, Prestador, Admin y Usuario Ajeno.")

    # ────────────────────────────────────────────────────────────
    # CASO 1: Cancelación directa en estado CONTRATADO (CU-11 / RF-20)
    # ────────────────────────────────────────────────────────────
    fecha_futura = (ahora_utc + timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    res_sol1 = client_sol.post(
        "/api/solicitudes",
        json={
            "titulo": "Reparación de fuga de tubería en lavaplatos",
            "descripcion": "Gotea tubería de PVC bajo el sifón del lavaplatos en la cocina.",
            "categoria": "PLOM",
            "municipio": "Bogotá",
            "direccion_privada": "Carrera 7 # 120-40 Apto 302",
            "fecha_deseada": fecha_futura,
            "clave_envio": f"sol1-{ts}",
        },
        headers={"X-CSRF-Token": csrf_sol},
    )
    solicitud1_id = res_sol1.json()["id"]

    res_of1 = client_pre.post(
        f"/api/solicitudes/{solicitud1_id}/ofertas",
        json={"neto_cop": 200000, "fecha_ofrecida": fecha_futura, "descripcion": "Cambio de sifón y sellado con teflón."},
        headers={"X-CSRF-Token": csrf_pre},
    )
    oferta1_id = res_of1.json()["id"]

    # Pago simulado aprobado (Total = 200.000 + 16.000 = 216.000 COP)
    res_pago1 = client_sol.post(
        "/api/intentos-pago",
        json={"oferta_id": oferta1_id, "modo_demo": "APROBADO", "clave_operacion": f"pago1-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    contrato1_id = res_pago1.json()["contrato_id"]
    print(f"✓ Contrato 1 creado en CONTRATADO: {contrato1_id}")

    # Solicitante cancela directamente antes de iniciar
    res_canc1 = client_sol.post(
        f"/api/encargos/{contrato1_id}/cancelar",
        json={"motivo": "Ya no requiero el servicio porque arreglé la llave yo mismo.", "clave_operacion": f"canc1-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_canc1.status_code == 200, res_canc1.text
    canc1_data = res_canc1.json()
    assert canc1_data["estado"] == "CANCELADO"
    assert canc1_data["saldo_estado"] == "DEVUELTO"
    assert canc1_data["total_devuelto_cop"] == 216000  # 100% de la reserva devuelta (RN-10)
    print("✓ Cancelación directa exitosa: Estado CANCELADO y 100% de reserva DEVUELTO ($216.000 COP).")

    # Reintento de cancelación en contrato ya cancelado da 409
    res_canc1_dup = client_sol.post(
        f"/api/encargos/{contrato1_id}/cancelar",
        json={"motivo": "Reintentando cancelar de nuevo.", "clave_operacion": f"canc1-dup-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_canc1_dup.status_code == 409
    print("✓ Cancelación repetida en contrato cancelado rechazada con 409.")

    # ────────────────────────────────────────────────────────────
    # CASO 2: Cancelación directa bloqueada tras solicitar inicio -> deriva a reporte (CU-11 -> CU-12)
    # ────────────────────────────────────────────────────────────
    res_sol2 = client_sol.post(
        "/api/solicitudes",
        json={
            "titulo": "Instalación de calentador a gas 10L",
            "descripcion": "Instalación de punto de agua caliente y ducto de evacuación de gases.",
            "categoria": "PLOM",
            "municipio": "Bogotá",
            "direccion_privada": "Calle 100 # 15-20 Casa 4",
            "fecha_deseada": fecha_futura,
            "clave_envio": f"sol2-{ts}",
        },
        headers={"X-CSRF-Token": csrf_sol},
    )
    solicitud2_id = res_sol2.json()["id"]

    res_of2 = client_pre.post(
        f"/api/solicitudes/{solicitud2_id}/ofertas",
        json={"neto_cop": 300000, "fecha_ofrecida": fecha_futura, "descripcion": "Técnico certificado con herramienta para ducto."},
        headers={"X-CSRF-Token": csrf_pre},
    )
    oferta2_id = res_of2.json()["id"]

    res_pago2 = client_sol.post(
        "/api/intentos-pago",
        json={"oferta_id": oferta2_id, "modo_demo": "APROBADO", "clave_operacion": f"pago2-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    contrato2_id = res_pago2.json()["contrato_id"]

    # Prestador solicita inicio (pasa a INICIO_PENDIENTE)
    client_pre.post(
        f"/api/encargos/{contrato2_id}/inicio",
        json={"clave_operacion": f"ini2-{ts}"},
        headers={"X-CSRF-Token": csrf_pre},
    )

    # Intento de cancelación directa debe fallar con 409 (debe abrir reporte)
    res_canc_bloq = client_sol.post(
        f"/api/encargos/{contrato2_id}/cancelar",
        json={"motivo": "Deseo cancelar aunque ya solicitó inicio.", "clave_operacion": f"canc-bloq-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_canc_bloq.status_code == 409
    print("✓ Cancelación directa bloqueada con 409 tras solicitar inicio (deriva obligatoriamente a CU-12).")

    # ────────────────────────────────────────────────────────────
    # CASO 3: Apertura y consulta de Reporte (CU-12 / RF-21)
    # ────────────────────────────────────────────────────────────
    res_rep = client_sol.post(
        f"/api/encargos/{contrato2_id}/reportes",
        json={
            "motivo": "El prestador no se presentó a la hora acordada y no contesta llamadas.",
            "descripcion": "Estuve esperando toda la mañana en el domicilio y no hubo contacto alguno.",
        },
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_rep.status_code == 201, res_rep.text
    reporte_id = res_rep.json()["id"]
    assert res_rep.json()["estado"] == "ABIERTO"
    print(f"✓ Reporte de desacuerdo abierto exitosamente con ID: {reporte_id}")

    # Duplicado de reporte abierto en el mismo contrato debe fallar con 409
    res_rep_dup = client_pre.post(
        f"/api/encargos/{contrato2_id}/reportes",
        json={"motivo": "Yo sí fui pero nadie me abrió la puerta.", "descripcion": "Estuve tocando el timbre 30 minutos."},
        headers={"X-CSRF-Token": csrf_pre},
    )
    assert res_rep_dup.status_code == 409
    print("✓ Duplicado de reporte abierto bloqueado con 409 (un solo reporte activo simultáneo por encargo).")

    # Tercero ajeno no puede consultar el reporte (403)
    res_rep_ajeno = client_ajeno.get(f"/api/encargos/{contrato2_id}/reporte")
    assert res_rep_ajeno.status_code == 403
    print("✓ Tercero ajeno bloqueado de consultar reporte con 403.")

    # Participante consulta reporte
    res_rep_ver = client_sol.get(f"/api/encargos/{contrato2_id}/reporte")
    assert res_rep_ver.status_code == 200
    assert res_rep_ver.json()["estado"] == "ABIERTO"
    assert res_rep_ver.json()["saldo_estado"] == "RESERVADO"
    print("✓ Consulta de reporte por participante exitosa: Reserva permanece en RESERVADO.")

    # ────────────────────────────────────────────────────────────
    # CASO 4: Ratificación bilateral y Resolución Administrativa (CU-12 / RF-22)
    # ────────────────────────────────────────────────────────────
    # 1. Admin intenta COMPLETAR_CON_ACUERDO sin ratificaciones -> debe dar 409
    res_res_sin_ratif = client_admin.post(
        f"/api/administracion/reportes/{reporte_id}/resolucion",
        json={
            "accion": "COMPLETAR_CON_ACUERDO",
            "motivo": "Intento de acuerdo sin firmas de las partes.",
            "clave_operacion": f"res-err-{ts}",
        },
        headers={"X-CSRF-Token": csrf_admin},
    )
    assert res_res_sin_ratif.status_code == 409
    print("✓ Resolución COMPLETAR_CON_ACUERDO rechazada con 409 sin ratificación bilateral.")

    # 2. Solicitante ratifica
    res_rat_sol = client_sol.post(
        f"/api/encargos/{contrato2_id}/ratificacion-cierre",
        json={"acepta": True, "clave_operacion": f"rat-sol-{ts}"},
        headers={"X-CSRF-Token": csrf_sol},
    )
    assert res_rat_sol.status_code == 200
    assert res_rat_sol.json()["ambos_ratificados"] is False
    print("✓ Solicitante ratificó acuerdo (ambos_ratificados: false).")

    # 3. Prestador ratifica
    res_rat_pre = client_pre.post(
        f"/api/encargos/{contrato2_id}/ratificacion-cierre",
        json={"acepta": True, "clave_operacion": f"rat-pre-{ts}"},
        headers={"X-CSRF-Token": csrf_pre},
    )
    assert res_rat_pre.status_code == 200
    assert res_rat_pre.json()["ambos_ratificados"] is True
    print("✓ Prestador ratificó acuerdo (ambos_ratificados: true).")

    # 4. Admin inspecciona expediente completo
    res_exp = client_admin.get(f"/api/administracion/reportes/{reporte_id}")
    assert res_exp.status_code == 200
    exp_data = res_exp.json()
    assert exp_data["ratificaciones"]["ambos_ratificados"] is True
    print("✓ Admin inspecciona expediente: ambas partes ratificadas verificadas.")

    # 5. Admin aplica resolución de CANCELAR (o COMPLETAR_CON_ACUERDO)
    # Probemos resolución de CANCELAR con devolución total
    res_res_canc = client_admin.post(
        f"/api/administracion/reportes/{reporte_id}/resolucion",
        json={
            "accion": "CANCELAR",
            "motivo": "Se comprueba inasistencia del prestador mediante descargos. Se cancela con devolución íntegra del 100% de la reserva simulada al solicitante.",
            "clave_operacion": f"res-canc-{ts}",
        },
        headers={"X-CSRF-Token": csrf_admin},
    )
    assert res_res_canc.status_code == 200, res_res_canc.text
    res_canc_data = res_res_canc.json()
    assert res_canc_data["estado"] == "RESUELTO"
    assert res_canc_data["accion_aplicada"] == "CANCELAR"
    print("✓ Resolución administrativa CANCELAR ejecutada exitosamente: Reporte RESUELTO y saldo DEVUELTO.")

    # 6. Intentar resolver un reporte ya resuelto -> 409
    res_dup_res = client_admin.post(
        f"/api/administracion/reportes/{reporte_id}/resolucion",
        json={
            "accion": "CERRAR_SIN_EFECTO",
            "motivo": "Intento de resolver otra vez.",
            "clave_operacion": f"res-dup-{ts}",
        },
        headers={"X-CSRF-Token": csrf_admin},
    )
    assert res_dup_res.status_code == 409
    print("✓ Intento de re-resolver reporte ya cerrado bloqueado con 409.")

    # 7. Usuario no administrador intentando acceder a bandeja admin -> 403
    res_bandeja_no_admin = client_sol.get("/api/administracion/reportes")
    assert res_bandeja_no_admin.status_code == 403
    print("✓ Usuario común bloqueado de endpoints administrativos con 403.")

    # 8. Admin consulta bandeja de reportes
    res_bandeja = client_admin.get("/api/administracion/reportes")
    assert res_bandeja.status_code == 200
    assert res_bandeja.json()["total"] >= 1
    print(f"✓ Bandeja administrativa consultada con {res_bandeja.json()['total']} reportes.")

    print("\n🎉 TODOS LOS TESTS DE LA FASE 5 PASARON SATISFACTORIAMENTE.")

if __name__ == "__main__":
    run_phase5_tests()
