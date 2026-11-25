/**
 * Encargo · ChatList.jsx
 * Lista de conversaciones del usuario en tiempo real con suscripción Firestore.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { firestoreService } from '../firestoreService';
import { auth } from '../firebase';
import Estado from '../components/Estado';

export default function ChatList({ perfil, usuario }) {
  const [chats, setChats] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const uidActual = perfil?.uid || usuario?.uid || auth.currentUser?.uid;

  useEffect(() => {
    if (!uidActual) return;
    setCargando(true);
    setError('');

    // Suscripción reactiva en tiempo real: al llegar un nuevo mensaje o chat, la lista se actualiza al instante
    const unsub = firestoreService.suscribirMisChats(uidActual, (lista) => {
      setChats(Array.isArray(lista) ? lista : []);
      setCargando(false);
    });

    return () => unsub();
  }, [uidActual]);

  const formatearHora = (fecha) => {
    if (!fecha) return '';
    const d = new Date(fecha);
    const hoy = new Date();
    const esHoy =
      d.getDate() === hoy.getDate() &&
      d.getMonth() === hoy.getMonth() &&
      d.getFullYear() === hoy.getFullYear();

    if (esHoy) {
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={{ maxWidth: '700px' }}>
      <h1>Mis conversaciones</h1>

      {error && <Estado tipo="error" mensaje={error} />}

      {cargando ? (
        <Estado tipo="cargando" mensaje="Cargando conversaciones…" />
      ) : chats.length === 0 ? (
        <Estado tipo="vacio" mensaje="No tienes conversaciones aún. Contacta a un usuario desde una solicitud para iniciar un chat." />
      ) : (
        <div className="lista-chats">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              to={`/chat/${chat.id}`}
              className="tarjeta chat-item-enlace"
              style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' }}
            >
              {chat.otro_foto ? (
                <img
                  src={chat.otro_foto}
                  alt={chat.otro_nombre}
                  style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div
                  className="perfil-avatar-placeholder"
                  style={{ width: 48, height: 48, fontSize: '1.25rem', flexShrink: 0 }}
                >
                  👤
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px', gap: '8px' }}>
                  <strong style={{ fontSize: '0.9375rem' }}>
                    {chat.otro_nombre || 'Usuario'}
                    {chat.solicitudTitulo && (
                      <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#1d4ed8', marginLeft: '6px' }}>
                        · {chat.solicitudTitulo}
                      </span>
                    )}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#888', flexShrink: 0 }}>
                    {formatearHora(chat.actualizado_en || chat.ultimo_mensaje_fecha)}
                  </span>
                </div>
                <p style={{
                  fontSize: '0.8125rem',
                  color: '#666',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  margin: 0,
                }}>
                  {chat.ultimo_mensaje || 'Sin mensajes aún'}
                </p>
              </div>
              {chat.no_leidos > 0 && (
                <span
                  style={{
                    background: '#1a1a2e',
                    color: '#fff',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {chat.no_leidos}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
