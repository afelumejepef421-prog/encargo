/**
 * Encargo · DetalleSolicitud.jsx
 * Vista detallada en tiempo real (onSnapshot) con postulación/negociación,
 * bloqueo a terceros tras doble confirmación, custodia (Escrow), confirmación de
 * trabajo completado (92%/8%) y reporte de incumplimiento.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import {
  firestoreService,
  formatearCOP,
  verificarSuspensionActiva,
  COMISION_PLATAFORMA,
} from '../firestoreService';
import Estado from '../components/Estado';

export default function DetalleSolicitud({ perfil }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [solicitud, setSolicitud] = useState(null);
  const [chatsPostulaciones, setChatsPostulaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [aviso, setAviso] = useState('');

  const esAdmin = perfil?.rol === 'ADMIN';
  const susp = verificarSuspensionActiva(perfil);

  const cargarChats = useCallback(async (solId) => {
    if (!solId) return;
    const lista = await firestoreService.listarChatsDeSolicitud(solId);
    setChatsPostulaciones(lista);
  }, []);

  useEffect(() => {
    if (!id) return;
    setCargando(true);
    setError('');
    const unsub = firestoreService.suscribirSolicitud(id, (data) => {
      if (!data) {
        setError('Solicitud no encontrada');
      } else {
        setSolicitud(data);
        cargarChats(id);
      }
      setCargando(false);
    });
    return () => unsub();
  }, [id, cargarChats]);

  const handleEliminar = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta solicitud?')) return;
    try {
      await api.delete(`/solicitudes/${id}`);
      navigate('/panel');
    } catch (err) {
      alert(err.message || 'Error al eliminar');
    }
  };

  const handleCancelar = async () => {
    if (!window.confirm('¿Deseas cancelar esta solicitud?')) return;
    try {
      await api.post(`/solicitudes/${id}/cancelar`);
    } catch (err) {
      alert(err.message || 'Error al cancelar');
    }
  };

  const iniciarNegociacion = async () => {
    if (susp.suspendida) {
      alert(`Tu cuenta está suspendida hasta ${new Date(susp.hasta).toLocaleString('es-CO')}.`);
      return;
    }
    setProcesando(true);
    try {
      const chat = await firestoreService.obtenerOCrearChat(
        perfil.uid,
        solicitud.autor_uid,
        solicitud
      );
      navigate(`/chat/${chat.id}`);
    } catch (err) {
      alert(err.message || 'Error al iniciar la negociación');
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarCompletado = async () => {
    setProcesando(true);
    setAviso('');
    try {
      const res = await firestoreService.confirmarTrabajoCompletado(
        solicitud.id,
        solicitud.chatId,
        perfil.uid
      );
      if (res.completada) {
        setAviso(
          `¡Servicio completado! Se liberó ${formatearCOP(res.netoPrestador)} (92%) al solucionador y ${formatearCOP(res.comision)} (8%) de comisión.`
        );
      } else {
        setAviso('Tu confirmación de trabajo completado fue registrada. Falta la confirmación de la contraparte.');
      }
    } catch (err) {
      alert(err.message || 'Error al confirmar');
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) return <Estado tipo="cargando" mensaje="Cargando solicitud…" />;
  if (error) return <Estado tipo="error" mensaje={error} />;
  if (!solicitud) return <Estado tipo="vacio" mensaje="Solicitud no encontrada" />;

  const esPropia = solicitud.autor_uid === perfil?.uid;
  const esPrestadorAsignado = solicitud.providerUid === perfil?.uid;
  const esParteDelAcuerdo = esPropia || esPrestadorAsignado;
  const estadoLower = String(solicitud.estado || 'PUBLICADO').toLowerCase();
  const estaPublicada = estadoLower === 'publicado';
  const estaEnProgreso = estadoLower === 'en_progreso' || estadoLower === 'acordada';
  const estaCompletada = estadoLower === 'completada';
  const estaIncumplida = estadoLower === 'incumplida';

  const formatearFecha = (fecha) => {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const miCompletado = esPropia
    ? Boolean(solicitud.clientCompletedConfirmed)
    : Boolean(solicitud.providerCompletedConfirmed);

  return (
    <div style={{ maxWidth: '800px' }}>
      <button
        type="button"
        className="btn-secundario btn-sm"
        onClick={() => navigate('/panel')}
        style={{ marginBottom: '16px' }}
      >
        ← Volver al panel
      </button>

      {aviso && <Estado tipo="exito" mensaje={aviso} />}

      <div className="tarjeta" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h1 style={{ marginBottom: '8px' }}>{solicitud.titulo}</h1>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`badge badge-${estadoLower}`}>
                {String(solicitud.estado || 'PUBLICADO').replace('_', ' ').toUpperCase()}
              </span>
              <span className="badge" style={{ background: '#e8e8e8', color: '#333' }}>
                {solicitud.categoria}
              </span>
              {solicitud.agreedPrice > 0 && (
                <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>
                  💰 Acuerdo: {formatearCOP(solicitud.agreedPrice)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '0.9375rem' }}>
          <div>
            <strong>Municipio:</strong> {solicitud.municipio}
          </div>
          <div>
            <strong>Fecha de publicación:</strong> {formatearFecha(solicitud.creado_en || solicitud.fecha_creacion)}
          </div>
          {solicitud.fecha_deseada && (
            <div>
              <strong>Fecha deseada:</strong> {formatearFecha(solicitud.fecha_deseada)}
            </div>
          )}
          {solicitud.agreedDateTime && (
            <div>
              <strong>Fecha/Hora pactada:</strong> {new Date(solicitud.agreedDateTime).toLocaleString('es-CO')}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3>Descripción</h3>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#333' }}>
            {solicitud.descripcion}
          </p>
        </div>

        {/* Bloque de Custodia (Escrow) y Progreso del Acuerdo */}
        {(estaEnProgreso || estaCompletada || estaIncumplida) && (
          <div className="panel" style={{ marginBottom: '20px', background: '#f8fafc', borderColor: '#cbd5e1' }}>
            <h3 style={{ marginBottom: '8px' }}>🔐 Estado del Acuerdo y Custodia (Escrow)</h3>
            <p style={{ fontSize: '0.88rem', marginBottom: '8px' }}>
              Solucionador asignado: <strong>{solicitud.providerNombre || 'Prestador'}</strong> ·
              Estado de fondos: <strong>{String(solicitud.escrowStatus || 'en_custodia').replace('_', ' ').toUpperCase()}</strong>
            </p>
            {solicitud.escrowAmount > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', fontSize: '0.85rem', marginBottom: '10px' }}>
                <div><strong>Retenido (100%):</strong> {formatearCOP(solicitud.escrowAmount)}</div>
                <div><strong>Comisión (8%):</strong> {formatearCOP(solicitud.platformFee || Math.round(solicitud.escrowAmount * COMISION_PLATAFORMA))}</div>
                <div><strong>Neto prestador (92%):</strong> {formatearCOP(solicitud.providerNet || (solicitud.escrowAmount - Math.round(solicitud.escrowAmount * COMISION_PLATAFORMA)))}</div>
              </div>
            )}
            {estaEnProgreso && !esParteDelAcuerdo && (
              <div style={{ color: '#92400e', background: '#fffbeb', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                🔒 Esta solicitud ya tiene un compromiso confirmado y no admite postulaciones de terceros.
              </div>
            )}
            {estaEnProgreso && esParteDelAcuerdo && (
              <div style={{ fontSize: '0.85rem' }}>
                Confirmación de trabajo completado — Cliente: <strong>{solicitud.clientCompletedConfirmed ? '✅' : '⏳'}</strong> · Solucionador: <strong>{solicitud.providerCompletedConfirmed ? '✅' : '⏳'}</strong>
              </div>
            )}
            {estaIncumplida && (
              <div style={{ color: '#991b1b', fontSize: '0.85rem' }}>
                ⛔ Acuerdo cerrado por incumplimiento: {solicitud.breachReason || 'Penalización aplicada.'}
              </div>
            )}
          </div>
        )}

        {/* Imágenes */}
        {solicitud.imagenes && solicitud.imagenes.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3>Imágenes</h3>
            <div className="galeria-evidencias">
              {solicitud.imagenes.map((img, i) => (
                <div key={i} className="evidencia-item">
                  <img
                    src={img.url || img}
                    alt={`Imagen ${i + 1}`}
                    className="evidencia-img"
                    style={{ cursor: 'pointer' }}
                    onClick={() => window.open(img.url || img, '_blank')}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Autor */}
        <div className="panel" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '8px' }}>Publicado por</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {solicitud.autor_foto ? (
              <img
                src={solicitud.autor_foto}
                alt={solicitud.autor_nombre}
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div className="perfil-avatar-placeholder" style={{ width: 48, height: 48, fontSize: '1.25rem' }}>
                👤
              </div>
            )}
            <div>
              <Link to={`/usuarios/${solicitud.autor_uid}`} style={{ fontWeight: 600, color: '#1a1a2e' }}>
                {solicitud.autor_nombre || 'Usuario'}
              </Link>
              {solicitud.autor_municipio && (
                <div style={{ fontSize: '0.8125rem', color: '#666' }}>
                  📍 {solicitud.autor_municipio}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel de Postulaciones y Chats Recibidos para el Autor */}
        {esPropia && chatsPostulaciones.length > 0 && (
          <div style={{ marginTop: '20px', marginBottom: '20px', padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#166534' }}>
              📥 Postulaciones y chats de negociación recibidos ({chatsPostulaciones.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {chatsPostulaciones.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fff',
                    padding: '12px 14px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {c.prestador_foto ? (
                      <img
                        src={c.prestador_foto}
                        alt={c.prestador_nombre}
                        style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div className="perfil-avatar-placeholder" style={{ width: 38, height: 38, fontSize: '1rem' }}>
                        👤
                      </div>
                    )}
                    <div>
                      <strong style={{ fontSize: '0.9375rem' }}>{c.prestador_nombre || 'Postulante'}</strong>
                      {c.prestador_municipio && (
                        <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '6px' }}>
                          📍 {c.prestador_municipio}
                        </span>
                      )}
                      <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: '#555' }}>
                        {c.ultimo_mensaje || c.ultimoMensaje || 'Conversación iniciada'}
                      </p>
                    </div>
                  </div>
                  <Link to={`/chat/${c.id}`} className="btn-principal btn-sm">
                    💬 Abrir chat de negociación
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {!esPropia && estaPublicada && (
            (() => {
              const miChat = chatsPostulaciones.find((c) =>
                (c.participantes || []).includes(perfil?.uid)
              );
              if (miChat) {
                return (
                  <Link
                    to={`/chat/${miChat.id}`}
                    className="btn-principal"
                    style={{ display: 'inline-flex', alignItems: 'center' }}
                  >
                    💬 Continuar negociación / Ver chat
                  </Link>
                );
              }
              return (
                <button
                  type="button"
                  className="btn-principal"
                  disabled={procesando || susp.suspendida}
                  onClick={iniciarNegociacion}
                >
                  🤝 {procesando ? 'Abriendo negociación…' : 'Postularme / Negociar'}
                </button>
              );
            })()
          )}

          {esParteDelAcuerdo && solicitud.chatId && (
            <Link to={`/chat/${solicitud.chatId}`} className="btn-principal" style={{ display: 'inline-flex', alignItems: 'center' }}>
              💬 Ir al chat del acuerdo
            </Link>
          )}

          {estaEnProgreso && esParteDelAcuerdo && (
            <button
              type="button"
              className="btn-principal"
              disabled={miCompletado || procesando}
              onClick={handleConfirmarCompletado}
              style={{ backgroundColor: '#15803d' }}
            >
              {miCompletado ? '✓ Ya confirmaste finalización' : '✅ Confirmar trabajo completado'}
            </button>
          )}

          {!esPropia && solicitud.autor_uid && (
            <Link
              to={`/calificaciones/${solicitud.autor_uid}`}
              className="btn-secundario"
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              ⭐ Calificar autor
            </Link>
          )}

          {esPropia && !estaEnProgreso && !estaCompletada && (
            <>
              <button type="button" className="btn-peligro" onClick={handleEliminar}>
                Eliminar
              </button>
              {estadoLower !== 'cancelado' && (
                <button type="button" className="btn-secundario" onClick={handleCancelar}>
                  Cancelar solicitud
                </button>
              )}
            </>
          )}

          {esAdmin && !esPropia && (
            <button type="button" className="btn-peligro" onClick={handleEliminar}>
              Eliminar (Admin)
            </button>
          )}

          {!esPropia && (
            <Link
              to={`/reporte?tipo=SOLICITUD&id=${solicitud.id}&titulo=${encodeURIComponent(solicitud.titulo)}`}
              className="btn-secundario btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              🚩 Reportar
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
