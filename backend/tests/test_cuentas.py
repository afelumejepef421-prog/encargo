import os
import sys
import io

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(backend_dir))

from fastapi.testclient import TestClient
from backend.src.main import app
from backend.src.infra import repo

repo.inicializar()
client = TestClient(app)

def run_tests():
    print("--- 1. Test Salud ---")
    res = client.get("/api/salud")
    assert res.status_code == 200, res.text
    print("✓ Salud 200 OK")

    print("\n--- 2. Test Registro Cliente (CU-01) ---")
    ts = os.urandom(4).hex()
    correo_cliente = f"carlos_{ts}@test.com"
    cedula_cliente = f"12{int(ts, 16) % 1000000:06d}"
    foto_dummy = io.BytesIO(b"fake jpeg content for test")
    res_reg_cliente = client.post(
        "/api/cuentas",
        data={
            "tipo": "CLIENTE",
            "cedula": cedula_cliente,
            "nombres": "Carlos",
            "apellidos": "Gomez",
            "correo": correo_cliente,
            "contrasena": "Password123456!",
            "municipio": "Medellin",
            "mayor_edad_declarada": "true",
            "consentimiento": "true",
        },
        files={"foto": ("rostro.jpg", foto_dummy, "image/jpeg")},
    )
    assert res_reg_cliente.status_code == 201, res_reg_cliente.text
    cliente_data = res_reg_cliente.json()
    print("✓ Cliente registrado con ID:", cliente_data["id"])

    print("\n--- 3. Test Duplicado (CU-01) ---")
    foto_dummy.seek(0)
    res_dup = client.post(
        "/api/cuentas",
        data={
            "tipo": "CLIENTE",
            "cedula": cedula_cliente,
            "nombres": "Otro",
            "apellidos": "Gomez",
            "correo": f"otro_{ts}@test.com",
            "contrasena": "Password123456!",
            "municipio": "Medellin",
            "mayor_edad_declarada": "true",
            "consentimiento": "true",
        },
        files={"foto": ("rostro.jpg", foto_dummy, "image/jpeg")},
    )
    assert res_dup.status_code == 409, res_dup.text
    print("✓ Rechazó duplicado con 409:", res_dup.json()["mensaje"])

    print("\n--- 4. Test Registro Prestador con Soportes (CU-01, RF-02) ---")
    foto_dummy.seek(0)
    soporte_dummy = io.BytesIO(b"%PDF-1.4 fake pdf support")
    correo_prestador = f"laura_{ts}@test.com"
    cedula_prestador = f"87{int(ts, 16) % 1000000:06d}"
    res_reg_prest = client.post(
        "/api/cuentas",
        data={
            "tipo": "PRESTADOR",
            "cedula": cedula_prestador,
            "nombres": "Laura",
            "apellidos": "Martinez",
            "correo": correo_prestador,
            "contrasena": "Password123456!",
            "municipio": "Bogota",
            "mayor_edad_declarada": "true",
            "consentimiento": "true",
            "categorias": '["ELEC", "PLOM"]',
        },
        files=[
            ("foto", ("rostro.png", foto_dummy, "image/png")),
            ("soportes", ("cert_electricista.pdf", soporte_dummy, "application/pdf")),
        ],
    )
    assert res_reg_prest.status_code == 201, res_reg_prest.text
    prestador_id = res_reg_prest.json()["id"]
    print("✓ Prestador registrado con ID:", prestador_id)

    print("\n--- 5. Test Inicio Sesión (CU-02) ---")
    res_login = client.post(
        "/api/sesiones",
        json={"correo": correo_prestador, "contrasena": "Password123456!"},
    )
    assert res_login.status_code == 200, res_login.text
    login_data = res_login.json()
    csrf_token = login_data["csrf_token"]
    assert "sid" in client.cookies
    print("✓ Sesión iniciada para Laura. CSRF recibido y cookie 'sid' configurada.")

    print("\n--- 6. Test Consulta Perfil Propio (CU-03) ---")
    res_perfil = client.get("/api/perfil")
    assert res_perfil.status_code == 200, res_perfil.text
    perfil = res_perfil.json()
    assert perfil["correo"] == correo_prestador
    assert perfil["tipo"] == "PRESTADOR"
    assert len(perfil["soportes"]) == 1
    assert perfil["soportes"][0]["estado"] == "Aportado, no verificado"
    soporte_id = perfil["soportes"][0]["id"]
    print("✓ Perfil propio verificado con soporte aportado no verificado.")

    print("\n--- 7. Test Protección Inmutabilidad Cédula/Correo/Tipo (RF-05) ---")
    res_patch_ilegal = client.patch(
        "/api/perfil",
        json={"correo": "hack@test.com"},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert res_patch_ilegal.status_code == 422, res_patch_ilegal.text
    print("✓ Rechazó cambio de correo con 422.")

    print("\n--- 8. Test Actualizar Perfil Permitido (RF-05) ---")
    res_patch_legal = client.patch(
        "/api/perfil",
        json={"nombres": "Laura Sofia", "municipio": "Cali"},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert res_patch_legal.status_code == 200, res_patch_legal.text
    print("✓ Perfil actualizado a 'Laura Sofia' en 'Cali'.")

    print("\n--- 9. Test Intento Borrar Último Soporte (RN-02) ---")
    res_del_soporte = client.delete(
        f"/api/perfil/soportes/{soporte_id}",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert res_del_soporte.status_code == 409, res_del_soporte.text
    print("✓ Rechazó borrar último soporte con 409:", res_del_soporte.json()["mensaje"])

    print("\n--- 10. Test Agregar Segundo Soporte y Borrar el Primero ---")
    soporte2 = io.BytesIO(b"fake pdf support 2")
    res_add_soporte = client.post(
        "/api/perfil/soportes",
        data={"categorias": '["ELEC", "PLOM", "COMP"]'},
        files={"archivo": ("cert2.pdf", soporte2, "application/pdf")},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert res_add_soporte.status_code == 201, res_add_soporte.text

    # Ahora sí debe permitir borrar el primero porque quedan 2
    res_del_ok = client.delete(
        f"/api/perfil/soportes/{soporte_id}",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert res_del_ok.status_code == 204, res_del_ok.text
    print("✓ Segundo soporte agregado y primer soporte eliminado exitosamente.")

    print("\n--- 11. Test Perfil Público Prestador (UI-06 / RN-12) ---")
    res_pub = client.get(f"/api/prestadores/{prestador_id}")
    assert res_pub.status_code == 200, res_pub.text
    pub_data = res_pub.json()
    assert "cedula" not in pub_data
    assert "correo" not in pub_data
    assert "soportes" not in pub_data
    assert "COMP" in pub_data["categorias"]
    print("✓ Perfil público confirmado sin datos sensibles (sin cédula, correo ni soportes).")

    print("\n--- 12. Test Cierre de Sesión (CU-02) ---")
    res_logout = client.delete(
        "/api/sesiones/actual",
        headers={"X-CSRF-Token": csrf_token},
    )
    assert res_logout.status_code == 204, res_logout.text

    # Verificar que el acceso posterior falla
    res_post_logout = client.get("/api/perfil")
    assert res_post_logout.status_code == 401, res_post_logout.text
    print("✓ Sesión cerrada correctamente. Peticiones posteriores retornan 401.")

    print("\n🎉 TODOS LOS TESTS DE FASE 1 Y FASE 2 PASARON SATISFACTORIAMENTE.")

if __name__ == "__main__":
    run_tests()
