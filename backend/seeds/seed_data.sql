-- ============================================================
-- Encargo · Datos iniciales (seed)
-- Administrador, categorías y festivos colombianos 2026-2027
-- ============================================================

-- ── Administrador ──────────────────────────────────────────
-- Contraseña: se debe generar el hash con PBKDF2 al inicializar.
-- Este INSERT es un placeholder; el script de inicialización
-- de Python generará el hash real de forma segura.

-- ── Categorías estáticas ───────────────────────────────────
-- Se almacenan en config.py como catálogo. No es tabla aparte.
-- Códigos: COMP, ELEC, PLOM, LIMP, REPA

-- ── Festivos colombianos 2026 ──────────────────────────────
INSERT OR IGNORE INTO festivos (fecha_local, descripcion) VALUES
    ('2026-01-01', 'Año Nuevo'),
    ('2026-01-12', 'Día de los Reyes Magos'),
    ('2026-03-23', 'Día de San José'),
    ('2026-03-29', 'Domingo de Ramos'),
    ('2026-03-30', 'Lunes Santo'),
    ('2026-03-31', 'Martes Santo'),
    ('2026-04-01', 'Miércoles Santo'),
    ('2026-04-02', 'Jueves Santo'),
    ('2026-04-03', 'Viernes Santo'),
    ('2026-04-05', 'Domingo de Resurrección'),
    ('2026-05-01', 'Día del Trabajo'),
    ('2026-05-18', 'Día de la Ascensión'),
    ('2026-06-08', 'Corpus Christi'),
    ('2026-06-15', 'Sagrado Corazón'),
    ('2026-06-29', 'San Pedro y San Pablo'),
    ('2026-07-20', 'Día de la Independencia'),
    ('2026-08-07', 'Batalla de Boyacá'),
    ('2026-08-17', 'Asunción de la Virgen'),
    ('2026-10-12', 'Día de la Raza'),
    ('2026-11-02', 'Todos los Santos'),
    ('2026-11-16', 'Independencia de Cartagena'),
    ('2026-12-08', 'Inmaculada Concepción'),
    ('2026-12-25', 'Navidad');

-- ── Festivos colombianos 2027 ──────────────────────────────
INSERT OR IGNORE INTO festivos (fecha_local, descripcion) VALUES
    ('2027-01-01', 'Año Nuevo'),
    ('2027-01-11', 'Día de los Reyes Magos'),
    ('2027-03-22', 'Día de San José'),
    ('2027-03-21', 'Domingo de Ramos'),
    ('2027-03-22', 'Lunes Santo'),
    ('2027-03-23', 'Martes Santo'),
    ('2027-03-24', 'Miércoles Santo'),
    ('2027-03-25', 'Jueves Santo'),
    ('2027-03-26', 'Viernes Santo'),
    ('2027-03-28', 'Domingo de Resurrección'),
    ('2027-05-01', 'Día del Trabajo'),
    ('2027-05-10', 'Día de la Ascensión'),
    ('2027-05-31', 'Corpus Christi'),
    ('2027-06-07', 'Sagrado Corazón'),
    ('2027-06-29', 'San Pedro y San Pablo'),
    ('2027-07-20', 'Día de la Independencia'),
    ('2027-08-07', 'Batalla de Boyacá'),
    ('2027-08-16', 'Asunción de la Virgen'),
    ('2027-10-18', 'Día de la Raza'),
    ('2027-11-01', 'Todos los Santos'),
    ('2027-11-15', 'Independencia de Cartagena'),
    ('2027-12-08', 'Inmaculada Concepción'),
    ('2027-12-25', 'Navidad');
