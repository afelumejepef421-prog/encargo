import React from 'react';
import { Link } from 'react-router-dom';

export default function OfertaCard({
  oferta,
  onSeleccionar,
  esPropietario = false,
  seleccionando = false,
}) {
  const { prestador, neto_cop, comision_cop, total_cop, fecha_ofrecida, descripcion, creada } = oferta;

  const fechaFormateada = new Date(fecha_ofrecida).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="tarjeta" style={{ marginBottom: '16px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        {/* Información del Prestador */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {prestador.foto_url ? (
            <img
              src={prestador.foto_url}
              alt={prestador.nombres}
              style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#e0e0e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}
            >
              🔨
            </div>
          )}
          <div>
            <Link
              to={`/prestadores/${prestador.id}`}
              style={{ fontWeight: 600, fontSize: '1.05rem', color: '#1a1a2e', textDecoration: 'none' }}
            >
              {prestador.nombres} {prestador.apellidos}
            </Link>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
              📍 {prestador.municipio} • {prestador.promedio_calificacion ? `⭐ ${prestador.promedio_calificacion} (${prestador.total_calificaciones} calif.)` : '⭐ Nuevo prestador'}
            </div>
          </div>
        </div>

        {/* Desglose de Precios (RN-04) */}
        <div style={{ textAlign: 'right' }}>
          <div className="oferta-precios">
            <span className="precio-total">
              ${total_cop.toLocaleString('es-CO')} <span style={{ fontSize: '0.9rem' }}>COP</span>
            </span>
          </div>
          <div className="precio-detalle" style={{ fontSize: '0.75rem', color: '#777' }}>
            Neto: ${neto_cop.toLocaleString('es-CO')} + Comisión 8%: ${comision_cop.toLocaleString('es-CO')}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#2c3e50', marginTop: '4px' }}>
            📅 Entrega estimada: <strong>{fechaFormateada}</strong>
          </div>
        </div>
      </div>

      {/* Propuesta de trabajo */}
      <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: '#fafafa', borderRadius: '6px', fontSize: '0.9rem', color: '#333' }}>
        <strong>Propuesta:</strong> {descripcion}
      </div>

      {/* Botón de acción para el propietario */}
      {esPropietario && onSeleccionar && (
        <div style={{ marginTop: '12px', textAlign: 'right' }}>
          <button
            type="button"
            className="btn-principal btn-sm"
            onClick={() => onSeleccionar(oferta)}
            disabled={seleccionando}
          >
            {seleccionando ? 'Procesando...' : 'Contratar con pago simulado'}
          </button>
        </div>
      )}
    </div>
  );
}
