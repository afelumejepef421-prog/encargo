/**
 * Encargo · api.js
 * Adaptador unificado para Firebase Hosting (serverless) y desarrollo local.
 * En producción (Firebase Hosting *.web.app / *.firebaseapp.com), opera
 * directamente contra Cloud Firestore y Firebase Storage sin peticiones HTTP falsas.
 */
import { auth } from './firebase';
import { firestoreService } from './firestoreService';

const API_BASE = '/api';

function esEntornoCloudSoloFirebase() {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return (
    import.meta.env.PROD ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com')
  );
}

async function getAuthToken() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export async function apiFetch(endpoint, options = {}) {
  // En Firebase Hosting (producción), operar directamente contra Firestore/Storage
  if (esEntornoCloudSoloFirebase()) {
    return await ejecutarEnFirestore(endpoint, options);
  }

  // En entorno de desarrollo local, intentar backend local con timeout corto
  const url = `${API_BASE}${endpoint}`;
  const headers = { ...options.headers };

  const token = await getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let fetchBody = options.body;
  if (fetchBody && !(fetchBody instanceof FormData) && typeof fetchBody !== 'string') {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(fetchBody);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(url, {
      ...options,
      body: fetchBody,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.status === 204) return null;

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
    }
  } catch {
    // Si el backend local no está encendido, usar Firestore directamente sin expulsar al usuario
  }

  return await ejecutarEnFirestore(endpoint, options);
}

async function ejecutarEnFirestore(endpoint, options) {
  const user = auth.currentUser;
  const method = (options.method || 'GET').toUpperCase();
  const [ruta, queryStr] = endpoint.split('?');
  const qs = new URLSearchParams(queryStr || '');

  let body = {};
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body) {
    body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
  }

  // ── Perfil propio ─────────────────────────────────────
  if (ruta === '/perfil' && method === 'GET') {
    if (!user) return null;
    const p = await firestoreService.getPerfil(user.uid);
    return (
      p || {
        uid: user.uid,
        email: user.email,
        nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
        rol: 'USUARIO',
        role: 'USUARIO',
      }
    );
  }

  if (ruta === '/perfil' && method === 'PATCH') {
    if (!user) throw new Error('Sesión no iniciada.');
    return await firestoreService.actualizarPerfil(user.uid, body);
  }

  if (ruta === '/perfil' && method === 'POST' && body instanceof FormData) {
    if (!user) throw new Error('Sesión no iniciada.');
    const campos = {
      nombre: body.get('nombre'),
      apellidos: body.get('apellidos'),
      municipio: body.get('municipio'),
      bio: body.get('bio'),
    };
    await firestoreService.actualizarPerfil(user.uid, campos);
    const foto = body.get('foto');
    if (foto && foto instanceof File) {
      try {
        await firestoreService.subirFotoPerfil(user.uid, foto);
      } catch (e) {
        console.warn('Storage no disponible para foto de perfil:', e);
      }
    }
    return await firestoreService.getPerfil(user.uid);
  }

  // ── Registro de cuenta ────────────────────────────────
  if (ruta === '/cuentas' && method === 'POST') {
    if (!user) throw new Error('Sesión no iniciada.');
    const esAdminInicial =
      (user.email || '').toLowerCase() === 'admin@encargo.com' ||
      (user.email || '').toLowerCase().includes('admin');
    const rolAsignado = esAdminInicial ? 'ADMIN' : body.role || body.rol || 'USUARIO';
    return await firestoreService.setPerfil(user.uid, {
      uid: user.uid,
      email: user.email,
      nombre: body.nombre,
      apellidos: body.apellidos,
      displayName: `${body.nombre || ''} ${body.apellidos || ''}`.trim(),
      municipio: body.municipio,
      bio: body.bio || '',
      role: rolAsignado,
      rol: rolAsignado,
      banned: false,
    });
  }

  // ── Perfiles públicos y calificaciones de usuario ─────
  if (ruta.startsWith('/usuarios/') && method === 'GET') {
    const partes = ruta.split('/');
    const targetUid = partes[2];
    if (partes[3] === 'calificaciones') {
      return await firestoreService.obtenerCalificaciones(targetUid);
    }
    return await firestoreService.getPerfilPublico(targetUid);
  }

  // ── Solicitudes ───────────────────────────────────────
  if (ruta.startsWith('/solicitudes') && method === 'GET') {
    const partes = ruta.split('/');
    if (partes.length === 3 && partes[2]) {
      return await firestoreService.getSolicitud(partes[2]);
    }
    return await firestoreService.listarSolicitudes({
      categoria: qs.get('categoria') || null,
      municipio: qs.get('municipio') || null,
    });
  }

  if (ruta === '/solicitudes' && method === 'POST') {
    return await firestoreService.crearSolicitud(body, user);
  }

  if (ruta.includes('/imagenes') && method === 'POST' && body instanceof FormData) {
    const solId = ruta.split('/')[2];
    const archivos = body.getAll('archivos').filter((f) => f instanceof File);
    if (archivos.length > 0) {
      return await firestoreService.subirImagenesSolicitud(solId, archivos);
    }
    return { urls: [] };
  }

  if (
    (ruta.includes('/cancelar') && method === 'POST') ||
    (ruta.startsWith('/solicitudes/') && method === 'PATCH')
  ) {
    const id = ruta.split('/')[2];
    return await firestoreService.cancelarSolicitud(id);
  }

  if (ruta.startsWith('/solicitudes/') && method === 'DELETE') {
    const id = ruta.split('/')[2];
    return await firestoreService.eliminarSolicitud(id);
  }

  // ── Chats ─────────────────────────────────────────────
  if (ruta === '/chats' && method === 'GET') {
    return await firestoreService.listarMisChats(user?.uid);
  }

  if (ruta === '/chats' && method === 'POST') {
    return await firestoreService.obtenerOCrearChat(
      user.uid,
      body.destinatario_uid || body.destinatarioId
    );
  }

  if (ruta.includes('/mensajes') && method === 'POST') {
    const chatId = ruta.split('/')[2];
    const chatDoc = await firestoreService.obtenerChatPorId(chatId, user.uid);
    const receptorId = (chatDoc?.participantes || []).find((p) => p !== user.uid) || '';
    return await firestoreService.enviarMensaje(
      chatId,
      body.contenido || body.texto,
      user,
      receptorId
    );
  }

  if (ruta.startsWith('/chats/') && method === 'GET') {
    const chatId = ruta.split('/')[2];
    const chat = await firestoreService.obtenerChatPorId(chatId, user.uid);
    const mensajes = await firestoreService.listarMensajes(chatId);
    return { info: chat, mensajes };
  }

  // ── Calificaciones ────────────────────────────────────
  if (ruta === '/calificaciones' && method === 'POST') {
    return await firestoreService.calificar(body, user);
  }

  if (ruta === '/calificaciones/recibidas' && method === 'GET') {
    return await firestoreService.obtenerCalificaciones(user?.uid);
  }

  if (ruta.startsWith('/calificaciones/usuario/') && method === 'GET') {
    const uidTarget = ruta.split('/')[3];
    return await firestoreService.obtenerCalificaciones(uidTarget);
  }

  // ── Reportes ──────────────────────────────────────────
  if (ruta === '/reportes' && method === 'POST') {
    return await firestoreService.crearReporte(body, user);
  }

  // ── Administración ────────────────────────────────────
  if (ruta === '/admin/usuarios' && method === 'GET') {
    return await firestoreService.listarUsuarios();
  }

  if (ruta === '/admin/reportes' && method === 'GET') {
    return await firestoreService.listarReportes(qs.get('estado') || null);
  }

  if (ruta.includes('/resolver') && method === 'POST') {
    const reporteId = ruta.split('/')[3];
    return await firestoreService.resolverReporte(reporteId, body, user?.uid);
  }

  if (ruta.includes('/promover') && method === 'POST') {
    const targetUid = ruta.split('/')[3];
    return await firestoreService.promoverAdmin(targetUid);
  }

  if (ruta.includes('/revocar') && method === 'POST') {
    const targetUid = ruta.split('/')[3];
    return await firestoreService.revocarAdmin(targetUid);
  }

  if (ruta.includes('/banear') && method === 'POST') {
    const targetUid = ruta.split('/')[3];
    return await firestoreService.banearUsuario(targetUid, body.motivo);
  }

  if (ruta.includes('/desbanear') && method === 'POST') {
    const targetUid = ruta.split('/')[3];
    return await firestoreService.desbanearUsuario(targetUid);
  }

  return {};
}

export const api = {
  get: (endpoint, params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    ).toString();
    return apiFetch(query ? `${endpoint}?${query}` : endpoint);
  },
  post: (endpoint, body) => apiFetch(endpoint, { method: 'POST', body }),
  patch: (endpoint, body) => apiFetch(endpoint, { method: 'PATCH', body }),
  delete: (endpoint) => apiFetch(endpoint, { method: 'DELETE' }),
  upload: (endpoint, formData) => apiFetch(endpoint, { method: 'POST', body: formData }),
};

export default api;
