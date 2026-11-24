"""
Encargo · schemas.py
Modelos Pydantic para validación de datos de entrada.
Soporta interoperabilidad con cliente web React y Firebase Auth.
"""
from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from src.config import (
    BIO_MAX,
    CALIFICACION_MAX,
    CALIFICACION_MIN,
    COMENTARIO_MAX,
    DESCRIPCION_MAX,
    DESCRIPCION_MIN,
    MENSAJE_MAX,
    MENSAJE_MIN,
    MOTIVO_MAX,
    MOTIVO_MIN,
    TITULO_MAX,
    TITULO_MIN,
)


# ──────────────────────────────────────────────
# Enums auxiliares
# ──────────────────────────────────────────────
class TipoReporte(str, Enum):
    """Tipos de objetivo que se pueden reportar."""
    SOLICITUD = "SOLICITUD"
    USUARIO = "USUARIO"


class AccionReporte(str, Enum):
    """Acciones posibles al resolver un reporte."""
    CERRAR = "CERRAR"
    BAN_USUARIO = "BAN_USUARIO"
    ELIMINAR_SOLICITUD = "ELIMINAR_SOLICITUD"


# ──────────────────────────────────────────────
# Solicitudes
# ──────────────────────────────────────────────
class CrearSolicitud(BaseModel):
    """Esquema para publicar una nueva solicitud de servicio."""
    titulo: str = Field(
        ...,
        min_length=TITULO_MIN,
        max_length=TITULO_MAX,
        description="Título breve de la solicitud",
    )
    descripcion: str = Field(
        ...,
        min_length=DESCRIPCION_MIN,
        max_length=DESCRIPCION_MAX,
        description="Descripción detallada del servicio requerido",
    )
    categoria: str = Field(
        ...,
        description="Código o nombre de categoría",
    )
    municipio: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Municipio donde se requiere el servicio",
    )
    fechaDeseada: Optional[date] = Field(
        None,
        description="Fecha deseada para realizar el servicio",
    )
    fecha_deseada: Optional[str] = Field(
        None,
        description="Alias alternativo para fecha deseada",
    )


# ──────────────────────────────────────────────
# Chat
# ──────────────────────────────────────────────
class IniciarChat(BaseModel):
    """Esquema flexible para iniciar o recuperar un chat."""
    otro_uid: Optional[str] = None
    destinatario_uid: Optional[str] = None
    destinatarioId: Optional[str] = None

    def get_destinatario(self) -> str:
        uid = self.otro_uid or self.destinatario_uid or self.destinatarioId
        if not uid:
            raise ValueError("Debe especificarse el UID del otro usuario.")
        return uid


class CrearMensaje(BaseModel):
    """Esquema para enviar un mensaje en un chat privado."""
    texto: Optional[str] = None
    contenido: Optional[str] = None

    def get_texto(self) -> str:
        t = self.texto or self.contenido
        if not t or not t.strip():
            raise ValueError("El mensaje no puede estar vacío.")
        return t.strip()


# ──────────────────────────────────────────────
# Reportes
# ──────────────────────────────────────────────
class CrearReporte(BaseModel):
    """Esquema para crear un reporte contra un usuario o solicitud."""
    tipo: TipoReporte = Field(
        default=TipoReporte.SOLICITUD,
        description="Tipo de elemento reportado",
    )
    objetivoId: str = Field(
        ...,
        min_length=1,
        description="ID del usuario o solicitud reportado",
    )
    motivo: str = Field(
        ...,
        min_length=5,
        max_length=MOTIVO_MAX,
        description="Motivo del reporte",
    )
    descripcion: Optional[str] = Field(
        None,
        max_length=MOTIVO_MAX,
        description="Descripción detallada opcional del reporte",
    )


class ResolucionReporte(BaseModel):
    """Esquema para que un admin resuelva un reporte."""
    resolucion: Optional[str] = Field(
        "Reporte resuelto por administración",
        max_length=MOTIVO_MAX,
        description="Texto de resolución del reporte",
    )
    accion: AccionReporte = Field(
        default=AccionReporte.CERRAR,
        description="Acción a tomar (CERRAR, BAN_USUARIO, ELIMINAR_SOLICITUD)",
    )


# ──────────────────────────────────────────────
# Calificaciones
# ──────────────────────────────────────────────
class CrearCalificacion(BaseModel):
    """Esquema para calificar a un usuario en una solicitud."""
    solicitudId: Optional[str] = Field(
        "directo",
        description="ID de la solicitud asociada a la calificación",
    )
    calificadoId: str = Field(
        ...,
        min_length=1,
        description="UID del usuario que recibe la calificación",
    )
    valor: int = Field(
        ...,
        ge=CALIFICACION_MIN,
        le=CALIFICACION_MAX,
        description="Valor numérico de la calificación (1-5)",
    )
    comentario: Optional[str] = Field(
        None,
        max_length=COMENTARIO_MAX,
        description="Comentario opcional sobre la calificación",
    )


# ──────────────────────────────────────────────
# Perfil y Cuentas de usuario
# ──────────────────────────────────────────────
class RegistroCuenta(BaseModel):
    """Esquema al completar el registro del usuario."""
    nombre: Optional[str] = None
    apellidos: Optional[str] = None
    displayName: Optional[str] = None
    municipio: Optional[str] = None
    bio: Optional[str] = None


class ActualizarPerfil(BaseModel):
    """Esquema para actualizar datos del perfil del usuario."""
    nombre: Optional[str] = None
    displayName: Optional[str] = None
    apellidos: Optional[str] = None
    bio: Optional[str] = None
    municipio: Optional[str] = None


# ──────────────────────────────────────────────
# Administración
# ──────────────────────────────────────────────
class PromoverAdmin(BaseModel):
    """Esquema para promover un usuario a administrador."""
    uid: Optional[str] = None


class BanearUsuario(BaseModel):
    """Esquema para banear a un usuario."""
    motivo: str = Field(
        default="Infracción de normas comunitarias",
        max_length=MOTIVO_MAX,
        description="Motivo del baneo",
    )
