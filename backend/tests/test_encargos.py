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

def run_phase3_tests():
    print("--- INICIANDO TESTS FASE 3: SOLICITUDES, OFERTAS Y PAGOS SIMULADOS ---")

    # Clientes independientes para simular diferentes navegadores
    client_mateo = TestClient(app)
    client_andres = TestClient(app)
    client_felipe = TestClient(app)

    ahora_utc = datetime.now(timezone.utc)
    foto_dummy = io.BytesIO(b"fake photo")
    soporte_dummy = io.BytesIO(b"%PDF-1.4 fake pdf")

    # 1. Registrar Mateo (Solicitante)
    client_mateo.post(
        "/api/cuentas",
        data={
            "tipo": "CLIENTE",
            "cedula": "55511122",
            "nombres": "Mateo",
            "apellidos": "Soler",
            "correo": "mateo@test.com",
            "contrasena": "Password123456!",
            "municipio": "Bogotá",
            "mayor_edad_declarada": "true",
            "consentimiento": "true",
        },
        files={"foto": ("foto.jpg", foto_dummy, "image/jpeg")},
    )

    # 2. Registrar Andrés (Prestador Electricista)
    foto_dummy.seek(0)
    soporte_dummy.seek(0)
    client_andres.post(
        "/api/cuentas",
        data={
            "tipo": "PRESTADOR",
            "cedula": "77788899",
            "nombres": "Andres",
            "apellidos": "Chaves",
            "correo": "andres@test.com",
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

    # 3. Registrar Felipe (Prestador Plomero)
    foto_dummy.seek(0)
    soporte_dummy.seek(0)
    client_felipe.post(
        "/api/cuentas",
        data={
            "tipo": "PRESTADOR",
            "cedula": "99911133",
            "nombres": "Felipe",
            "apellidos": "Rojas",
            "correo": "felipe@test.com",
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

    # 4. Iniciar sesiones
    res_login_sol = client_mateo.post("/api/sesiones", json={"correo": "mateo@test.com", "contrasena": "Password123456!"})
    csrf_mateo = res_login_sol.json()["csrf_token"]
    print("✓ Sesión iniciada para Solicitante Mateo")

    res_login_andres = client_andres.post("/api/sesiones", json={"correo": "andres@test.com", "contrasena": "Password123456!"})
    csrf_andres = res_login_andres.json()["csrf_token"]
    print("✓ Sesión iniciada para Prestador Andrés")

    res_login_felipe = client_felipe.post("/api/sesiones", json={"correo": "felipe@test.com", "contrasena": "Password123456!"})
    csrf_felipe = res_login_felipe.json()["csrf_token"]
    print("✓ Sesión iniciada para Prestador Felipe")

    # 5. Test CU-04: Fecha deseada pasada rechazada con 422
    fecha_pasada = (ahora_utc - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    fecha_futura = (ahora_utc + timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%SZ")

    res_pasada = client_mateo.post(
        "/api/solicitudes",
        json={
            "titulo": "Arreglo urgente de toma corriente",
            "descripcion": "El interruptor de la sala genera chispas al encender y huele a quemado.",
            "categoria": "ELEC",
            "municipio": "Bogotá",
            "direccion_privada": "Carrera 7 # 120-45 Apto 302",
            "fecha_deseada": fecha_pasada,
            "clave_envio": "clave-envio-01",
        },
        headers={"X-CSRF-Token": csrf_mateo},
    )
    assert res_pasada.status_code == 422
    print("✓ Rechazó fecha deseada pasada con 422")

    # 6. Publicar solicitud válida
    res_crear_sol = client_mateo.post(
        "/api/solicitudes",
        json={
            "titulo": "Arreglo urgente de toma corriente",
            "descripcion": "El interruptor de la sala genera chispas al encender y huele a quemado.",
            "categoria": "ELEC",
            "municipio": "Bogotá",
            "direccion_privada": "Carrera 7 # 120-45 Apto 302",
            "fecha_deseada": fecha_futura,
            "clave_envio": "clave-envio-01",
        },
        headers={"X-CSRF-Token": csrf_mateo},
    )
    assert res_crear_sol.status_code == 201, res_crear_sol.text
    solicitud_id = res_crear_sol.json()["id"]
    print(f"✓ Solicitud creada exitosamente en PUBLICADO con ID: {solicitud_id}")

    # 7. Adjuntar imagen a la solicitud (RF-07)
    img_dummy = io.BytesIO(b"fake image bytes")
    res_img = client_mateo.post(
        f"/api/solicitudes/{solicitud_id}/imagenes",
        files={"archivo": ("toma_danada.jpg", img_dummy, "image/jpeg")},
        headers={"X-CSRF-Token": csrf_mateo},
    )
    assert res_img.status_code == 201
    img_id = res_img.json()["id"]
    print(f"✓ Imagen adjuntada a la solicitud con ID: {img_id}")

    # 8. Listado de solicitudes (CU-05 / RF-08) y Ocultamiento de Dirección Privada (RN-12)
    res_lista = client_andres.get("/api/solicitudes")
    assert res_lista.status_code == 200
    items = res_lista.json()["items"]
    assert any(i["id"] == solicitud_id for i in items)
    for it in items:
        assert "direccion_privada" not in it
    print("✓ Listado de solicitudes verificado: la dirección privada NUNCA se expone públicamente.")

    # 9. Test Autooferta (prohibido ofertar a su propia solicitud)
    res_autooferta = client_mateo.post(
        f"/api/solicitudes/{solicitud_id}/ofertas",
        json={
            "neto_cop": 150000,
            "fecha_ofrecida": fecha_futura,
            "descripcion": "Yo mismo me arreglo la toma.",
        },
        headers={"X-CSRF-Token": csrf_mateo},
    )
    assert res_autooferta.status_code in (403, 422)
    print("✓ Rechazó oferta no autorizada / autooferta")

    # 10. Prestador 1 envía oferta legítima (CU-06 / RF-10)
    res_oferta1 = client_andres.post(
        f"/api/solicitudes/{solicitud_id}/ofertas",
        json={
            "neto_cop": 200000,
            "fecha_ofrecida": fecha_futura,
            "descripcion": "Revisión completa del circuito eléctrico, cambio de toma y verificación de cargas.",
        },
        headers={"X-CSRF-Token": csrf_andres},
    )
    assert res_oferta1.status_code == 201, res_oferta1.text
    oferta1_data = res_oferta1.json()
    oferta1_id = oferta1_data["id"]
    assert oferta1_data["neto_cop"] == 200000
    assert oferta1_data["comision_cop"] == 16000  # 200.000 * 0.08 = 16.000
    assert oferta1_data["total_cop"] == 216000     # 200.000 + 16.000 = 216.000
    print(f"✓ Oferta enviada: Neto $200.000, Comisión $16.000 (8%), Total $216.000. ID: {oferta1_id}")

    # 11. Prestador 1 intenta ofertar de nuevo a la misma solicitud -> 409 Duplicado
    res_oferta_dup = client_andres.post(
        f"/api/solicitudes/{solicitud_id}/ofertas",
        json={
            "neto_cop": 180000,
            "fecha_ofrecida": fecha_futura,
            "descripcion": "Segunda propuesta más barata.",
        },
        headers={"X-CSRF-Token": csrf_andres},
    )
    assert res_oferta_dup.status_code == 409
    print("✓ Rechazó oferta duplicada del mismo prestador con 409")

    # 12. Prestador 2 (Felipe) consulta la solicitud (RF-09 / RN-12)
    res_det_p2 = client_felipe.get(f"/api/solicitudes/{solicitud_id}")
    assert res_det_p2.status_code == 200
    det_p2 = res_det_p2.json()
    assert det_p2["direccion_privada"] is None
    assert det_p2["ofertas"] is None  # NO ve las ofertas de la competencia
    print("✓ Prestador ajeno no ve las ofertas de sus competidores ni la dirección privada.")

    # 13. Solicitante Mateo compara ofertas (CU-07 / RF-11)
    res_det_prop = client_mateo.get(f"/api/solicitudes/{solicitud_id}")
    det_prop = res_det_prop.json()
    assert det_prop["ofertas"] is not None
    assert len(det_prop["ofertas"]) == 1
    assert det_prop["ofertas"][0]["total_cop"] == 216000
    print("✓ Solicitante propietario ve las ofertas recibidas con total y desglose definitivo del servidor.")

    # 14. Simulación de pago FALLIDO (RF-13)
    clave_fallida = f"clave-op-fallida-{solicitud_id[:8]}"
    res_pago_fallido = client_mateo.post(
        "/api/intentos-pago",
        json={
            "oferta_id": oferta1_id,
            "modo_demo": "FALLIDO",
            "clave_operacion": clave_fallida,
        },
        headers={"X-CSRF-Token": csrf_mateo},
    )
    assert res_pago_fallido.status_code == 201, res_pago_fallido.text
    fallido_data = res_pago_fallido.json()
    assert fallido_data["resultado"] == "FALLIDO"
    assert fallido_data["contrato_id"] is None

    # Verificar que la solicitud sigue en PUBLICADO
    res_check_pub = client_mateo.get(f"/api/solicitudes/{solicitud_id}")
    assert res_check_pub.json()["estado"] == "PUBLICADO"
    print("✓ Pago simulado FALLIDO procesado: no se contrata ni se reserva, la solicitud sigue en PUBLICADO.")

    # 15. Simulación de pago APROBADO (CU-07 / RF-12, RF-13, RF-14)
    clave_aprobada = f"clave-op-aprobada-{solicitud_id[:8]}"
    res_pago_aprobado = client_mateo.post(
        "/api/intentos-pago",
        json={
            "oferta_id": oferta1_id,
            "modo_demo": "APROBADO",
            "clave_operacion": clave_aprobada,
        },
        headers={"X-CSRF-Token": csrf_mateo},
    )
    assert res_pago_aprobado.status_code == 201, res_pago_aprobado.text
    aprobado_data = res_pago_aprobado.json()
    assert aprobado_data["resultado"] == "APROBADO"
    contrato_id = aprobado_data["contrato_id"]
    assert contrato_id is not None
    print(f"✓ Pago simulado APROBADO: Contrato generado atómicamente con ID: {contrato_id}")

    # 16. Verificar estado de la solicitud y contrato en DB
    res_check_contratado = client_mateo.get(f"/api/solicitudes/{solicitud_id}")
    check_data = res_check_contratado.json()
    assert check_data["estado"] == "CONTRATADO"
    # Ahora que está contratado, Mateo SÍ ve la dirección privada
    assert check_data["direccion_privada"] == "Carrera 7 # 120-45 Apto 302"
    print("✓ Solicitud pasó a CONTRATADO y dirección privada ahora es visible para los participantes.")

    # 17. Idempotencia: reenviar misma clave_operacion debe devolver el mismo resultado sin duplicar
    res_pago_reintento = client_mateo.post(
        "/api/intentos-pago",
        json={
            "oferta_id": oferta1_id,
            "modo_demo": "APROBADO",
            "clave_operacion": clave_aprobada,
        },
        headers={"X-CSRF-Token": csrf_mateo},
    )
    assert res_pago_reintento.status_code == 201
    assert res_pago_reintento.json()["contrato_id"] == contrato_id
    print("✓ Idempotencia validada: repetir con la misma clave devuelve el resultado sin crear duplicados.")

    # 18. Unicidad de contrato (RN-05): no se puede contratar otra oferta si ya está contratada
    res_doble_contrato = client_mateo.post(
        "/api/intentos-pago",
        json={
            "oferta_id": oferta1_id,
            "modo_demo": "APROBADO",
            "clave_operacion": f"clave-op-nueva-{solicitud_id[:8]}",
        },
        headers={"X-CSRF-Token": csrf_mateo},
    )
    assert res_doble_contrato.status_code == 409
    print("✓ Restricción de unicidad de contrato validada: bloquea intento de doble contrato con 409.")

    print("\n🎉 TODOS LOS TESTS DE LA FASE 3 PASARON SATISFACTORIAMENTE.")

if __name__ == "__main__":
    run_phase3_tests()
