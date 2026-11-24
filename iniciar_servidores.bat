@echo off
chcp 65001 > nul
echo ========================================================
echo    Iniciando Plataforma Encargo (Backend + Frontend)
echo ========================================================
echo.

set PYTHONDONTWRITEBYTECODE=1

echo [1/2] Iniciando Servidor Backend (FastAPI / Uvicorn en http://localhost:8000)...
start "Encargo Backend API" cmd /k "cd backend && .venv\Scripts\python.exe -m uvicorn src.main:app --reload --port 8000"

echo [2/2] Iniciando Servidor Frontend (React / Vite en http://localhost:5173)...
start "Encargo Frontend Web" cmd /k "cd frontend && npm.cmd run dev"

echo.
echo ========================================================
echo    ¡Servidores iniciados en ventanas independientes!
echo    - Backend API: http://localhost:8000
echo    - Documentación OpenAPI: http://localhost:8000/docs
echo    - Frontend Web: http://localhost:5173
echo ========================================================
pause
