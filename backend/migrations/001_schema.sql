-- ============================================================
-- Encargo · Migración 001 · Esquema completo
-- SQLite con FK, UNIQUE, CHECK, índices
-- Basado en ERS Encargo 1.0 y Arquitectura Encargo 1.0
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ────────────────────────────────────────────────────────────
-- 1. USUARIOS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id                    TEXT PRIMARY KEY,
    tipo                  TEXT NOT NULL CHECK (tipo IN ('CLIENTE', 'PRESTADOR', 'ADMIN')),
    cedula                TEXT NOT NULL,
    nombres               TEXT NOT NULL CHECK (length(nombres) BETWEEN 1 AND 80),
    apellidos             TEXT NOT NULL CHECK (length(apellidos) BETWEEN 1 AND 80),
    correo                TEXT NOT NULL,
    password_hash         TEXT NOT NULL,
    salt                  TEXT NOT NULL,
    iteraciones           INTEGER NOT NULL DEFAULT 600000,
    municipio             TEXT NOT NULL,
    categorias_json       TEXT,  -- JSON array de códigos de categoría; NULL para clientes
    foto_id               TEXT,  -- FK a archivos.id
    mayor_edad_declarada  INTEGER NOT NULL DEFAULT 0 CHECK (mayor_edad_declarada IN (0, 1)),
    consentimiento_fecha  TEXT,  -- ISO 8601 UTC
    activo                INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
    creado                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    CONSTRAINT uq_usuarios_correo UNIQUE (correo),
    CONSTRAINT uq_usuarios_cedula UNIQUE (cedula)
);

-- ────────────────────────────────────────────────────────────
-- 2. SESIONES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sesiones (
    token_hash   TEXT PRIMARY KEY,
    usuario_id   TEXT NOT NULL REFERENCES usuarios(id),
    csrf_hash    TEXT NOT NULL,
    creada       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    expira       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira  ON sesiones(expira);

-- ────────────────────────────────────────────────────────────
-- 3. SOLICITUDES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes (
    id                 TEXT PRIMARY KEY,
    propietario_id     TEXT NOT NULL REFERENCES usuarios(id),
    titulo             TEXT NOT NULL CHECK (length(titulo) BETWEEN 5 AND 100),
    descripcion        TEXT NOT NULL CHECK (length(descripcion) BETWEEN 20 AND 2000),
    categoria          TEXT NOT NULL,
    municipio          TEXT NOT NULL,
    direccion_privada  TEXT NOT NULL,
    fecha_deseada      TEXT NOT NULL,       -- ISO 8601 UTC
    estado             TEXT NOT NULL DEFAULT 'PUBLICADO'
                       CHECK (estado IN (
                           'PUBLICADO', 'CONTRATADO', 'INICIO_PENDIENTE',
                           'EN_CURSO', 'FIN_PENDIENTE', 'COMPLETADO', 'CANCELADO'
                       )),
    version            INTEGER NOT NULL DEFAULT 1,
    creada             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_propietario ON solicitudes(propietario_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado      ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_categoria   ON solicitudes(categoria);
CREATE INDEX IF NOT EXISTS idx_solicitudes_municipio   ON solicitudes(municipio);

-- ────────────────────────────────────────────────────────────
-- 4. OFERTAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ofertas (
    id              TEXT PRIMARY KEY,
    solicitud_id    TEXT NOT NULL REFERENCES solicitudes(id),
    prestador_id    TEXT NOT NULL REFERENCES usuarios(id),
    neto_cop        INTEGER NOT NULL CHECK (neto_cop BETWEEN 1000 AND 10000000),
    fecha_ofrecida  TEXT NOT NULL,       -- ISO 8601 UTC
    descripcion     TEXT NOT NULL CHECK (length(descripcion) BETWEEN 20 AND 1000),
    creada          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    CONSTRAINT uq_ofertas_solicitud_prestador UNIQUE (solicitud_id, prestador_id)
);

CREATE INDEX IF NOT EXISTS idx_ofertas_solicitud ON ofertas(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_prestador ON ofertas(prestador_id);

-- ────────────────────────────────────────────────────────────
-- 5. CONTRATOS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contratos (
    id               TEXT PRIMARY KEY,
    solicitud_id     TEXT NOT NULL REFERENCES solicitudes(id),
    oferta_id        TEXT NOT NULL REFERENCES ofertas(id),
    neto_cop         INTEGER NOT NULL,
    comision_cop     INTEGER NOT NULL,
    total_cop        INTEGER NOT NULL,
    fecha_pactada    TEXT NOT NULL,       -- fecha_ofrecida de la oferta aceptada
    saldo_estado     TEXT NOT NULL DEFAULT 'RESERVADO'
                     CHECK (saldo_estado IN ('RESERVADO', 'LIBERADO', 'DEVUELTO')),
    inicio_solicitado TEXT,              -- ISO 8601 UTC
    inicio_limite     TEXT,              -- vencimiento de confirmación de inicio
    fin_solicitado    TEXT,              -- ISO 8601 UTC
    fin_limite        TEXT,              -- vencimiento de confirmación de fin
    creado            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    CONSTRAINT uq_contratos_solicitud UNIQUE (solicitud_id),
    CONSTRAINT uq_contratos_oferta    UNIQUE (oferta_id),
    CONSTRAINT chk_contratos_total    CHECK (total_cop = neto_cop + comision_cop)
);

-- ────────────────────────────────────────────────────────────
-- 6. INTENTOS DE PAGO
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intentos_pago (
    id               TEXT PRIMARY KEY,
    clave_operacion  TEXT NOT NULL,
    solicitante_id   TEXT NOT NULL REFERENCES usuarios(id),
    oferta_id        TEXT NOT NULL REFERENCES ofertas(id),
    contrato_id      TEXT REFERENCES contratos(id),
    resultado        TEXT NOT NULL DEFAULT 'PENDIENTE'
                     CHECK (resultado IN ('PENDIENTE', 'FALLIDO', 'APROBADO')),
    total_cop        INTEGER NOT NULL,
    creada           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    expira           TEXT NOT NULL,

    CONSTRAINT uq_intentos_clave UNIQUE (clave_operacion)
);

CREATE INDEX IF NOT EXISTS idx_intentos_oferta      ON intentos_pago(oferta_id);
CREATE INDEX IF NOT EXISTS idx_intentos_solicitante  ON intentos_pago(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_intentos_resultado    ON intentos_pago(resultado);

-- ────────────────────────────────────────────────────────────
-- 7. ARCHIVOS (metadatos; bytes en disco local)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS archivos (
    id              TEXT PRIMARY KEY,
    propietario_id  TEXT NOT NULL REFERENCES usuarios(id),
    solicitud_id    TEXT REFERENCES solicitudes(id),
    contrato_id     TEXT REFERENCES contratos(id),
    clase           TEXT NOT NULL CHECK (clase IN ('FOTO', 'SOPORTE', 'SOLICITUD', 'EVIDENCIA')),
    r2_key          TEXT NOT NULL,       -- ruta relativa en uploads/
    mime            TEXT NOT NULL,
    bytes           INTEGER NOT NULL CHECK (bytes > 0 AND bytes <= 5242880),
    estado          TEXT NOT NULL DEFAULT 'TEMPORAL'
                    CHECK (estado IN ('TEMPORAL', 'VIGENTE', 'OCULTO')),
    creada          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    CONSTRAINT uq_archivos_r2_key UNIQUE (r2_key)
);

CREATE INDEX IF NOT EXISTS idx_archivos_propietario ON archivos(propietario_id);
CREATE INDEX IF NOT EXISTS idx_archivos_solicitud   ON archivos(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_archivos_contrato    ON archivos(contrato_id);

-- ────────────────────────────────────────────────────────────
-- 8. MENSAJES (chat del encargo)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajes (
    id           TEXT PRIMARY KEY,
    contrato_id  TEXT NOT NULL REFERENCES contratos(id),
    autor_id     TEXT NOT NULL REFERENCES usuarios(id),
    clave_envio  TEXT NOT NULL,
    texto        TEXT NOT NULL CHECK (length(texto) BETWEEN 1 AND 2000),
    creada       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    CONSTRAINT uq_mensajes_autor_clave UNIQUE (autor_id, clave_envio)
);

CREATE INDEX IF NOT EXISTS idx_mensajes_contrato ON mensajes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_creada   ON mensajes(contrato_id, creada);

-- ────────────────────────────────────────────────────────────
-- 9. REPORTES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reportes (
    id                TEXT PRIMARY KEY,
    contrato_id       TEXT NOT NULL REFERENCES contratos(id),
    autor_id          TEXT REFERENCES usuarios(id),    -- NULL para evento automático
    motivo            TEXT NOT NULL CHECK (length(motivo) BETWEEN 10 AND 1000),
    descripcion       TEXT,
    estado            TEXT NOT NULL DEFAULT 'ABIERTO'
                      CHECK (estado IN ('ABIERTO', 'RESUELTO')),
    resolucion        TEXT,
    administrador_id  TEXT REFERENCES usuarios(id),
    resuelto_en       TEXT,
    creado            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Índice parcial: máximo un reporte ABIERTO por contrato
CREATE UNIQUE INDEX IF NOT EXISTS uq_reportes_contrato_abierto
    ON reportes(contrato_id) WHERE estado = 'ABIERTO';

CREATE INDEX IF NOT EXISTS idx_reportes_estado ON reportes(estado);

-- ────────────────────────────────────────────────────────────
-- 10. EVENTOS (auditoría)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eventos (
    id              TEXT PRIMARY KEY,
    contrato_id     TEXT NOT NULL REFERENCES contratos(id),
    reporte_id      TEXT REFERENCES reportes(id),
    actor_id        TEXT REFERENCES usuarios(id),
    tipo            TEXT NOT NULL,
    datos_minimos   TEXT,                -- JSON con datos no sensibles
    creada          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    clave_evento    TEXT NOT NULL,

    CONSTRAINT uq_eventos_clave UNIQUE (clave_evento)
);

CREATE INDEX IF NOT EXISTS idx_eventos_contrato ON eventos(contrato_id);

-- ────────────────────────────────────────────────────────────
-- 11. CALIFICACIONES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calificaciones (
    id               TEXT PRIMARY KEY,
    contrato_id      TEXT NOT NULL REFERENCES contratos(id),
    autor_id         TEXT NOT NULL REFERENCES usuarios(id),
    destinatario_id  TEXT NOT NULL REFERENCES usuarios(id),
    valor            INTEGER NOT NULL CHECK (valor BETWEEN 1 AND 5),
    comentario       TEXT CHECK (comentario IS NULL OR length(comentario) <= 500),
    creada           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    CONSTRAINT uq_calificaciones_contrato_autor UNIQUE (contrato_id, autor_id),
    CONSTRAINT chk_calificaciones_no_auto       CHECK (autor_id != destinatario_id)
);

CREATE INDEX IF NOT EXISTS idx_calificaciones_destinatario ON calificaciones(destinatario_id);

-- ────────────────────────────────────────────────────────────
-- 12. AUTORIZACIONES (portafolio)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autorizaciones (
    archivo_id      TEXT PRIMARY KEY REFERENCES archivos(id),
    solicitante_id  TEXT NOT NULL REFERENCES usuarios(id),
    contrato_id     TEXT NOT NULL REFERENCES contratos(id),
    otorgada_en     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    retirada_en     TEXT          -- NULL = vigente
);

-- ────────────────────────────────────────────────────────────
-- 13. FESTIVOS (calendario colombiano)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS festivos (
    fecha_local  TEXT PRIMARY KEY,       -- YYYY-MM-DD
    descripcion  TEXT NOT NULL
);

-- ────────────────────────────────────────────────────────────
-- 14. LÍMITES DE ACCESO (rate limiting)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS limites_acceso (
    clave_hash      TEXT NOT NULL,
    tipo            TEXT NOT NULL CHECK (tipo IN ('CUENTA', 'RED')),
    ventana_inicio  TEXT NOT NULL,
    fallos          INTEGER NOT NULL DEFAULT 0,
    bloqueo_hasta   TEXT,

    PRIMARY KEY (clave_hash, tipo)
);

CREATE INDEX IF NOT EXISTS idx_limites_bloqueo ON limites_acceso(bloqueo_hasta);
