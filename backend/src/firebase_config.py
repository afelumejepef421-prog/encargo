"""
Encargo · firebase_config.py
Inicialización de Firebase Admin SDK para Firestore, Auth y Storage.
Incluye adaptador resiliente: si 'serviceAccountKey.json' está presente,
conecta al proyecto Firebase en la nube; si no está presente, opera en modo
DEMO/LOCAL en memoria para desarrollo sin interrupciones.
"""
import os
import sys
import logging
from typing import Any, Optional

logger = logging.getLogger("encargo.firebase")

_cred_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "serviceAccountKey.json",
)

USA_FIREBASE_REAL = False

try:
    if os.path.exists(_cred_path):
        import firebase_admin
        from firebase_admin import credentials, firestore, auth, storage

        if not firebase_admin._apps:
            _cred = credentials.Certificate(_cred_path)
            _app = firebase_admin.initialize_app(
                _cred,
                {
                    "storageBucket": os.environ.get(
                        "FIREBASE_STORAGE_BUCKET", "encargo-platform.firebasestorage.app"
                    )
                },
            )
        db = firestore.client()
        bucket = storage.bucket()
        USA_FIREBASE_REAL = True
        logger.info("🔥 Firebase Admin SDK inicializado exitosamente con credenciales en la nube.")
    else:
        raise FileNotFoundError("Archivo serviceAccountKey.json no encontrado.")
except Exception as e:
    logger.warning(
        f"⚠️ Firebase no inicializado en la nube ({e}). "
        f"Iniciando en modo Mock/Local para pruebas continuas. "
        f"Coloca tu 'serviceAccountKey.json' en backend/ para activar Cloud Firestore."
    )

    # ─────────────────────────────────────────────────────────────
    # Mock / Emulador en memoria para desarrollo local
    # ─────────────────────────────────────────────────────────────
    class MockDocSnap:
        def __init__(self, doc_id: str, data: Optional[dict]):
            self.id = doc_id
            self._data = data

        @property
        def exists(self) -> bool:
            return self._data is not None

        def to_dict(self) -> dict:
            return dict(self._data) if self._data else {}

    class MockDocRef:
        _subcollections_store: dict[str, "MockCollectionRef"] = {}

        def __init__(self, parent_collection: "MockCollectionRef", doc_id: str):
            self._parent_collection = parent_collection
            self.id = doc_id

        def get(self) -> MockDocSnap:
            data = self._parent_collection._store.get(self.id)
            return MockDocSnap(self.id, data)

        def set(self, data: dict, merge: bool = False):
            if merge and self.id in self._parent_collection._store:
                self._parent_collection._store[self.id].update(data)
            else:
                self._parent_collection._store[self.id] = dict(data)

        def update(self, data: dict):
            if self.id not in self._parent_collection._store:
                self._parent_collection._store[self.id] = {}
            self._parent_collection._store[self.id].update(data)

        def delete(self):
            self._parent_collection._store.pop(self.id, None)

        def collection(self, name: str) -> "MockCollectionRef":
            sub_key = f"{self._parent_collection.name}/{self.id}/{name}"
            if sub_key not in MockDocRef._subcollections_store:
                MockDocRef._subcollections_store[sub_key] = MockCollectionRef(sub_key)
            return MockDocRef._subcollections_store[sub_key]

    class MockCollectionRef:
        def __init__(self, name: str):
            self.name = name
            self._store: dict[str, dict] = {}
            self._wheres = []
            self._limit: Optional[int] = None
            self._offset: int = 0
            self._order_by: Optional[str] = None
            self._direction: str = "ASCENDING"

        def document(self, doc_id: str) -> MockDocRef:
            return MockDocRef(self, doc_id)

        def where(self, field: str, op: str, value: Any) -> "MockCollectionRef":
            nuevo = MockCollectionRef(self.name)
            nuevo._store = self._store
            nuevo._wheres = self._wheres + [(field, op, value)]
            nuevo._limit = self._limit
            nuevo._offset = self._offset
            return nuevo

        def order_by(self, field: str, direction: str = "ASCENDING") -> "MockCollectionRef":
            self._order_by = field
            self._direction = direction
            return self

        def offset(self, n: int) -> "MockCollectionRef":
            self._offset = n
            return self

        def limit(self, n: int) -> "MockCollectionRef":
            self._limit = n
            return self

        def stream(self):
            items = []
            for doc_id, data in self._store.items():
                cumple = True
                for field, op, val in self._wheres:
                    item_val = data.get(field)
                    if op == "==" and item_val != val:
                        cumple = False
                    elif op == "!=" and item_val == val:
                        cumple = False
                    elif op == "array_contains" and (not isinstance(item_val, list) or val not in item_val):
                        cumple = False
                if cumple:
                    items.append(MockDocSnap(doc_id, data))

            if self._offset:
                items = items[self._offset:]
            if self._limit is not None:
                items = items[:self._limit]
            return items

    class MockFirestore:
        def __init__(self):
            self._cols: dict[str, MockCollectionRef] = {}

        def collection(self, name: str) -> MockCollectionRef:
            if name not in self._cols:
                self._cols[name] = MockCollectionRef(name)
            return self._cols[name]

    class MockBlob:
        def __init__(self, name: str):
            self.name = name
            self.public_url = f"/api/mock-storage/{name}"

        def upload_from_string(self, content, content_type: str = "image/jpeg"):
            pass

        def make_public(self):
            pass

    class MockStorageBucket:
        def blob(self, name: str) -> MockBlob:
            return MockBlob(name)

    db = MockFirestore()
    bucket = MockStorageBucket()


# ─────────────────────────────────────────────────────────────
# SERVER_TIMESTAMP universal
# ─────────────────────────────────────────────────────────────
try:
    from google.cloud.firestore import SERVER_TIMESTAMP
except Exception:
    import datetime

    class _MockTimestamp:
        def __str__(self):
            return datetime.datetime.now(datetime.timezone.utc).isoformat()
        def __repr__(self):
            return datetime.datetime.now(datetime.timezone.utc).isoformat()
        def isoformat(self):
            return datetime.datetime.now(datetime.timezone.utc).isoformat()

    SERVER_TIMESTAMP = _MockTimestamp()

def verificar_token(id_token: str) -> dict:
    """
    Verifica un ID token de Firebase Auth y retorna los claims del usuario.
    Si está en modo local y el token es dev/demo, retorna un usuario simulado
    con UID y correo determinista y estrictamente aislado por cuenta.
    """
    if USA_FIREBASE_REAL:
        from firebase_admin import auth
        try:
            decoded = auth.verify_id_token(id_token)
            return decoded
        except Exception as e:
            raise ValueError(f"Token inválido: {str(e)}")
    else:
        # Modo fallback para desarrollo local y pruebas (aislamiento real de UIDs)
        if id_token == "demo-admin-token" or id_token.startswith("demo-admin"):
            return {
                "uid": "admin-master-uid",
                "email": "admin@encargo.com",
                "name": "Carlos Administrador",
                "picture": "",
            }

        # Formato token explícito: demo-token:<uid>:<email>
        if id_token.startswith("demo-token:"):
            partes = id_token.split(":")
            uid = partes[1] if len(partes) > 1 else "usr-anon"
            email = partes[2] if len(partes) > 2 else "usuario@encargo.com"
            u_snap = db.collection("users").document(uid).get()
            nombre = email.split("@")[0]
            if u_snap.exists:
                d = u_snap.to_dict()
                nombre = d.get("displayName") or d.get("nombre") or nombre
            return {
                "uid": uid,
                "email": email,
                "name": nombre,
                "picture": "",
            }

        if id_token.startswith("demo-token-"):
            uid = id_token.replace("demo-token-", "")
            u_snap = db.collection("users").document(uid).get()
            email = f"{uid}@encargo.com"
            nombre = uid
            if u_snap.exists:
                d = u_snap.to_dict()
                email = d.get("email") or email
                nombre = d.get("displayName") or d.get("nombre") or nombre
            return {
                "uid": uid,
                "email": email,
                "name": nombre,
                "picture": "",
            }

        return {
            "uid": id_token,
            "email": f"{id_token}@encargo.com",
            "name": id_token,
            "picture": "",
        }


def obtener_usuario_auth(uid: str) -> dict:
    """Obtiene datos del usuario desde Firebase Auth."""
    if USA_FIREBASE_REAL:
        from firebase_admin import auth
        user = auth.get_user(uid)
        return {
            "uid": user.uid,
            "email": user.email,
            "display_name": user.display_name,
            "photo_url": user.photo_url,
        }
    return {
        "uid": uid,
        "email": "usuario@encargo.com.co",
        "display_name": "Usuario Encargo",
        "photo_url": "",
    }
