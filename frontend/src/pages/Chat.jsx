/**
 * Encargo · Chat.jsx
 * Vista de chat privado seguro en tiempo real (onSnapshot) con limpieza de listeners.
 * Integra el panel de negociación, acuerdo, doble confirmación y custodia (Escrow).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { firestoreService, verificarSuspensionActiva } from '../firestoreService';
import Estado from '../components/Estado';
import AcuerdoChatPanel from '../components/AcuerdoChatPanel';

const MAX_CARACTERES = 500;

export default function Chat({ perfil }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mensajes, setMensajes] = useState([]);
  const [infoChat, setInfoChat] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const historialRef = useRef(null);

  const scrollAlFinal = useCallback(() => {
    if (historialRef.current) {
      historialRef.current.scrollTop = historialRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (!id || !perfil?.uid) return;
    setCargando(true);
    setError('');

    const unsubChat = firestoreService.suscribirChat(id, perfil.uid, (chat) => {
      if (!chat) {
        setError('No se encontró la conversación o no tienes acceso.');
        setCargando(false);
        return;
      }
      setInfoChat(chat);
      setCargando(false);
    });

    const unsubMsgs = firestoreService.suscribirMensajes(id, (lista) => {
      setMensajes(Array.isArray(lista) ? lista : []);
    });

    return () => {
      unsubChat();
      unsubMsgs();
    };
  }, [id, perfil?.uid]);

  useEffect(() => {
    scrollAlFinal();
  }, [mensajes, scrollAlFinal]);

  const susp = verificarSuspensionActiva(perfil);

  const enviarMensaje = async (e) => {
    e.preventDefault();
    if (!texto.trim() || enviando || susp.suspendida) return;

    setEnviando(true);
    try {
      await api.post(`/chats/${id}/mensajes`, { contenido: texto.trim() });
      setTexto('');
    } catch (err) {
      alert(err.message || 'Error al enviar el mensaje');
    } finally {
      setEnviando(false);
    }
  };

  const formatearHora = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (cargando) return <Estado tipo="cargando" mensaje="Cargando chat…" />;
  if (error) return <Estado tipo="error" mensaje={error} />;

  const otroNombre = infoChat?.otro_nombre || 'Usuario';
  const otroFoto = infoChat?.otro_foto;
  const otroBio = infoChat?.otro_bio;
  const otroUid = infoChat?.otro_uid;

  return (
    <div className="chat-pagina">
      {/* Cabecera */}
      <div className="chat-cabecera-panel">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {otroFoto ? (
              <img
                src={otroFoto}
                alt={otroNombre}
                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div className="perfil-avatar-placeholder" style={{ width: 44, height: 44, fontSize: '1.125rem' }}>
                👤
              </div>
            )}
            <div>
              <h2 className="chat-titulo" style={{ margin: 0 }}>
                {otroUid ? (
                  <Link to={`/usuarios/${otroUid}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {otroNombre}
                  </Link>
                ) : (
                  otroNombre
                )}
              </h2>
              {otroBio && (
                <p className="chat-subtitulo" style={{ margin: 0 }}>{otroBio}</p>
              )}
            </div>
          </div>
        </div>
        <div className="chat-acciones-cabecera">
          {otroUid && (
            <>
              <Link
                to={`/calificaciones/${otroUid}`}
                className="btn-secundario btn-sm"
                title="Calificar a este usuario"
              >
                ⭐ Calificar
              </Link>
              <Link
                to={`/reporte?tipo=USUARIO&id=${otroUid}&titulo=${encodeURIComponent(otroNombre)}`}
                className="btn-secundario btn-sm"
                title="Reportar usuario a moderación"
              >
                🚩 Reportar
              </Link>
            </>
          )}
          <button type="button" className="btn-secundario btn-sm" onClick={() => navigate('/chat')}>
            ← Volver
          </button>
        </div>
      </div>

      {/* Banner de privacidad segura */}
      <div style={{
        background: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '6px',
        padding: '8px 14px',
        marginBottom: '12px',
        fontSize: '0.8rem',
        color: '#555',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px',
      }}>
        <span>🔒 <strong>Chat privado seguro:</strong> Datos personales y de contacto ocultos para tu privacidad.</span>
        <span>{otroBio ? `Historial: ${otroBio}` : 'Usuario verificado'}</span>
      </div>

      {/* Panel de Acuerdo / Negociación vinculada a la solicitud */}
      <AcuerdoChatPanel infoChat={infoChat} perfil={perfil} />

      {/* Caja de chat */}
      <div className="chat-caja">
        <div className="chat-historial" ref={historialRef}>
          {mensajes.length === 0 ? (
            <div className="chat-vacio">
              <p style={{ fontSize: '1.125rem', marginBottom: '8px' }}>💬</p>
              <p>No hay mensajes aún. ¡Envía el primero para iniciar la negociación!</p>
            </div>
          ) : (
            mensajes.map((msg, i) => {
              const remitenteId = msg.senderId || msg.remitente_uid || msg.remitenteId || msg.autor_uid;
              const esMio = remitenteId === perfil?.uid;
              const remitenteNombre = esMio
                ? 'Tú'
                : (msg.senderName || msg.autor_nombre || otroNombre);
              const hora = formatearHora(msg.timestamp || msg.creado_en || msg.fecha || msg.creadoEn);
              const textoMensaje = msg.content || msg.contenido || msg.texto;

              return (
                <div
                  key={msg.id || i}
                  className={`mensaje-fila ${esMio ? 'mensaje-fila-propia' : 'mensaje-fila-contraparte'}`}
                >
                  <div className={`mensaje-burbuja ${esMio ? 'burbuja-propia' : 'burbuja-contraparte'}`}>
                    <div className="mensaje-meta">
                      <span className="mensaje-autor">{remitenteNombre}</span>
                      <span>{hora}</span>
                    </div>
                    <div className="mensaje-cuerpo">{textoMensaje}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Formulario de envío */}
        <form className="chat-formulario" onSubmit={enviarMensaje}>
          <div className="chat-input-grupo">
            <textarea
              className="chat-textarea"
              rows={2}
              placeholder={susp.suspendida ? 'Cuenta suspendida temporalmente' : 'Escribe un mensaje…'}
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, MAX_CARACTERES))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviarMensaje(e);
                }
              }}
              disabled={enviando || susp.suspendida}
            />
            <div className="chat-input-pie">
              <span className="contador-caracteres">
                {texto.length}/{MAX_CARACTERES}
              </span>
              <button
                type="submit"
                className="btn-principal btn-sm"
                disabled={!texto.trim() || enviando || susp.suspendida}
              >
                {enviando ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
