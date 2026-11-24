import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import Estado from '../components/Estado';
import Dialogo from '../components/Dialogo';

export default function AdminPanel({ tab = 'usuarios', perfil = null }) {
  const [tabActiva, setTabActiva] = useState(tab);
  const navigate = useNavigate();

  // Estado Usuarios
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [errorUsuarios, setErrorUsuarios] = useState('');

  // Estado Reportes
  const [reportes, setReportes] = useState([]);
  const [cargandoReportes, setCargandoReportes] = useState(false);
  const [errorReportes, setErrorReportes] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('ABIERTO');

  // Modal de resolución de reporte
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);
  const [accionResolucion, setAccionResolucion] = useState('CERRAR');
  const [motivoResolucion, setMotivoResolucion] = useState('');
  const [procesandoAccion, setProcesandoAccion] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');

  useEffect(() => {
    setTabActiva(tab);
  }, [tab]);

  useEffect(() => {
    if (tabActiva === 'usuarios') {
      cargarUsuarios();
    } else {
      cargarReportes();
    }
  }, [tabActiva, filtroEstado]);

  const cargarUsuarios = async () => {
    setCargandoUsuarios(true);
    setErrorUsuarios('');
    try {
      const data = await api.get('/admin/usuarios');
      setUsuarios(Array.isArray(data) ? data : data.usuarios || []);
    } catch (err) {
      setErrorUsuarios(err.message || 'Error al cargar usuarios');
    } finally {
      setCargandoUsuarios(false);
    }
  };

  const cargarReportes = async () => {
    setCargandoReportes(true);
    setErrorReportes('');
    try {
      const params = filtroEstado ? { estado: filtroEstado } : {};
      const data = await api.get('/admin/reportes', params);
      setReportes(Array.isArray(data) ? data : data.reportes || []);
    } catch (err) {
      setErrorReportes(err.message || 'Error al cargar reportes');
    } finally {
      setCargandoReportes(false);
    }
  };

  // Promover a Admin
  const handlePromover = async (uid, nombre) => {
    if (!window.confirm(`¿Estás seguro de otorgar rol de Administrador a ${nombre}? Esta acción confiere privilegios totales de moderación.`)) {
      return;
    }
    try {
      await api.post(`/admin/usuarios/${uid}/promover`);
      setMensajeExito(`El usuario ${nombre} ahora es Administrador.`);
      cargarUsuarios();
    } catch (err) {
      alert(err.message || 'Error al promover usuario');
    }
  };

  // Revocar rol Admin
  const handleRevocar = async (uid, nombre) => {
    if (!window.confirm(`¿Deseas revocar los permisos de Administrador a ${nombre} y regresarlo a USUARIO estándar?`)) {
      return;
    }
    try {
      await api.post(`/admin/usuarios/${uid}/revocar`);
      setMensajeExito(`Se revocó el rol de Administrador a ${nombre}.`);
      cargarUsuarios();
    } catch (err) {
      alert(err.message || 'Error al revocar rol de administrador');
    }
  };

  // Banear usuario
  const handleBanear = async (uid, nombre) => {
    const motivo = window.prompt(`Ingresa el motivo del baneo para ${nombre}:`);
    if (!motivo || !motivo.trim()) return;

    try {
      await api.post(`/admin/usuarios/${uid}/banear`, { motivo: motivo.trim() });
      setMensajeExito(`Usuario ${nombre} ha sido baneado.`);
      cargarUsuarios();
    } catch (err) {
      alert(err.message || 'Error al banear usuario');
    }
  };

  // Desbanear usuario
  const handleDesbanear = async (uid, nombre) => {
    if (!window.confirm(`¿Deseas reactivar la cuenta de ${nombre}?`)) return;
    try {
      await api.post(`/admin/usuarios/${uid}/desbanear`);
      setMensajeExito(`Usuario ${nombre} ha sido reactivado.`);
      cargarUsuarios();
    } catch (err) {
      alert(err.message || 'Error al desbanear usuario');
    }
  };

  // Resolver reporte
  const handleResolverReporte = async (e) => {
    e.preventDefault();
    if (!reporteSeleccionado) return;
    setProcesandoAccion(true);
    try {
      await api.post(`/admin/reportes/${reporteSeleccionado.id}/resolver`, {
        accion: accionResolucion,
        resolucion: motivoResolucion || 'Reporte atendido por administración',
      });
      setReporteSeleccionado(null);
      setMotivoResolucion('');
      setMensajeExito('Reporte resuelto exitosamente.');
      cargarReportes();
    } catch (err) {
      alert(err.message || 'Error al resolver el reporte');
    } finally {
      setProcesandoAccion(false);
    }
  };

  return (
    <div className="admin-panel-pagina" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1>🛡️ Panel de Control del Administrador</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Gestión global de usuarios registrados, moderación de solicitudes y resolución de reportes.
      </p>

      {mensajeExito && (
        <div style={{ marginBottom: '16px' }}>
          <Estado tipo="exito" mensaje={mensajeExito} />
        </div>
      )}

      {/* Navegación por pestañas */}
      <div className="pestanas-filtro" style={{ marginBottom: '24px' }}>
        <button
          type="button"
          className={`pestana-btn ${tabActiva === 'usuarios' ? 'pestana-activa' : ''}`}
          onClick={() => {
            setTabActiva('usuarios');
            navigate('/admin');
          }}
        >
          👥 Gestión de Usuarios
        </button>
        <button
          type="button"
          className={`pestana-btn ${tabActiva === 'reportes' ? 'pestana-activa' : ''}`}
          onClick={() => {
            setTabActiva('reportes');
            navigate('/admin/reportes');
          }}
        >
          🚩 Reportes y Moderación
        </button>
      </div>

      {/* PESTAÑA 1: GESTIÓN DE USUARIOS */}
      {tabActiva === 'usuarios' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2>Usuarios Registrados ({usuarios.length})</h2>
            <button type="button" className="btn-secundario btn-sm" onClick={cargarUsuarios}>
              🔄 Actualizar lista
            </button>
          </div>

          {errorUsuarios && <Estado tipo="error" mensaje={errorUsuarios} />}

          {cargandoUsuarios ? (
            <Estado tipo="cargando" mensaje="Cargando lista de usuarios..." />
          ) : usuarios.length === 0 ? (
            <Estado tipo="vacio" mensaje="No hay usuarios registrados aún." />
          ) : (
            <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #d9d9d9' }}>
              <table className="tabla-reportes" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Municipio</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const uidUsuario = u.uid || u.id;
                    const nombreCompleto = `${u.displayName || u.nombre || 'Sin nombre'} ${u.apellidos || ''}`.trim();
                    const esAdmin = (u.role || u.rol) === 'ADMIN';
                    const baneado = u.banned === true;
                    const esCuentaPrincipal = (u.email || '').toLowerCase() === 'admin@encargo.com';
                    const esYoMismo = perfil?.uid && uidUsuario === perfil.uid;

                    return (
                      <tr key={uidUsuario}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {u.photoURL || u.foto_url ? (
                              <img
                                src={u.photoURL || u.foto_url}
                                alt={nombreCompleto}
                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              <span style={{ fontSize: '1.2rem' }}>👤</span>
                            )}
                            <div>
                              <Link
                                to={`/usuarios/${uidUsuario}`}
                                style={{ fontWeight: 600, color: '#1a1a2e', textDecoration: 'none' }}
                              >
                                {nombreCompleto}
                              </Link>
                              {u.bio && (
                                <div style={{ fontSize: '0.75rem', color: '#666', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {u.bio}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                        <td style={{ fontSize: '0.85rem' }}>{u.municipio || '—'}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: esAdmin ? '#1a1a2e' : '#eaf2f8',
                              color: esAdmin ? '#fff' : '#2980b9',
                            }}
                          >
                            {esAdmin ? 'ADMIN' : 'USUARIO'}
                          </span>
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: baneado ? '#fadbd8' : '#d4efdf',
                              color: baneado ? '#922b21' : '#1e8449',
                            }}
                          >
                            {baneado ? 'BANEADO' : 'ACTIVO'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {esCuentaPrincipal || esYoMismo ? (
                              <span
                                className="badge"
                                style={{ backgroundColor: '#fef9e7', color: '#9a7d0a', border: '1px solid #f7dc6f' }}
                                title="Cuenta protegida contra auto-revocación o baneo"
                              >
                                🔒 {esCuentaPrincipal ? 'Admin Principal' : 'Tu sesión'}
                              </span>
                            ) : (
                              <>
                                {/* Botón para otorgar o revocar rol de Administrador */}
                                {esAdmin ? (
                                  <button
                                    type="button"
                                    className="btn-secundario btn-sm"
                                    onClick={() => handleRevocar(uidUsuario, nombreCompleto)}
                                    style={{ color: '#b9770e', borderColor: '#f39c12' }}
                                    title="Revocar permisos de Administrador"
                                  >
                                    ⬇️ Revocar Admin
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-secundario btn-sm"
                                    onClick={() => handlePromover(uidUsuario, nombreCompleto)}
                                    title="Otorgar permisos de Administrador"
                                  >
                                    👑 Hacer Admin
                                  </button>
                                )}

                                {/* Banear / Desbanear */}
                                {baneado ? (
                                  <button
                                    type="button"
                                    className="btn-secundario btn-sm"
                                    onClick={() => handleDesbanear(uidUsuario, nombreCompleto)}
                                    style={{ color: '#1e8449', borderColor: '#27ae60' }}
                                  >
                                    Desbanear
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-peligro btn-sm"
                                    onClick={() => handleBanear(uidUsuario, nombreCompleto)}
                                  >
                                    Banear
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: REPORTES Y MODERACIÓN */}
      {tabActiva === 'reportes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h2>Bandeja de Reportes</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label htmlFor="filtro-rep" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filtrar:</label>
              <select
                id="filtro-rep"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">Todos los estados</option>
                <option value="ABIERTO">Abiertos</option>
                <option value="RESUELTO">Resueltos</option>
              </select>
              <button type="button" className="btn-secundario btn-sm" onClick={cargarReportes}>
                🔄
              </button>
            </div>
          </div>

          {errorReportes && <Estado tipo="error" mensaje={errorReportes} />}

          {cargandoReportes ? (
            <Estado tipo="cargando" mensaje="Cargando reportes..." />
          ) : reportes.length === 0 ? (
            <Estado tipo="vacio" mensaje="No hay reportes pendientes en este estado." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {reportes.map((rep) => {
                const esAbierto = rep.estado === 'ABIERTO';
                return (
                  <div key={rep.id} className="tarjeta" style={{ borderLeft: esAbierto ? '4px solid #c0392b' : '4px solid #27ae60' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: esAbierto ? '#fadbd8' : '#d4efdf',
                              color: esAbierto ? '#922b21' : '#1e8449',
                            }}
                          >
                            {rep.estado}
                          </span>
                          <span className="badge" style={{ backgroundColor: '#f0f0f0', color: '#555' }}>
                            Tipo: {rep.tipo || 'SOLICITUD'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#888' }}>
                            ID: {rep.id}
                          </span>
                        </div>
                        <h3 style={{ margin: '4px 0', fontSize: '1.1rem', color: '#c0392b' }}>
                          Motivo: {rep.motivo}
                        </h3>
                      </div>

                      {esAbierto && (
                        <button
                          type="button"
                          className="btn-principal btn-sm"
                          onClick={() => {
                            setReporteSeleccionado(rep);
                            setAccionResolucion('CERRAR');
                            setMotivoResolucion('');
                          }}
                        >
                          Atender Reporte
                        </button>
                      )}
                    </div>

                    {rep.descripcion && (
                      <p style={{ margin: '8px 0', fontSize: '0.9rem', color: '#333', background: '#fafafa', padding: '8px 12px', borderRadius: '4px' }}>
                        {rep.descripcion}
                      </p>
                    )}

                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span>Reportado por: <strong>{rep.reportadoPorNombre || rep.reportado_por_nombre || 'Usuario'}</strong></span>
                      {rep.objetivoId && <span>Objetivo ID: <code>{rep.objetivoId}</code></span>}
                    </div>

                    {rep.resolucion && (
                      <div style={{ marginTop: '10px', padding: '8px 12px', background: '#eafaf1', borderRadius: '4px', border: '1px solid #a9dfbf' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#196f3d' }}>Resolución emitida:</strong>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#145a32' }}>
                          {rep.resolucion} (Acción: {rep.accion || 'CERRADO'})
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal para Atender Reporte */}
      <Dialogo
        abierto={Boolean(reporteSeleccionado)}
        titulo="Atender y Resolver Reporte"
        onCerrar={() => setReporteSeleccionado(null)}
      >
        {reporteSeleccionado && (
          <form onSubmit={handleResolverReporte}>
            <div style={{ marginBottom: '14px' }}>
              <strong>Motivo reportado:</strong>
              <div style={{ color: '#c0392b', marginTop: '4px' }}>{reporteSeleccionado.motivo}</div>
              {reporteSeleccionado.descripcion && (
                <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '4px' }}>
                  {reporteSeleccionado.descripcion}
                </div>
              )}
            </div>

            <div className="form-grupo">
              <label htmlFor="accion-admin">Acción de Moderación</label>
              <select
                id="accion-admin"
                value={accionResolucion}
                onChange={(e) => setAccionResolucion(e.target.value)}
              >
                <option value="CERRAR">Cerrar reporte sin acción sancionatoria</option>
                <option value="ELIMINAR_SOLICITUD">Eliminar solicitud reportada</option>
                <option value="BAN_USUARIO">Banear al usuario reportado</option>
              </select>
            </div>

            <div className="form-grupo">
              <label htmlFor="motivo-admin">Dictamen o Justificación</label>
              <textarea
                id="motivo-admin"
                value={motivoResolucion}
                onChange={(e) => setMotivoResolucion(e.target.value)}
                placeholder="Explica la decisión tomada para el expediente..."
                required
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn-secundario btn-sm"
                onClick={() => setReporteSeleccionado(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-principal btn-sm"
                disabled={procesandoAccion}
              >
                {procesandoAccion ? 'Resolviendo...' : 'Confirmar Resolución'}
              </button>
            </div>
          </form>
        )}
      </Dialogo>
    </div>
  );
}
