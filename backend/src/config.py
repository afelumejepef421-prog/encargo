"""
Encargo · config.py
Configuración centralizada de la plataforma.
"""
import os

# ──────────────────────────────────────────────
# Categorías del catálogo de servicios
# ──────────────────────────────────────────────
CATEGORIAS = {
    "COMP": "Mantenimiento de computadores",
    "ELEC": "Electricidad",
    "PLOM": "Plomería",
    "LIMP": "Limpieza",
    "REPA": "Reparaciones del hogar",
}

# ──────────────────────────────────────────────
# Límites de texto
# ──────────────────────────────────────────────
TITULO_MIN = 5
TITULO_MAX = 100
DESCRIPCION_MIN = 20
DESCRIPCION_MAX = 2000
MENSAJE_MIN = 1
MENSAJE_MAX = 2000
MOTIVO_MIN = 10
MOTIVO_MAX = 1000
COMENTARIO_MAX = 500
BIO_MAX = 300

# ──────────────────────────────────────────────
# Calificaciones
# ──────────────────────────────────────────────
CALIFICACION_MIN = 1
CALIFICACION_MAX = 5

# ──────────────────────────────────────────────
# Archivos e imágenes
# ──────────────────────────────────────────────
ARCHIVO_MAX_BYTES = 5 * 1024 * 1024  # 5 MiB
IMAGENES_SOLICITUD_MAX = 5
MIME_IMAGENES = {"image/jpeg", "image/png", "image/webp"}

# ──────────────────────────────────────────────
# Paginación
# ──────────────────────────────────────────────
PAGINA_DEFAULT = 20
PAGINA_MAX = 50

# ──────────────────────────────────────────────
# CORS – origen permitido
# ──────────────────────────────────────────────
APP_ORIGIN = os.environ.get("ENCARGO_ORIGIN", "http://localhost:5173")
