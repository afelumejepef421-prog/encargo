/**
 * Encargo · PerfilPublico.jsx
 * Perfil público de otro usuario.
 * Muestra: nombre, foto, bio, municipio, calificaciones.
 * NO muestra email ni datos privados.
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Estado from '../components/Estado';
import StarRating from '../components/StarRating';

export default function PerfilPublico({ perfil: miPerfil }) {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [calificaciones, setCalificaciones] = useState([]);
  const [promedio, setPromedio] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      setError('');
      try {
        const data = await api.get(`/usuarios/${uid}`);
        setUsuario(data);

        try {
          const calData = await api.get(`/calificaciones/usuario/${uid}`);
          const cals = Array.isArray(calData) ? calData : calData.calificaciones || [];
          setCalificaciones(cals);
          if (cals.length > 0) {
            const sum = cals.reduce((acc, c) => acc + (c.puntuacion || c.estrellas || 0), 0);
            setPromedio(sum / cals.length);
          }
        } catch (calErr) {
          console.error('Error cargando calificaciones:', calErr);
        }
      } catch (err) {
        setError(err.message || 'Error al cargar el perfil');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [uid]);

  const iniciarChat = async () => {
    try {
      const data = await api.post('/chats', { destinatario_uid: uid });
      navigate(`/chat/${data.id}`);
    } catch (err) {
      alert(err.message || 'Error al iniciar chat');
    }
  };

  if (cargando) return <Estado tipo="cargando" mensaje="Cargando perfil…" />;
  if (error) return <Estado tipo="error" mensaje={error} />;
  if (!usuario) return <Estado tipo="vacio" mensaje="Usuario no encontrado" />;

  const esMiPerfil = miPerfil?.uid === uid;

  return (
    <div style={{ maxWidth: '800px' }}>
      <button
        type="button"
        className="btn-secundario btn-sm"
        onClick={() => navigate(-1)}
        style={{ marginBottom: '16px' }}
      >
        ← Volver
      </button>

      {/* Cabecera de perfil */}
      <div className="perfil-cabecera-card" style={{ marginBottom: '24px' }}>
        <div className="perfil-avatar-caja">
          {usuario.foto_url ? (
            <img src={usuario.foto_url} alt={usuario.nombre} className="perfil-avatar-img" />
          ) : (
            <div className="perfil-avatar-placeholder">👤</div>
          )}
        </div>
        <div className="perfil-info-principal">
          <h1 className="perfil-nombre">
            {usuario.nombre} {usuario.apellidos || ''}
          </h1>
          {usuario.municipio && (
            <p className="perfil-municipio">📍 {usuario.municipio}</p>
          )}
          {usuario.bio && (
            <p style={{ marginTop: '8px', color: '#444', fontSize: '0.9375rem', lineHeight: 1.5 }}>
              {usuario.bio}
            </p>
          )}

          {/* Reputación */}
          <div style={{ marginTop: '12px' }}>
            {calificaciones.length > 0 ? (
              <div className="reputacion-bloque">
                <StarRating valor={Math.round(promedio)} soloLectura />
                <span className="promedio-numero">{promedio.toFixed(1)}</span>
                <span className="total-opiniones">({calificaciones.length} opiniones)</span>
              </div>
            ) : (
              <span className="sin-calificaciones">Sin calificaciones aún</span>
            )}
          </div>
        </div>
      </div>

      {/* Acciones */}
      {!esMiPerfil && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button type="button" className="btn-principal" onClick={iniciarChat}>
            💬 Enviar mensaje
          </button>
          <Link to={`/calificaciones/${uid}`} className="btn-secundario">
            ⭐ Calificar usuario
          </Link>
          <Link
            to={`/reporte?tipo=USUARIO&id=${uid}&titulo=${encodeURIComponent(usuario.nombre || usuario.displayName || 'Usuario')}`}
            className="btn-secundario btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            🚩 Reportar
          </Link>
        </div>
      )}

      {/* Calificaciones recibidas */}
      <div>
        <h2>Calificaciones recibidas</h2>

        {calificaciones.length === 0 ? (
          <Estado tipo="vacio" mensaje="Este usuario aún no tiene calificaciones." />
        ) : (
          <div className="lista-resenas">
            {calificaciones.map((cal, i) => (
              <div key={cal.id || i} className="resena-tarjeta">
                <div className="resena-cabecera">
                  <div className="resena-autor">
                    <StarRating valor={cal.puntuacion || cal.estrellas || 0} soloLectura tamano="sm" />
                    <span style={{ marginLeft: '8px', fontWeight: 500 }}>
                      {cal.calificadorNombre || cal.calificador_nombre || cal.autor_nombre || 'Usuario'}
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
        )}
      </div>
    </div>
  );
}
