import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Estado from '../components/Estado';
import StarRating from '../components/StarRating';

export default function Calificaciones({ perfil }) {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [usuarioObjetivo, setUsuarioObjetivo] = useState(null);
  const [cargandoUsuario, setCargandoUsuario] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [estrellas, setEstrellas] = useState(5);
  const [comentario, setComentario] = useState('');
  const [solicitudId, setSolicitudId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  useEffect(() => {
    const cargar = async () => {
      setCargandoUsuario(true);
      setErrorCarga('');
      try {
        const data = await api.get(`/usuarios/${uid}/perfil-publico`);
        setUsuarioObjetivo(data);
      } catch (err) {
        // Fallback a ruta estándar
        try {
          const data2 = await api.get(`/usuarios/${uid}`);
          setUsuarioObjetivo(data2);
        } catch {
          setErrorCarga(err.message || 'Error al cargar perfil del usuario');
        }
      } finally {
        setCargandoUsuario(false);
      }
    };
    if (uid) {
      cargar();
    }
  }, [uid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uid === perfil?.uid) {
      setErrorEnvio('No puedes calificarte a ti mismo.');
      return;
    }

    setEnviando(true);
    setErrorEnvio('');

    try {
      await api.post('/calificaciones', {
        calificadoId: uid,
        valor: estrellas,
        comentario: comentario.trim() || null,
        solicitudId: solicitudId.trim() || 'directo',
      });
      setExito(true);
    } catch (err) {
      setErrorEnvio(err.data?.mensaje || err.message || 'Error al emitir la calificación.');
    } finally {
      setEnviando(false);
    }
  };

  const nombreObjetivo =
    usuarioObjetivo?.displayName ||
    `${usuarioObjetivo?.nombre || ''} ${usuarioObjetivo?.apellidos || ''}`.trim() ||
    'Usuario';

  if (cargandoUsuario) {
    return <Estado tipo="cargando" mensaje="Cargando información del usuario..." />;
  }

  if (errorCarga) {
    return <Estado tipo="error" mensaje={errorCarga} />;
  }

  return (
    <div className="contenedor" style={{ maxWidth: '540px', marginTop: '24px' }}>
      <h1>⭐ Calificar a {nombreObjetivo}</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Tu opinión ayuda a construir confianza y reputación comunitaria en Encargo.
      </p>

      {/* Tarjeta del usuario calificado */}
      <div className="tarjeta" style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        {usuarioObjetivo?.photoURL || usuarioObjetivo?.foto_url ? (
          <img
            src={usuarioObjetivo.photoURL || usuarioObjetivo.foto_url}
            alt={nombreObjetivo}
            style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div className="perfil-avatar-placeholder" style={{ width: '56px', height: '56px', fontSize: '1.75rem' }}>
            👤
          </div>
        )}
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{nombreObjetivo}</h3>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>📍 {usuarioObjetivo?.municipio || 'Colombia'}</div>
        </div>
      </div>

      {exito ? (
        <div className="tarjeta" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
          <h2>¡Calificación enviada!</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Gracias por calificar la experiencia con {nombreObjetivo}.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link to={`/usuarios/${uid}`} className="btn-principal btn-sm">
              Ver perfil de {nombreObjetivo}
            </Link>
            <Link to="/panel" className="btn-secundario btn-sm">
              Ir al panel
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="tarjeta" style={{ padding: '24px' }}>
          {errorEnvio && <Estado tipo="error" mensaje={errorEnvio} />}

          {/* Selección interactiva de estrellas */}
          <div className="form-grupo" style={{ textAlign: 'center', margin: '16px 0 24px 0' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontSize: '1.05rem', fontWeight: 600 }}>
              ¿Cómo calificarías el servicio o experiencia?
            </label>
            <StarRating
              valor={estrellas}
              onChange={(nueva) => setEstrellas(nueva)}
              soloLectura={false}
              tamano="lg"
            />
            <div style={{ marginTop: '8px', fontSize: '0.9rem', color: '#f39c12', fontWeight: 600 }}>
              {estrellas === 1 && '⭐ Muy insatisfecho'}
              {estrellas === 2 && '⭐⭐ Insatisfecho'}
              {estrellas === 3 && '⭐⭐⭐ Regular'}
              {estrellas === 4 && '⭐⭐⭐⭐ Bueno'}
              {estrellas === 5 && '⭐⭐⭐⭐⭐ ¡Excelente!'}
            </div>
          </div>

          <div className="form-grupo">
            <label htmlFor="comentario">Comentario de retroalimentación (opcional)</label>
            <textarea
              id="comentario"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Describe cómo fue trabajar con este usuario..."
              rows={4}
              maxLength={500}
            />
            <div style={{ fontSize: '0.75rem', color: '#888', textAlign: 'right' }}>
              {comentario.length}/500 caracteres
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn-secundario"
              onClick={() => navigate(-1)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-principal"
              disabled={enviando}
            >
              {enviando ? 'Guardando...' : 'Publicar Calificación'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
