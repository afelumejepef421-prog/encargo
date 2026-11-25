/**
 * Encargo · App.jsx
 * Enrutador principal con gestión de autenticación Firebase.
 * Roles simplificados: USUARIO y ADMIN.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import api from './api';

import Acceso from './pages/Acceso';
import Registro from './pages/Registro';
import Panel from './pages/Panel';
import NuevaSolicitud from './pages/NuevaSolicitud';
import DetalleSolicitud from './pages/DetalleSolicitud';
import ChatList from './pages/ChatList';
import Chat from './pages/Chat';
import MiPerfil from './pages/MiPerfil';
import PerfilPublico from './pages/PerfilPublico';
import AdminPanel from './pages/AdminPanel';
import Calificaciones from './pages/Calificaciones';
import Reporte from './pages/Reporte';
import Billetera from './pages/Billetera';
import { firestoreService, verificarSuspensionActiva, formatearCOP } from './firestoreService';

function RutaProtegida({ usuario, perfil, children, soloAdmin = false }) {
  if (!usuario) return <Navigate to="/acceso" replace />;
  if (soloAdmin && perfil?.rol !== 'ADMIN') return <Navigate to="/panel" replace />;
  return children;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMsg: error?.message || 'Error inesperado en la vista.' };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturó error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="contenedor" style={{ maxWidth: '520px', textAlign: 'center', marginTop: '40px' }}>
          <h2>Algo salió mal</h2>
          <p style={{ color: '#666', margin: '12px 0 20px' }}>{this.state.errorMsg}</p>
          <button
            type="button"
            className="btn-principal"
            onClick={() => {
              this.setState({ hasError: false, errorMsg: '' });
              window.location.href = '/panel';
            }}
          >
            Volver al panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const navigate = useNavigate();

  const cargarPerfil = useCallback(async () => {
    try {
      const data = await api.get('/perfil');
      setPerfil(data);
    } catch (err) {
      console.error('Error cargando perfil:', err);
      setPerfil(null);
    }
  }, []);

  useEffect(() => {
    let unsubPerfil = () => {};
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubPerfil();
      setUsuario(firebaseUser);
      if (firebaseUser) {
        try {
          const data = await api.get('/perfil');
          setPerfil(data);
        } catch (err) {
          console.error('Error cargando perfil:', err);
          setPerfil({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nombre: firebaseUser.displayName || 'Usuario',
            rol: 'USUARIO',
          });
        }
        // Escucha en tiempo real de saldo, strikes y suspensiones
        unsubPerfil = firestoreService.suscribirPerfil(firebaseUser.uid, (live) => {
          if (live) setPerfil(live);
        });
      } else {
        setPerfil(null);
      }
      setCargandoAuth(false);
    });
    return () => {
      unsubPerfil();
      unsubscribe();
    };
  }, []);

  const cerrarSesion = async () => {
    try {
      await signOut(auth);
      setPerfil(null);
      navigate('/acceso');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  if (cargandoAuth) {
    return <div className="cargando-app">Cargando Encargo…</div>;
  }

  const esAdmin = perfil?.rol === 'ADMIN';
  const susp = verificarSuspensionActiva(perfil);

  return (
    <div className="app">
      {usuario && perfil && (
        <header className="cabecera">
          <div className="cabecera-contenido">
            <Link to="/panel" className="logo">Encargo</Link>
            <nav className="nav-principal">
              <Link to="/panel">Panel</Link>
              {!susp.suspendida && <Link to="/solicitudes/nueva">Nueva solicitud</Link>}
              <Link to="/chat">Chat</Link>
              <Link to="/billetera">
                Billetera ({formatearCOP(perfil.walletBalance ?? 200000)})
              </Link>
              {esAdmin && (
                <>
                  <Link to="/admin">Usuarios</Link>
                  <Link to="/admin/reportes">Reportes</Link>
                </>
              )}
              <Link to="/perfil">Mi perfil</Link>
              <span className="usuario-info">
                {perfil.nombre} ({perfil.rol})
              </span>
              <button onClick={cerrarSesion} className="btn-salir btn-sm">
                Salir
              </button>
            </nav>
          </div>
        </header>
      )}

      <main className="contenido-principal">
        {usuario && perfil && susp.suspendida && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #ef4444',
            color: '#991b1b',
            padding: '14px 18px',
            borderRadius: '8px',
            marginBottom: '20px',
          }}>
            <strong>⛔ Cuenta suspendida temporalmente (7 días)</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
              Motivo: {susp.motivo}. Reactivación programada: <strong>{new Date(susp.hasta).toLocaleString('es-CO')}</strong>.
              Mientras la suspensión esté vigente no podrás crear ni aceptar nuevas solicitudes. Puedes revisar tu historial en{' '}
              <Link to="/billetera" style={{ color: '#991b1b', fontWeight: 700 }}>Billetera</Link>.
            </p>
          </div>
        )}
        <ErrorBoundary>
          <Routes>
          {/* Rutas públicas */}
          <Route
            path="/acceso"
            element={usuario ? <Navigate to="/panel" replace /> : <Acceso />}
          />
          <Route
            path="/registro"
            element={usuario ? <Navigate to="/panel" replace /> : <Registro />}
          />

          {/* Rutas autenticadas */}
          <Route
            path="/panel"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil}>
                <Panel perfil={perfil} />
              </RutaProtegida>
            }
          />
          <Route
            path="/solicitudes/nueva"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil}>
                <NuevaSolicitud />
              </RutaProtegida>
            }
          />
          <Route
            path="/solicitudes/:id"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil}>
                <DetalleSolicitud perfil={perfil} />
              </RutaProtegida>
            }
          />
          <Route
            path="/chat"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil}>
                <ChatList perfil={perfil} usuario={usuario} />
              </RutaProtegida>
            }
          />
          <Route
            path="/chat/:id"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil}>
                <Chat perfil={perfil} />
              </RutaProtegida>
            }
          />
          <Route
            path="/perfil"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil}>
                <MiPerfil perfil={perfil} onPerfilActualizado={cargarPerfil} />
              </RutaProtegida>
            }
          />
          <Route
            path="/usuarios/:uid"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil}>
                <PerfilPublico perfil={perfil} />
              </RutaProtegida>
            }
          />
          <Route
            path="/calificaciones/:uid"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil}>
                <Calificaciones perfil={perfil} />
              </RutaProtegida>
            }
          />
          <Route
            path="/reporte"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil}>
                <Reporte />
              </RutaProtegida>
            }
          />
          <Route
            path="/billetera"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil}>
                <Billetera perfil={perfil} />
              </RutaProtegida>
            }
          />

          {/* Rutas admin */}
          <Route
            path="/admin"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil} soloAdmin>
                <AdminPanel tab="usuarios" perfil={perfil} />
              </RutaProtegida>
            }
          />
          <Route
            path="/admin/reportes"
            element={
              <RutaProtegida usuario={usuario} perfil={perfil} soloAdmin>
                <AdminPanel tab="reportes" perfil={perfil} />
              </RutaProtegida>
            }
          />

          {/* Redirección por defecto */}
          <Route path="/" element={<Navigate to={usuario ? '/panel' : '/acceso'} replace />} />
          <Route path="*" element={<Navigate to={usuario ? '/panel' : '/acceso'} replace />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <footer className="pie">
        © {new Date().getFullYear()} Encargo — Plataforma de servicios
      </footer>
    </div>
  );
}
