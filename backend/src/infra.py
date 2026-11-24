"""
Encargo · infra.py
Capa de Infraestructura y Acceso a Datos (Migrada a Firebase).

Este módulo ha sido actualizado para reflejar la migración de SQLite local
hacia los servicios en la nube de Firebase:
- Cloud Firestore (base de datos NoSQL documental persistente)
- Firebase Authentication (gestión de identidades y roles)
- Firebase Storage (almacenamiento en la nube de imágenes y perfiles)

La configuración activa y los clientes globales se gestionan centralizadamente
en 'src.firebase_config'.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from src.firebase_config import (
    db,
    bucket,
    USA_FIREBASE_REAL,
    SERVER_TIMESTAMP,
    verificar_token,
    obtener_usuario_auth,
)

logger = logging.getLogger("encargo.infra")


class RepositorioFirebase:
    """
    Fachada de acceso a la infraestructura en la nube de Firebase.
    Expone los clientes de Firestore y Storage para operaciones avanzadas.
    """

    def __init__(self):
        self.db = db
        self.bucket = bucket
        self.en_la_nube = USA_FIREBASE_REAL

    @property
    def cloud_status(self) -> dict:
        """Indica el estado de conexión con Firebase Cloud."""
        return {
            "conectado_nube": self.en_la_nube,
            "servicio": "Cloud Firestore + Firebase Storage",
            "autenticacion": "Firebase Auth",
        }

    def coleccion(self, nombre: str):
        """Retorna una referencia a una colección en Firestore."""
        return self.db.collection(nombre)


# Singleton global para compatibilidad de infraestructura
repo = RepositorioFirebase()
