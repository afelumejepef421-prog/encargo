/**
 * Encargo · MiPerfil.jsx
 * Vista y edición del perfil propio.
 * Muestra calificaciones recibidas con promedio.
 */
import React, { useState, useEffect } from 'react';
import api from '../api';
import FormField from '../components/FormField';
import FileInput from '../components/FileInput';
import Estado from '../components/Estado';
import StarRating from '../components/StarRating';
import SelectorUbicacion from '../components/SelectorUbicacion';

export default function MiPerfil({ perfil, onPerfilActualizado }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    apellidos: '',
    municipio: '',
    bio: '',
  });
  const [foto, setFoto] = useState(null);
  const [calificaciones, setCalificaciones] = useState([]);
  const [promedio, setPromedio] = useState(0);
  const [cargandoCal, setCargandoCal] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (perfil) {
      setForm({
        nombre: perfil.nombre || '',
        apellidos: perfil.apellidos || '',
        municipio: perfil.municipio || '',
        bio: perfil.bio || '',
      });
    }
  }, [perfil]);

  useEffect(() => {
    const cargarCalificaciones = async () => {
      setCargandoCal(true);
      try {
        const data = await api.get('/calificaciones/recibidas');
        const cals = Array.isArray(data) ? data : data.calificaciones || [];
        setCalificaciones(cals);
        if (cals.length > 0) {
          const sum = cals.reduce((acc, c) => acc + (c.puntuacion || c.estrellas || 0), 0);
          setPromedio(sum / cals.length);
        }
      } catch (err) {
        console.error('Error cargando calificaciones:', err);
      } finally {
        setCargandoCal(false);
      }
    };
    cargarCalificaciones();
  }, []);

  const handleChange = (campo) => (e) => {
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setMensaje('');
    setErrorMsg('');

    try {
      if (foto) {
        const formData = new FormData();
        formData.append('nombre', form.nombre.trim());
        formData.append('apellidos', form.apellidos.trim());
        formData.append('municipio', form.municipio);
        formData.append('bio', form.bio.trim());
        formData.append('foto', foto);
        await api.upload('/perfil', formData);
      } else {
        await api.patch('/perfil', {
          nombre: form.nombre.trim(),
          apellidos: form.apellidos.trim(),
          municipio: form.municipio,
          bio: form.bio.trim(),
        });
      }

      setMensaje('Perfil actualizado correctamente.');
      setEditando(false);
      setFoto(null);
      if (onPerfilActualizado) onPerfilActualizado();
    } catch (err) {
      setErrorMsg(err.message || 'Error al actualizar el perfil');
    } finally {
      setEnviando(false);
    }
  };

  if (!perfil) return <Estado tipo="cargando" mensaje="Cargando perfil…" />;

  return (
    <div style={{ maxWidth: '700px' }}>
      <h1>Mi perfil</h1>

      {mensaje && <Estado tipo="exito" mensaje={mensaje} />}
      {errorMsg && <Estado tipo="error" mensaje={errorMsg} />}

      {/* Cabecera de perfil */}
      <div className="perfil-cabecera-card" style={{ marginBottom: '24px' }}>
        <div className="perfil-avatar-caja">
          {perfil.foto_url ? (
            <img src={perfil.foto_url} alt={perfil.nombre} className="perfil-avatar-img" />
          ) : (
            <div className="perfil-avatar-placeholder">👤</div>
          )}
        </div>
        <div className="perfil-info-principal">
          <h2 className="perfil-nombre">
            {perfil.nombre} {perfil.apellidos}
          </h2>
          <p className="perfil-municipio">📍 {perfil.municipio || 'Sin municipio'}</p>
          {perfil.bio && (
            <p style={{ marginTop: '8px', color: '#444', fontSize: '0.9375rem' }}>
              {perfil.bio}
            </p>
          )}
          <p style={{ fontSize: '0.8125rem', color: '#888', marginTop: '8px' }}>
            ✉️ {perfil.email} &nbsp;·&nbsp; Rol: {perfil.rol}
          </p>
        </div>
        <div>
          {!editando && (
            <button type="button" className="btn-secundario btn-sm" onClick={() => setEditando(true)}>
              ✏️ Editar
            </button>
          )}
        </div>
      </div>

      {/* Formulario de edición */}
      {editando && (
        <div className="panel" style={{ marginBottom: '24px' }}>
          <h3>Editar datos</h3>
          <form onSubmit={handleGuardar}>
            <FormField
              label="Nombre"
              id="edit-nombre"
              value={form.nombre}
              onChange={handleChange('nombre')}
              required
            />
            <FormField
              label="Apellidos"
              id="edit-apellidos"
              value={form.apellidos}
              onChange={handleChange('apellidos')}
              required
            />
            <SelectorUbicacion
              value={form.municipio}
              onChange={(val) => setForm((prev) => ({ ...prev, municipio: val }))}
              required
              idPrefix="edit-perfil"
            />
            <FormField
              label="Biografía"
              id="edit-bio"
              type="textarea"
              value={form.bio}
              onChange={handleChange('bio')}
              rows={3}
            />
            <FileInput
              label="Foto de perfil (opcional)"
              id="edit-foto"
              accept="image/*"
              onChange={setFoto}
              ayuda="Sube una foto de perfil"
              maxSizeMB={5}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="submit" className="btn-principal" disabled={enviando}>
                {enviando ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" className="btn-secundario" onClick={() => { setEditando(false); setFoto(null); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Calificaciones recibidas */}
      <div style={{ marginTop: '16px' }}>
        <h2>Calificaciones recibidas</h2>

        {cargandoCal ? (
          <Estado tipo="cargando" mensaje="Cargando calificaciones…" />
        ) : calificaciones.length === 0 ? (
          <Estado tipo="vacio" mensaje="Aún no has recibido calificaciones." />
        ) : (
          <>
            <div className="reputacion-bloque" style={{ marginBottom: '16px' }}>
              <StarRating valor={Math.round(promedio)} soloLectura />
              <span className="promedio-numero">{promedio.toFixed(1)}</span>
              <span className="total-opiniones">({calificaciones.length} opiniones)</span>
            </div>
            <div className="lista-resenas">
              {calificaciones.map((cal, i) => (
                <div key={cal.id || i} className="resena-tarjeta">
                  <div className="resena-cabecera">
                    <div className="resena-autor">
                      <StarRating valor={cal.puntuacion || cal.estrellas || 0} soloLectura pequeno />
                      <span style={{ marginLeft: '8px', fontWeight: 500 }}>
                        {cal.autor_nombre || 'Anónimo'}
                      </span>
                    </div>
                    <span className="resena-fecha">
                      {cal.creado_en ? new Date(cal.creado_en).toLocaleDateString('es-CO') : ''}
                    </span>
                  </div>
                  {cal.comentario && (
                    <p className="resena-comentario">"{cal.comentario}"</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
