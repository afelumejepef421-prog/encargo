@echo off
chcp 65001 > nul
echo ========================================================
echo    Ejecutando Suite de Pruebas y Verificación
echo ========================================================
echo.

set PYTHONDONTWRITEBYTECODE=1

echo [1/3] Verificando compilación del Frontend Vite...
cd frontend
call npm.cmd run build
if %ERRORLEVEL% NEQ 0 (
    echo Error al compilar el Frontend.
    pause
    exit /b 1
)
cd ..

echo.
echo [2/3] Sembrando datos de prueba en Firestore...
cd backend
.venv\Scripts\python.exe -B seeds/seed_firebase.py
if %ERRORLEVEL% NEQ 0 (
    echo Error al sembrar datos.
    pause
    exit /b 1
)

echo.
echo [3/3] Ejecutando pruebas unitarias y de integración...
.venv\Scripts\python.exe -B tests/test_firebase_platform.py
if %ERRORLEVEL% NEQ 0 (
    echo Error en las pruebas.
    pause
    exit /b 1
)
cd ..

echo.
echo ========================================================
echo    ¡TODO VERIFICADO Y LISTO AL 100%!
echo ========================================================
pause
