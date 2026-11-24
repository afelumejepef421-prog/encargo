import os
import sys
import time

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(backend_dir))

from backend.src.infra import repo
from backend.src.main import sembrar_datos_iniciales

print("=" * 65)
print("🚀 EJECUTANDO SUITE COMPLETA DE TESTS DE INTEGRACIÓN - ENCARGO")
print("=" * 65)

repo.inicializar()
sembrar_datos_iniciales()

from backend.tests.test_cuentas import run_tests as run_cuentas
from backend.tests.test_encargos import run_phase3_tests as run_encargos
from backend.tests.test_ejecucion_chat import run_phase4_tests as run_ejecucion
from backend.tests.test_reportes_admin import run_phase5_tests as run_reportes
from backend.tests.test_reputacion_portafolio import run_phase6_tests as run_reputacion

suites = [
    ("Fase 2: Cuentas, Sesiones y Perfiles (CU-01 a CU-03)", run_cuentas),
    ("Fase 3: Publicación, Ofertas y Pago Simulado (CU-04 a CU-07)", run_encargos),
    ("Fase 4: Ejecución, Chat y Liquidación (CU-08 a CU-10)", run_ejecucion),
    ("Fase 5: Cancelaciones, Reportes y Administración (CU-11 y CU-12)", run_reportes),
    ("Fase 6: Reputación y Portafolio Autorizado (CU-13 y CU-14)", run_reputacion),
]

inicio_total = time.time()
fallos = 0

for nombre, fn in suites:
    print(f"\n>>> INICIANDO: {nombre}")
    t0 = time.time()
    try:
        fn()
        duracion = time.time() - t0
        print(f"✅ PASÓ: {nombre} ({duracion:.2f}s)")
    except Exception as e:
        duracion = time.time() - t0
        print(f"❌ FALLÓ: {nombre} ({duracion:.2f}s): {e}")
        fallos += 1

tiempo_total = time.time() - inicio_total
print("\n" + "=" * 65)
if fallos == 0:
    print(f"🎉 ÉXITO TOTAL: 5 de 5 suites de prueba pasaron ({tiempo_total:.2f}s).")
    print("Todos los Casos de Uso (CU-01 a CU-14) y Reglas de Negocio están verificados.")
else:
    print(f"⚠️ Hubo {fallos} fallos en las pruebas.")
print("=" * 65)

sys.exit(fallos)
