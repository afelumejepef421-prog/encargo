import React from 'react';
import { Link } from 'react-router-dom';
import { formatearCOP } from '../firestoreService';

export default function SolicitudCard({
  solicitud,
  esPropia = false,
  esAdmin = false,
  onEliminar,
  onCancelar,
}) {
  const {
    id,
    titulo,
    descripcion,
    categoria,
    municipio,
    fecha_deseada,
    fechaDeseada,
    estado = 'PUBLICADO',
    autor_nombre,
    autorNombre,
    autor_foto,
    autorFoto,
    autor_uid,
    autorUid,
    creadoEn,
  } = solicitud;

  const fechaFinal = fecha_deseada || fechaDeseada;
  const nombreAutor = autor_nombre || autorNombre || 'Usuario';
  const fotoAutor = autor_foto || autorFoto;
  const idAutor = autor_uid || autorUid;

  const formatearFecha = (f) => {
    if (!f) return '';
    try {
      return new Date(f).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return f;
    }
  };

  const estadoUpper = String(estado || 'PUBLICADO').toUpperCase();
  const estaCancelado = estadoUpper === 'CANCELADO';
  const estaEnProgreso = estadoUpper === 'EN_PROGRESO' || estadoUpper === 'ACORDADA';
  const estaCompletada = estadoUpper === 'COMPLETADA';

  const badgeClass =
    estaCancelado
      ? 'badge badge-cancelado'
      : estadoUpper === 'PUBLICADO'
      ? 'badge badge-publicado'
      : `badge badge-${estadoUpper.toLowerCase()}`;

  return (
    <div className="tarjeta" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span className="badge" style={{ backgroundColor: '#ebf5fb', color: '#1a5276' }}>
              {categoria}
            </span>
            <span className={badgeClass}>{estadoUpper.replace('_', ' ')}</span>
            {solicitud.agreedPrice > 0 && (
              <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                {formatearCOP(solicitud.agreedPrice)}
              </span>
            )}
            <span style={{ fontSize: '0.8rem', color: '#666' }}>📍 {municipio}</span>
          </div>

          <h3 style={{ margin: '4px 0 8px 0', fontSize: '1.2rem' }}>
            <Link to={`/solicitudes/${id}`} style={{ color: '#1a1a2e', textDecoration: 'none' }}>
              {titulo}
            </Link>
          </h3>
        </div>

        {fechaFinal && (
          <div style={{ fontSize: '0.8125rem', color: '#555', textAlign: 'right' }}>
            📅 Para: <strong>{formatearFecha(fechaFinal)}</strong>
          </div>
        )}
      </div>

      <p style={{
        fontSize: '0.9rem',
        color: '#444',
        margin: '8px 0 14px 0',
        lineHeight: '1.4',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {descripcion}
      </p>

      {/* Pie de la tarjeta */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '10px',
        borderTop: '1px solid #f0f0f0',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        {/* Autor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {fotoAutor ? (
            <img
              src={fotoAutor}
              alt={nombreAutor}
              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: '1.1rem' }}>👤</span>
          )}
          {idAutor ? (
            <Link
              to={`/usuarios/${idAutor}`}
              style={{ fontSize: '0.85rem', color: '#2980b9', textDecoration: 'none', fontWeight: 500 }}
            >
              {nombreAutor}
            </Link>
          ) : (
            <span style={{ fontSize: '0.85rem', color: '#555' }}>{nombreAutor}</span>
          )}
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to={`/solicitudes/${id}`} className="btn-secundario btn-sm">
            Ver detalle
          </Link>

          {/* Cancelar (solo creador si sigue publicada) */}
          {esPropia && !estaCancelado && !estaEnProgreso && !estaCompletada && onCancelar && (
            <button
              type="button"
              className="btn-secundario btn-sm"
              onClick={() => onCancelar(id)}
              style={{ color: '#d35400', borderColor: '#f39c12' }}
            >
              Cancelar solicitud
            </button>
          )}

          {/* Eliminar (creador si no está en progreso, o Admin) */}
          {((esPropia && !estaEnProgreso) || esAdmin) && onEliminar && (
            <button
              type="button"
              className="btn-peligro btn-sm"
              onClick={() => onEliminar(id)}
            >
              {esAdmin && !esPropia ? 'Eliminar (Admin)' : 'Eliminar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
