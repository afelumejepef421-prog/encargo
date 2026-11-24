import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import Estado from '../components/Estado';
import FormField from '../components/FormField';

export default function Reporte() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tipoParam = searchParams.get('tipo');
  const tipoInicial = tipoParam ? tipoParam.toUpperCase() : 'SOLICITUD';
  const objetivoIdInicial = searchParams.get('id') || '';
  const tituloInicial = searchParams.get('titulo') || '';

  const [tipo, setTipo] = useState(tipoInicial === 'USUARIO' ? 'USUARIO' : 'SOLICITUD');
  const [objetivoId, setObjetivoId] = useState(objetivoIdInicial);
  const [motivo, setMotivo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = (searchParams.get('tipo') || '').toUpperCase();
    const id = searchParams.get('id') || '';
    if (t) setTipo(t === 'USUARIO' ? 'USUARIO' : 'SOLICITUD');
    if (id) setObjetivoId(id);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!motivo.trim() || motivo.trim().length < 5) {
      setError('El motivo debe tener al menos 5 caracteres explicativos.');
      return;
    }
    if (!objetivoId.trim()) {
      setError('Debe especificar el identificador de la solicitud o usuario a reportar.');
      return;
    }

    setEnviando(true);
    setError('');

    try {
      await api.post('/reportes', {
        tipo: tipo.toUpperCase(),
        objetivoId: objetivoId.trim(),
        motivo: motivo.trim(),
        descripcion: descripcion.trim() || null,
      });
      setExito(true);
    } catch (err) {
      setError(err.data?.mensaje || err.message || 'Error al enviar el reporte');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="contenedor" style={{ maxWidth: '560px', marginTop: '24px' }}>
      <h1>🚩 Reportar Incidencia o Comportamiento</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Los reportes son revisados directamente por el equipo de administración para mantener la plataforma segura.
      </p>

      {exito ? (
        <div className="tarjeta" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛡️</div>
          <h2>Reporte Recibido</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Hemos registrado tu reporte para investigación administrativa. Si es necesario, se tomarán medidas de moderación o suspensión de cuenta.
          </p>
          <button type="button" className="btn-principal btn-sm" onClick={() => navigate('/panel')}>
            Volver al Panel Principal
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="tarjeta" style={{ padding: '24px' }}>
          {error && <Estado tipo="error" mensaje={error} />}

          {tituloInicial && (
            <div style={{ background: '#f8f9fa', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.9rem' }}>
              <strong>Objetivo a reportar:</strong> {tituloInicial}
            </div>
          )}

          <div className="form-grupo">
            <label htmlFor="tipo-reporte">Tipo de reporte</label>
            <select
              id="tipo-reporte"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="SOLICITUD">Solicitud de servicio fraudulenta o inapropiada</option>
              <option value="USUARIO">Comportamiento indebido de un usuario</option>
            </select>
          </div>

          <div className="form-grupo">
            <label htmlFor="objetivoId">ID del objetivo</label>
            <input
              id="objetivoId"
              type="text"
              value={objetivoId}
              onChange={(e) => setObjetivoId(e.target.value)}
              placeholder="Identificador del elemento o usuario"
              required
            />
          </div>

          <div className="form-grupo">
            <label htmlFor="motivo">Motivo del reporte (mínimo 10 caracteres)</label>
            <input
              id="motivo"
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Contenido ofensivo, intento de estafa, incumplimiento..."
              required
              minLength={10}
            />
          </div>

          <div className="form-grupo">
            <label htmlFor="descripcion">Detalles adicionales (opcional)</label>
            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe lo ocurrido con el mayor detalle posible para el moderador..."
              rows={4}
            />
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
              className="btn-peligro"
              disabled={enviando}
            >
              {enviando ? 'Enviando reporte...' : 'Enviar Reporte a Moderación'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
