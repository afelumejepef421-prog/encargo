/**
 * Encargo · firestoreService.js
 * Servicio directo contra Cloud Firestore y Firebase Storage con:
 * - Suscripciones en tiempo real (onSnapshot) con limpieza correcta (unsubscribe).
 * - Transacciones atómicas (runTransaction) para doble confirmación, custodia (escrow),
 *   comisión del 8%, liberación del 92%, penalizaciones ($5.000 / $10.000 COP) y suspensión 7 días.
 * - Normalización automática de Timestamps a ISO string.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebase';

export const SALDO_INICIAL_SIMULADO = 200000; // $200.000 COP iniciales para pruebas
export const COMISION_PLATAFORMA = 0.08; // 8 %
export const PENALIDAD_FALTA_1_2 = 5000; // $5.000 COP
export const PENALIDAD_FALTA_3_MAS = 10000; // $10.000 COP
export const DIAS_SUSPENSION = 7;

function normalizarValor(val) {
  if (val == null) return val;
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {
      return '';
    }
  }
  if (Array.isArray(val)) {
    return val.map(normalizarValor);
  }
  if (typeof val === 'object' && val.constructor === Object) {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = normalizarValor(v);
    }
    return out;
  }
  return val;
}

function normalizarDoc(id, data) {
  if (!data) return null;
  return { id, ...normalizarValor(data) };
}

export function verificarSuspensionActiva(perfil) {
  if (!perfil?.suspendedUntil) return { suspendida: false };
  const hastaMs = new Date(perfil.suspendedUntil).getTime();
  if (Number.isNaN(hastaMs)) return { suspendida: false };
  if (hastaMs > Date.now()) {
    return {
      suspendida: true,
      hasta: perfil.suspendedUntil,
      motivo: perfil.suspensionReason || 'Acumulación de 3 o más faltas por incumplimiento.',
    };
  }
  return { suspendida: false };
}

export function formatearCOP(valor) {
  const num = Number(valor || 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(num);
}

export const firestoreService = {
  // ── Perfiles ──────────────────────────────────────────
  async getPerfil(uid) {
    if (!uid) return null;
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const d = normalizarDoc(snap.id, snap.data());
    d.uid = d.uid || uid;
    d.rol = d.rol || d.role || 'USUARIO';
    d.role = d.role || d.rol || 'USUARIO';
    d.foto_url = d.foto_url || d.photoURL || '';
    d.nombre = d.nombre || d.displayName || 'Usuario';
    d.walletBalance = d.walletBalance ?? SALDO_INICIAL_SIMULADO;
    d.penaltyDebt = d.penaltyDebt ?? 0;
    d.strikes = d.strikes ?? d.offensesCount ?? 0;
    return d;
  },

  suscribirPerfil(uid, callback) {
    if (!uid) return () => {};
    return onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        const d = normalizarDoc(snap.id, snap.data());
        d.uid = d.uid || uid;
        d.rol = d.rol || d.role || 'USUARIO';
        d.role = d.role || d.rol || 'USUARIO';
        d.foto_url = d.foto_url || d.photoURL || '';
        d.nombre = d.nombre || d.displayName || 'Usuario';
        d.walletBalance = d.walletBalance ?? SALDO_INICIAL_SIMULADO;
        d.penaltyDebt = d.penaltyDebt ?? 0;
        d.strikes = d.strikes ?? d.offensesCount ?? 0;
        callback(d);
      },
      (err) => console.error('Error en suscribirPerfil:', err)
    );
  },

  async getPerfilPublico(uid) {
    if (!uid) return null;
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const d = normalizarDoc(snap.id, snap.data());
    const nombreMostrado =
      d.displayName || `${d.nombre || ''} ${d.apellidos || ''}`.trim() || 'Usuario';
    return {
      uid: d.uid || uid,
      id: d.uid || uid,
      displayName: nombreMostrado,
      nombre: d.nombre || nombreMostrado,
      apellidos: d.apellidos || '',
      photoURL: d.photoURL || '',
      foto_url: d.foto_url || d.photoURL || '',
      bio: d.bio || '',
      municipio: d.municipio || '',
      promedioCalificacion: d.promedioCalificacion || d.reputacion_promedio || 0,
      promedio: d.promedioCalificacion || d.reputacion_promedio || 0,
      totalCalificaciones: d.totalCalificaciones || d.total_calificaciones || 0,
      strikes: d.strikes ?? d.offensesCount ?? 0,
      rol: d.role || d.rol || 'USUARIO',
      role: d.role || d.rol || 'USUARIO',
    };
  },

  async setPerfil(uid, data) {
    const ref = doc(db, 'users', uid);
    await setDoc(
      ref,
      {
        walletBalance: SALDO_INICIAL_SIMULADO,
        penaltyDebt: 0,
        strikes: 0,
        offensesCount: 0,
        suspendedUntil: null,
        ...data,
        actualizado_en: serverTimestamp(),
      },
      { merge: true }
    );
    return await this.getPerfil(uid);
  },

  async actualizarPerfil(uid, data) {
    const ref = doc(db, 'users', uid);
    const campos = {};
    if (data.nombre !== undefined) campos.nombre = String(data.nombre).trim();
    if (data.apellidos !== undefined) campos.apellidos = String(data.apellidos).trim();
    if (data.municipio !== undefined) campos.municipio = String(data.municipio).trim();
    if (data.bio !== undefined) campos.bio = String(data.bio).trim();
    if (data.photoURL !== undefined) {
      campos.photoURL = data.photoURL;
      campos.foto_url = data.photoURL;
    }
    if (campos.nombre || campos.apellidos) {
      const actual = await this.getPerfil(uid);
      const nom = campos.nombre ?? actual?.nombre ?? '';
      const ape = campos.apellidos ?? actual?.apellidos ?? '';
      campos.displayName = `${nom} ${ape}`.trim();
    }
    campos.actualizado_en = serverTimestamp();
    await updateDoc(ref, campos);
    return await this.getPerfil(uid);
  },

  async subirFotoPerfil(uid, file) {
    const ext = file.name?.split('.').pop() || 'jpg';
    const ref = storageRef(storage, `perfiles/${uid}.${ext}`);
    await uploadBytes(ref, file, { contentType: file.type || 'image/jpeg' });
    const url = await getDownloadURL(ref);
    await this.actualizarPerfil(uid, { photoURL: url });
    return { url, photoURL: url };
  },

  // ── Solicitudes ───────────────────────────────────────
  async listarSolicitudes({ categoria = null, municipio = null } = {}) {
    const colRef = collection(db, 'solicitudes');
    const constraints = [];
    if (categoria) constraints.push(where('categoria', '==', categoria));
    if (municipio) constraints.push(where('municipio', '==', municipio));
    constraints.push(orderBy('creado_en', 'desc'));

    try {
      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((d) => normalizarDoc(d.id, d.data()));
    } catch {
      const snap = await getDocs(colRef);
      let docs = snap.docs.map((d) => normalizarDoc(d.id, d.data()));
      if (categoria) docs = docs.filter((d) => d.categoria === categoria);
      if (municipio) docs = docs.filter((d) => d.municipio === municipio);
      docs.sort((a, b) => String(b.creado_en || '').localeCompare(String(a.creado_en || '')));
      return docs;
    }
  },

  suscribirSolicitud(solicitudId, callback) {
    if (!solicitudId) return () => {};
    return onSnapshot(
      doc(db, 'solicitudes', solicitudId),
      (snap) => {
        callback(snap.exists() ? normalizarDoc(snap.id, snap.data()) : null);
      },
      (err) => console.error('Error en suscribirSolicitud:', err)
    );
  },

  async getSolicitud(id) {
    const snap = await getDoc(doc(db, 'solicitudes', id));
    if (!snap.exists()) return null;
    return normalizarDoc(snap.id, snap.data());
  },

  async crearSolicitud(data, usuario) {
    if (!usuario?.uid) {
      throw new Error('Debes iniciar sesión para publicar una solicitud.');
    }

    const perfil = await this.getPerfil(usuario.uid);
    const susp = verificarSuspensionActiva(perfil);
    if (susp.suspendida) {
      throw new Error(
        `Tu cuenta está suspendida hasta ${new Date(susp.hasta).toLocaleString('es-CO')}. Motivo: ${susp.motivo}`
      );
    }

    let autorNombre = usuario.displayName || '';
    let autorFoto = usuario.photoURL || '';
    let autorMunicipio = data.municipio || '';
    let autorEmail = usuario.email || '';

    if (perfil) {
      autorNombre =
        perfil.displayName ||
        `${perfil.nombre || ''} ${perfil.apellidos || ''}`.trim() ||
        autorNombre;
      autorFoto = perfil.photoURL || perfil.foto_url || autorFoto;
      autorMunicipio = perfil.municipio || autorMunicipio;
      autorEmail = perfil.email || autorEmail;
    }
    if (!autorNombre) {
      autorNombre = autorEmail ? autorEmail.split('@')[0] : 'Usuario';
    }

    const colRef = collection(db, 'solicitudes');
    const ahoraIso = new Date().toISOString();
    const docParaFirestore = {
      titulo: String(data.titulo || '').trim(),
      descripcion: String(data.descripcion || '').trim(),
      categoria: data.categoria,
      municipio: data.municipio,
      ...(data.fecha_deseada ? { fecha_deseada: data.fecha_deseada } : {}),
      autor_uid: usuario.uid,
      autor_email: autorEmail,
      autor_nombre: autorNombre,
      autor_foto: autorFoto,
      autor_municipio: autorMunicipio,
      estado: 'PUBLICADO',
      providerUid: null,
      providerNombre: null,
      chatId: null,
      agreedPrice: 0,
      agreedDateTime: '',
      escrowAmount: 0,
      escrowStatus: 'pendiente',
      imagenes: [],
      creado_en: serverTimestamp(),
      actualizado_en: serverTimestamp(),
    };

    const ref = await addDoc(colRef, docParaFirestore);
    return {
      ...docParaFirestore,
      id: ref.id,
      creado_en: ahoraIso,
      actualizado_en: ahoraIso,
    };
  },

  async subirImagenesSolicitud(solicitudId, files) {
    const urls = [];
    for (const file of files) {
      const ext = file.name?.split('.').pop() || 'jpg';
      const nombreUnico = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const ref = storageRef(storage, `solicitudes/${solicitudId}/${nombreUnico}`);
      await uploadBytes(ref, file, { contentType: file.type || 'image/jpeg' });
      const url = await getDownloadURL(ref);
      urls.push(url);
    }
    const solRef = doc(db, 'solicitudes', solicitudId);
    const snap = await getDoc(solRef);
    const prevImgs = snap.exists() ? snap.data().imagenes || [] : [];
    await updateDoc(solRef, {
      imagenes: [...prevImgs, ...urls],
      actualizado_en: serverTimestamp(),
    });
    return { urls };
  },

  async cancelarSolicitud(id) {
    const ref = doc(db, 'solicitudes', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Solicitud no encontrada.');
    const sol = snap.data();
    const estadoUpper = String(sol.estado || '').toUpperCase();
    if (estadoUpper === 'EN_PROGRESO' || estadoUpper === 'ACORDADA') {
      throw new Error(
        'Esta solicitud ya tiene un compromiso confirmado. Debes reportar el incumplimiento/cancelación unilateral en el detalle o chat.'
      );
    }
    await updateDoc(ref, {
      estado: 'CANCELADO',
      actualizado_en: serverTimestamp(),
    });
    const updated = await getDoc(ref);
    return normalizarDoc(updated.id, updated.data());
  },

  async eliminarSolicitud(id) {
    await deleteDoc(doc(db, 'solicitudes', id));
    return { mensaje: 'Solicitud eliminada' };
  },

  // ── Chats y Negociación de Acuerdos ───────────────────
  async obtenerOCrearChat(uidA, uidB, solicitud = null) {
    if (!uidA || !uidB) {
      throw new Error('Se requieren ambos participantes para iniciar el chat.');
    }

    const perfilActual = await this.getPerfil(uidA);
    const susp = verificarSuspensionActiva(perfilActual);
    if (susp.suspendida) {
      throw new Error(
        `Tu cuenta está suspendida hasta ${new Date(susp.hasta).toLocaleString('es-CO')}.`
      );
    }

    const uids = [uidA, uidB].sort();
    const chatId = solicitud?.id
      ? `${solicitud.id}_${uids[0]}_${uids[1]}`
      : `${uids[0]}_${uids[1]}`;

    const ref = doc(db, 'chats', chatId);
    let chatExiste = false;
    try {
      const snap = await getDoc(ref);
      chatExiste = snap.exists();
    } catch (err) {
      chatExiste = false;
    }

    if (!chatExiste) {
      if (solicitud?.id) {
        const estadoSol = String(solicitud.estado || 'PUBLICADO').toUpperCase();
        if (estadoSol !== 'PUBLICADO' && solicitud.providerUid !== uidA) {
          throw new Error('Esta solicitud ya fue acordada con otro prestador y no admite nuevas postulaciones.');
        }
      }

      const clientUid = solicitud?.autor_uid || uidB;
      const providerUid = solicitud?.autor_uid
        ? (solicitud.autor_uid === uidA ? uidB : uidA)
        : uidA;

      const data = {
        id: chatId,
        participantes: uids,
        solicitudId: solicitud?.id || null,
        solicitudTitulo: solicitud?.titulo || null,
        clientUid,
        providerUid,
        agreedPrice: 0,
        agreedDateTime: '',
        clientHasMessaged: false,
        providerHasMessaged: false,
        clientConfirmed: false,
        providerConfirmed: false,
        clientCompletedConfirmed: false,
        providerCompletedConfirmed: false,
        agreementStatus: solicitud?.id ? 'negociando' : 'directo',
        escrowAmount: 0,
        platformFee: 0,
        providerNet: 0,
        ultimo_mensaje: '',
        actualizado_en: serverTimestamp(),
        creado_en: serverTimestamp(),
      };
      await setDoc(ref, data);
    }
    return await this.obtenerChatPorId(chatId, uidA);
  },

  async enviarMensaje(chatId, texto, emisor, receptorId) {
    if (!chatId || !texto?.trim() || !emisor?.uid) {
      throw new Error('Datos incompletos para enviar el mensaje.');
    }

    const chatRef = doc(db, 'chats', chatId);
    const mensajesCol = collection(chatRef, 'mensajes');

    let chatData = {};
    try {
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        chatData = chatSnap.data();
      }
    } catch (err) {
      console.warn('No se pudo leer chat padre antes de enviar mensaje:', err);
    }

    // Resolver receptorId si no fue suministrado explícitamente
    let idDestino = receptorId || '';
    if (!idDestino && Array.isArray(chatData.participantes)) {
      idDestino = chatData.participantes.find((p) => p !== emisor.uid) || '';
    }
    if (!idDestino && chatId) {
      const partes = chatId.split('_');
      idDestino = partes.find((p) => p && p !== emisor.uid && !p.startsWith('sol-')) || '';
    }

    let receptorEmail = '';
    let receptorNombre = 'Usuario';
    if (idDestino) {
      try {
        const rSnap = await getDoc(doc(db, 'users', idDestino));
        if (rSnap.exists()) {
          const rd = rSnap.data();
          receptorEmail = rd.email || '';
          receptorNombre =
            rd.displayName || `${rd.nombre || ''} ${rd.apellidos || ''}`.trim() || 'Usuario';
        }
      } catch {}
    }

    let senderName = emisor.displayName || emisor.nombre || '';
    if (!senderName) {
      try {
        const sPerfil = await this.getPerfil(emisor.uid);
        senderName = sPerfil?.displayName || sPerfil?.nombre || '';
      } catch {}
    }
    senderName = senderName || emisor.email?.split('@')[0] || 'Usuario';

    const ahoraIso = new Date().toISOString();
    const msgData = {
      chatId,
      senderId: emisor.uid,
      receiverId: idDestino,
      senderEmail: emisor.email || '',
      receiverEmail: receptorEmail,
      senderName,
      receiverName: receptorNombre,
      content: texto.trim(),
      timestamp: serverTimestamp(),
      creado_en: serverTimestamp(),
      fechaIso: ahoraIso,
      remitenteId: emisor.uid,
      remitente_uid: emisor.uid,
      contenido: texto.trim(),
      texto: texto.trim(),
    };

    const ref = await addDoc(mensajesCol, msgData);

    // Actualizar resumen en el documento del chat padre sin bloquear si falla
    try {
      const chatUpdate = {
        ultimo_mensaje: texto.trim().slice(0, 120),
        ultimoMensaje: texto.trim().slice(0, 120),
        actualizado_en: serverTimestamp(),
      };
      if (chatData.clientUid === emisor.uid) {
        chatUpdate.clientHasMessaged = true;
      } else if (chatData.providerUid === emisor.uid) {
        chatUpdate.providerHasMessaged = true;
      }
      await updateDoc(chatRef, chatUpdate);
    } catch (eUp) {
      console.warn('Aviso: no se pudo actualizar el resumen del chat padre:', eUp);
    }

    return { ...msgData, id: ref.id, timestamp: ahoraIso };
  },

  suscribirChat(chatId, uidActual, callback) {
    if (!chatId) return () => {};
    return onSnapshot(
      doc(db, 'chats', chatId),
      async (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        const chat = normalizarDoc(snap.id, snap.data());
        const otroUid = (chat.participantes || []).find((p) => p !== uidActual) || '';
        if (otroUid) {
          try {
            const otroSnap = await getDoc(doc(db, 'users', otroUid));
            if (otroSnap.exists()) {
              const d = otroSnap.data();
              chat.otro_uid = otroUid;
              chat.otro_nombre =
                d.displayName || `${d.nombre || ''} ${d.apellidos || ''}`.trim() || 'Usuario';
              chat.otro_foto = d.photoURL || d.foto_url || '';
              chat.otro_bio = d.bio || '';
            }
          } catch {}
        }
        callback(chat);
      },
      (err) => console.error('Error en suscribirChat:', err)
    );
  },

  suscribirMensajes(chatId, callback) {
    if (!chatId) return () => {};
    const mensajesCol = collection(db, 'chats', chatId, 'mensajes');
    return onSnapshot(
      mensajesCol,
      (snap) => {
        const lista = snap.docs
          .map((d) => normalizarDoc(d.id, d.data()))
          .filter(Boolean);
        lista.sort((a, b) => {
          const tA = new Date(a.timestamp || a.creado_en || a.fechaIso || 0).getTime() || 0;
          const tB = new Date(b.timestamp || b.creado_en || b.fechaIso || 0).getTime() || 0;
          return tA - tB;
        });
        callback(lista);
      },
      async (err) => {
        console.warn('Aviso onSnapshot mensajes:', err);
        try {
          const snap = await getDocs(mensajesCol);
          const list = snap.docs
            .map((d) => normalizarDoc(d.id, d.data()))
            .filter(Boolean);
          list.sort((a, b) => {
            const tA = new Date(a.timestamp || a.creado_en || a.fechaIso || 0).getTime() || 0;
            const tB = new Date(b.timestamp || b.creado_en || b.fechaIso || 0).getTime() || 0;
            return tA - tB;
          });
          callback(list);
        } catch (e2) {
          console.error('Error cargando mensajes de respaldo:', e2);
        }
      }
    );
  },

  async listarMensajes(chatId) {
    const mensajesCol = collection(db, 'chats', chatId, 'mensajes');
    try {
      const snap = await getDocs(mensajesCol);
      const list = snap.docs
        .map((d) => normalizarDoc(d.id, d.data()))
        .filter(Boolean);
      list.sort((a, b) => {
        const tA = new Date(a.timestamp || a.creado_en || a.fechaIso || 0).getTime() || 0;
        const tB = new Date(b.timestamp || b.creado_en || b.fechaIso || 0).getTime() || 0;
        return tA - tB;
      });
      return list;
    } catch {
      return [];
    }
  },

  async obtenerChatPorId(chatId, uidActual) {
    try {
      const snap = await getDoc(doc(db, 'chats', chatId));
      if (!snap.exists()) return null;
      const chat = normalizarDoc(snap.id, snap.data());
      const otroUid = (chat.participantes || []).find((p) => p !== uidActual) || '';
      if (otroUid) {
        try {
          const otroSnap = await getDoc(doc(db, 'users', otroUid));
          if (otroSnap.exists()) {
            const d = otroSnap.data();
            chat.otro_uid = otroUid;
            chat.otro_nombre =
              d.displayName || `${d.nombre || ''} ${d.apellidos || ''}`.trim() || 'Usuario';
            chat.otro_foto = d.photoURL || d.foto_url || '';
            chat.otro_bio = d.bio || '';
          }
        } catch {}
      }
      return chat;
    } catch (e) {
      console.warn('Error recuperando chat:', e);
      return { id: chatId, participantes: [uidActual] };
    }
  },

  async listarMisChats(uid) {
    if (!uid) return [];
    const colRef = collection(db, 'chats');
    const q = query(colRef, where('participantes', 'array-contains', uid));
    const snap = await getDocs(q);
    const chats = [];
    for (const d of snap.docs) {
      const chat = normalizarDoc(d.id, d.data());
      const otroUid = (chat.participantes || []).find((p) => p !== uid) || '';
      if (otroUid) {
        try {
          const otroSnap = await getDoc(doc(db, 'users', otroUid));
          if (otroSnap.exists()) {
            const uData = otroSnap.data();
            chat.otro_uid = otroUid;
            chat.otro_nombre =
              uData.displayName ||
              `${uData.nombre || ''} ${uData.apellidos || ''}`.trim() ||
              'Usuario';
            chat.otro_foto = uData.photoURL || uData.foto_url || '';
            chat.otro_bio = uData.bio || '';
          }
        } catch {}
      }
      chats.push(chat);
    }
    chats.sort((a, b) =>
      String(b.actualizado_en || '').localeCompare(String(a.actualizado_en || ''))
    );
    return chats;
  },

  suscribirMisChats(uid, callback) {
    if (!uid) {
      callback([]);
      return () => {};
    }
    const colRef = collection(db, 'chats');
    const q = query(colRef, where('participantes', 'array-contains', uid));
    return onSnapshot(
      q,
      async (snap) => {
        const chats = [];
        for (const d of snap.docs) {
          const chat = normalizarDoc(d.id, d.data());
          const otroUid = (chat.participantes || []).find((p) => p !== uid) || '';
          if (otroUid) {
            try {
              const otroSnap = await getDoc(doc(db, 'users', otroUid));
              if (otroSnap.exists()) {
                const uData = otroSnap.data();
                chat.otro_uid = otroUid;
                chat.otro_nombre =
                  uData.displayName ||
                  `${uData.nombre || ''} ${uData.apellidos || ''}`.trim() ||
                  'Usuario';
                chat.otro_foto = uData.photoURL || uData.foto_url || '';
                chat.otro_bio = uData.bio || '';
              }
            } catch {}
          }
          chats.push(chat);
        }
        chats.sort((a, b) =>
          String(b.actualizado_en || '').localeCompare(String(a.actualizado_en || ''))
        );
        callback(chats);
      },
      (err) => {
        console.warn('Error en suscribirMisChats:', err);
        callback([], err);
      }
    );
  },

  async listarChatsDeSolicitud(solicitudId) {
    if (!solicitudId) return [];
    try {
      const colRef = collection(db, 'chats');
      const q = query(colRef, where('solicitudId', '==', solicitudId));
      const snap = await getDocs(q);
      const lista = [];
      for (const d of snap.docs) {
        const c = normalizarDoc(d.id, d.data());
        if (c.providerUid) {
          try {
            const pSnap = await getDoc(doc(db, 'users', c.providerUid));
            if (pSnap.exists()) {
              const pd = pSnap.data();
              c.prestador_nombre = pd.displayName || `${pd.nombre || ''} ${pd.apellidos || ''}`.trim() || 'Postulante';
              c.prestador_foto = pd.photoURL || pd.foto_url || '';
              c.prestador_municipio = pd.municipio || '';
            }
          } catch {}
        }
        lista.push(c);
      }
      return lista;
    } catch (e) {
      console.warn('Error en listarChatsDeSolicitud:', e);
      return [];
    }
  },

  // ── Transacciones Atómicas de Acuerdo, Custodia y Pagos ──
  async actualizarPropuestaAcuerdo(chatId, uid, { agreedPrice, agreedDateTime }) {
    const precio = Number(agreedPrice);
    if (!precio || precio <= 0) {
      throw new Error('Ingresa un valor acordado válido en COP mayor a 0.');
    }
    if (!agreedDateTime) {
      throw new Error('Selecciona la fecha y hora pactada.');
    }

    const chatRef = doc(db, 'chats', chatId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(chatRef);
      if (!snap.exists()) throw new Error('Chat no encontrado.');
      const chat = snap.data();
      if (!(chat.participantes || []).includes(uid)) {
        throw new Error('No perteneces a esta conversación.');
      }
      if (chat.agreementStatus && chat.agreementStatus !== 'negociando') {
        throw new Error('El acuerdo ya fue cerrado o finalizado y no puede modificarse.');
      }
      tx.update(chatRef, {
        agreedPrice: Math.round(precio),
        agreedDateTime: String(agreedDateTime),
        clientConfirmed: false,
        providerConfirmed: false,
        actualizado_en: serverTimestamp(),
      });
    });
  },

  async confirmarCompromisoAcuerdo(chatId, uid) {
    const chatRef = doc(db, 'chats', chatId);

    return await runTransaction(db, async (tx) => {
      const chatSnap = await tx.get(chatRef);
      if (!chatSnap.exists()) throw new Error('Conversación no encontrada.');
      const chat = chatSnap.data();

      if (!chat.solicitudId) {
        throw new Error('Este chat no está vinculado a ninguna solicitud.');
      }
      if (uid !== chat.clientUid && uid !== chat.providerUid) {
        throw new Error('No tienes permisos en esta negociación.');
      }
      if (!chat.clientHasMessaged || !chat.providerHasMessaged) {
        throw new Error(
          'Ambos deben haber enviado al menos un mensaje en el chat antes de confirmar el compromiso.'
        );
      }

      const precio = Number(chat.agreedPrice || 0);
      if (!precio || precio <= 0 || !chat.agreedDateTime) {
        throw new Error('Definan primero el valor en COP y la fecha/hora pactada.');
      }

      const solRef = doc(db, 'solicitudes', chat.solicitudId);
      const solSnap = await tx.get(solRef);
      if (!solSnap.exists()) throw new Error('La solicitud ya no existe.');
      const sol = solSnap.data();

      const estadoSol = String(sol.estado || 'PUBLICADO').toUpperCase();
      if (estadoSol !== 'PUBLICADO') {
        throw new Error('Esta solicitud ya no está disponible o ya fue acordada con otro usuario.');
      }

      const clientRef = doc(db, 'users', chat.clientUid);
      const providerRef = doc(db, 'users', chat.providerUid);
      const [clientSnap, providerSnap] = await Promise.all([
        tx.get(clientRef),
        tx.get(providerRef),
      ]);

      const clientData = clientSnap.exists() ? clientSnap.data() : {};
      const providerData = providerSnap.exists() ? providerSnap.data() : {};

      const suspClient = verificarSuspensionActiva(clientData);
      const suspProv = verificarSuspensionActiva(providerData);
      if (suspClient.suspendida || suspProv.suspendida) {
        throw new Error('Una de las partes tiene una suspensión temporal activa y no puede cerrar acuerdos.');
      }

      const nextClientConfirmed =
        uid === chat.clientUid ? true : Boolean(chat.clientConfirmed);
      const nextProviderConfirmed =
        uid === chat.providerUid ? true : Boolean(chat.providerConfirmed);

      const ambosConfirmaron = nextClientConfirmed && nextProviderConfirmed;

      if (!ambosConfirmaron) {
        tx.update(chatRef, {
          clientConfirmed: nextClientConfirmed,
          providerConfirmed: nextProviderConfirmed,
          actualizado_en: serverTimestamp(),
        });
        return { estado: 'pendiente_contraparte' };
      }

      // Ambos confirmaron -> Validar saldo del cliente y retener 100 % en custodia (Escrow)
      const saldoCliente = Number(clientData.walletBalance ?? SALDO_INICIAL_SIMULADO);
      if (saldoCliente < precio) {
        throw new Error(
          `El solicitante no tiene saldo suficiente en billetera (${formatearCOP(saldoCliente)}). Se requieren ${formatearCOP(precio)}. Recarga saldo simulado en Billetera.`
        );
      }

      const comision = Math.round(precio * COMISION_PLATAFORMA);
      const netoPrestador = precio - comision;
      const nombrePrestador =
        providerData.displayName ||
        `${providerData.nombre || ''} ${providerData.apellidos || ''}`.trim() ||
        'Prestador';

      // Descontar 100 % al cliente hacia custodia
      tx.update(clientRef, {
        walletBalance: saldoCliente - precio,
        actualizado_en: serverTimestamp(),
      });

      // Cerrar acuerdo en chat
      tx.update(chatRef, {
        clientConfirmed: true,
        providerConfirmed: true,
        agreementStatus: 'en_progreso',
        escrowAmount: precio,
        platformFee: comision,
        providerNet: netoPrestador,
        confirmedAt: serverTimestamp(),
        actualizado_en: serverTimestamp(),
      });

      // Bloquear solicitud para terceros
      tx.update(solRef, {
        estado: 'en_progreso',
        agreementStatus: 'acordada',
        providerUid: chat.providerUid,
        providerNombre: nombrePrestador,
        chatId,
        agreedPrice: precio,
        agreedDateTime: chat.agreedDateTime,
        escrowAmount: precio,
        escrowStatus: 'en_custodia',
        platformFee: comision,
        providerNet: netoPrestador,
        clientCompletedConfirmed: false,
        providerCompletedConfirmed: false,
        actualizado_en: serverTimestamp(),
      });

      // Comprobante de retención en custodia
      const txRef = doc(collection(db, 'transactions'));
      tx.set(txRef, {
        id: txRef.id,
        userId: chat.clientUid,
        solicitudId: chat.solicitudId,
        chatId,
        type: 'COBRO_CUSTODIA',
        amountCOP: -precio,
        grossAmount: precio,
        platformFee: comision,
        netAmount: netoPrestador,
        description: `Retención en custodia (100%) por acuerdo en "${sol.titulo}"`,
        createdAt: serverTimestamp(),
      });

      return { estado: 'acordada', escrowAmount: precio };
    });
  },

  async confirmarTrabajoCompletado(solicitudId, chatId, uid) {
    const solRef = doc(db, 'solicitudes', solicitudId);

    return await runTransaction(db, async (tx) => {
      const solSnap = await tx.get(solRef);
      if (!solSnap.exists()) throw new Error('Solicitud no encontrada.');
      const sol = solSnap.data();

      const targetChatId = chatId || sol.chatId;
      const chatRef = targetChatId ? doc(db, 'chats', targetChatId) : null;
      const chatSnap = chatRef ? await tx.get(chatRef) : null;

      const estadoSol = String(sol.estado || '').toLowerCase();
      if (estadoSol !== 'en_progreso' && estadoSol !== 'acordada') {
        throw new Error('La solicitud debe estar en progreso para confirmar su finalización.');
      }

      const esCliente = uid === sol.autor_uid;
      const esPrestador = uid === sol.providerUid;
      if (!esCliente && !esPrestador) {
        throw new Error('Solo las partes del acuerdo pueden confirmar la finalización.');
      }

      const nextClientDone = esCliente ? true : Boolean(sol.clientCompletedConfirmed);
      const nextProviderDone = esPrestador ? true : Boolean(sol.providerCompletedConfirmed);

      if (!nextClientDone || !nextProviderDone) {
        tx.update(solRef, {
          clientCompletedConfirmed: nextClientDone,
          providerCompletedConfirmed: nextProviderDone,
          actualizado_en: serverTimestamp(),
        });
        if (chatRef && chatSnap?.exists()) {
          tx.update(chatRef, {
            clientCompletedConfirmed: nextClientDone,
            providerCompletedConfirmed: nextProviderDone,
            actualizado_en: serverTimestamp(),
          });
        }
        return { completada: false };
      }

      // Ambas partes confirmaron -> Liberar 92% al prestador y registrar 8% de comisión
      const bruto = Number(sol.escrowAmount || sol.agreedPrice || 0);
      const comision = Math.round(bruto * COMISION_PLATAFORMA);
      const netoPrestador = bruto - comision;

      const providerRef = doc(db, 'users', sol.providerUid);
      const providerSnap = await tx.get(providerRef);
      const providerData = providerSnap.exists() ? providerSnap.data() : {};
      const saldoActualPrestador = Number(
        providerData.walletBalance ?? SALDO_INICIAL_SIMULADO
      );

      tx.update(providerRef, {
        walletBalance: saldoActualPrestador + netoPrestador,
        actualizado_en: serverTimestamp(),
      });

      tx.update(solRef, {
        estado: 'completada',
        agreementStatus: 'completada',
        escrowStatus: 'liberado',
        clientCompletedConfirmed: true,
        providerCompletedConfirmed: true,
        completedAt: serverTimestamp(),
        actualizado_en: serverTimestamp(),
      });

      if (chatRef && chatSnap?.exists()) {
        tx.update(chatRef, {
          agreementStatus: 'completada',
          clientCompletedConfirmed: true,
          providerCompletedConfirmed: true,
          completedAt: serverTimestamp(),
          actualizado_en: serverTimestamp(),
        });
      }

      // Comprobante de pago al prestador (92%)
      const txPayRef = doc(collection(db, 'transactions'));
      tx.set(txPayRef, {
        id: txPayRef.id,
        userId: sol.providerUid,
        solicitudId,
        chatId: targetChatId || null,
        type: 'PAGO_LIBERADO_92',
        amountCOP: netoPrestador,
        grossAmount: bruto,
        platformFee: comision,
        netAmount: netoPrestador,
        description: `Pago liberado (92%) por servicio completado: "${sol.titulo}" (Comisión plataforma 8%: ${formatearCOP(comision)})`,
        createdAt: serverTimestamp(),
      });

      // Registro de ganancia de la plataforma (8%)
      const revRef = doc(collection(db, 'platform_revenue'));
      tx.set(revRef, {
        id: revRef.id,
        solicitudId,
        chatId: targetChatId || null,
        clientUid: sol.autor_uid,
        providerUid: sol.providerUid,
        grossAmountCOP: bruto,
        feePercentage: COMISION_PLATAFORMA,
        feeAmountCOP: comision,
        providerNetCOP: netoPrestador,
        createdAt: serverTimestamp(),
      });

      return { completada: true, netoPrestador, comision };
    });
  },

  async reportarIncumplimientoAcuerdo(solicitudId, chatId, reporterUid, offenderUid, motivo) {
    if (!motivo || !motivo.trim()) {
      throw new Error('Debes indicar el motivo del incumplimiento o cancelación unilateral.');
    }

    const solRef = doc(db, 'solicitudes', solicitudId);

    return await runTransaction(db, async (tx) => {
      const solSnap = await tx.get(solRef);
      if (!solSnap.exists()) throw new Error('Solicitud no encontrada.');
      const sol = solSnap.data();

      const targetChatId = chatId || sol.chatId;
      const chatRef = targetChatId ? doc(db, 'chats', targetChatId) : null;
      const chatSnap = chatRef ? await tx.get(chatRef) : null;

      const estadoSol = String(sol.estado || '').toLowerCase();
      if (estadoSol !== 'en_progreso' && estadoSol !== 'acordada') {
        throw new Error('Solo se puede registrar incumplimiento sobre un acuerdo en progreso.');
      }

      const offenderRef = doc(db, 'users', offenderUid);
      const clientRef = doc(db, 'users', sol.autor_uid);
      const [offenderSnap, clientSnap] = await Promise.all([
        tx.get(offenderRef),
        offenderUid === sol.autor_uid ? Promise.resolve(null) : tx.get(clientRef),
      ]);

      const offenderData = offenderSnap.exists() ? offenderSnap.data() : {};
      const faltasPrevias = Number(offenderData.strikes ?? offenderData.offensesCount ?? 0);
      const nuevaFalta = faltasPrevias + 1;

      const montoMulta =
        nuevaFalta <= 2 ? PENALIDAD_FALTA_1_2 : PENALIDAD_FALTA_3_MAS;

      let suspendedUntil = offenderData.suspendedUntil || null;
      let suspensionReason = offenderData.suspensionReason || null;
      if (nuevaFalta >= 3) {
        const reactivacion = new Date(
          Date.now() + DIAS_SUSPENSION * 24 * 60 * 60 * 1000
        ).toISOString();
        suspendedUntil = reactivacion;
        suspensionReason = `Suspensión automática de ${DIAS_SUSPENSION} días tras ${nuevaFalta} faltas por incumplimiento (${motivo.trim()}).`;
      }

      // Descontar multa del saldo si alcanza o sumarla a penaltyDebt
      let saldoInfractor = Number(
        offenderData.walletBalance ?? SALDO_INICIAL_SIMULADO
      );
      let deudaPenalidad = Number(offenderData.penaltyDebt ?? 0);

      // Si el cliente había dejado dinero en custodia y hay que reembolsar:
      const escrow = Number(sol.escrowAmount || 0);
      const hayReembolsoCliente = sol.escrowStatus === 'en_custodia' && escrow > 0;

      if (offenderUid === sol.autor_uid && hayReembolsoCliente) {
        // Cliente incumplió/canceló: reembolsar custodia menos multa
        const reembolsoNeto = Math.max(0, escrow - montoMulta);
        const faltante = Math.max(0, montoMulta - escrow);
        saldoInfractor = saldoInfractor + reembolsoNeto;
        deudaPenalidad += faltante;
      } else {
        // Prestador incumplió: descontar multa de su billetera o pasar a deuda, y reembolsar 100% al cliente
        if (saldoInfractor >= montoMulta) {
          saldoInfractor -= montoMulta;
        } else {
          deudaPenalidad += montoMulta - saldoInfractor;
          saldoInfractor = 0;
        }
        if (hayReembolsoCliente && clientSnap) {
          const cData = clientSnap.exists() ? clientSnap.data() : {};
          const saldoCli = Number(cData.walletBalance ?? SALDO_INICIAL_SIMULADO);
          tx.update(clientRef, {
            walletBalance: saldoCli + escrow,
            actualizado_en: serverTimestamp(),
          });
          const txReembRef = doc(collection(db, 'transactions'));
          tx.set(txReembRef, {
            id: txReembRef.id,
            userId: sol.autor_uid,
            solicitudId,
            chatId: targetChatId || null,
            type: 'REEMBOLSO',
            amountCOP: escrow,
            description: `Reembolso de custodia por incumplimiento en "${sol.titulo}"`,
            createdAt: serverTimestamp(),
          });
        }
      }

      tx.update(offenderRef, {
        strikes: nuevaFalta,
        offensesCount: nuevaFalta,
        walletBalance: saldoInfractor,
        penaltyDebt: deudaPenalidad,
        suspendedUntil,
        suspensionReason,
        actualizado_en: serverTimestamp(),
      });

      tx.update(solRef, {
        estado: 'incumplida',
        agreementStatus: 'incumplida',
        escrowStatus: hayReembolsoCliente ? 'reembolsado' : sol.escrowStatus,
        breachReason: motivo.trim(),
        breachedBy: offenderUid,
        actualizado_en: serverTimestamp(),
      });

      if (chatRef && chatSnap?.exists()) {
        tx.update(chatRef, {
          agreementStatus: 'incumplida',
          breachReason: motivo.trim(),
          actualizado_en: serverTimestamp(),
        });
      }

      // Registro auditado de penalización
      const penRef = doc(collection(db, 'penalties'));
      tx.set(penRef, {
        id: penRef.id,
        userId: offenderUid,
        userEmail: offenderData.email || '',
        solicitudId,
        chatId: targetChatId || null,
        reportedByUid: reporterUid,
        reason: motivo.trim(),
        strikeNumber: nuevaFalta,
        amountCOP: montoMulta,
        suspendedUntil,
        createdAt: serverTimestamp(),
      });

      const txPenRef = doc(collection(db, 'transactions'));
      tx.set(txPenRef, {
        id: txPenRef.id,
        userId: offenderUid,
        solicitudId,
        chatId: targetChatId || null,
        type: 'PENALIZACION',
        amountCOP: -montoMulta,
        description: `Penalización falta #${nuevaFalta} (${formatearCOP(montoMulta)}): ${motivo.trim()}`,
        createdAt: serverTimestamp(),
      });

      return {
        strikeNumber: nuevaFalta,
        amountCOP: montoMulta,
        suspendedUntil,
      };
    });
  },

  // ── Billetera, Transacciones y Auditoría ──────────────
  async recargarBilleteraSimulada(uid, montoCOP) {
    const monto = Math.round(Number(montoCOP));
    if (!monto || monto <= 0) {
      throw new Error('Ingresa un monto en COP válido para recargar.');
    }
    const userRef = doc(db, 'users', uid);
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists() ? snap.data() : {};
      const actual = Number(data.walletBalance ?? SALDO_INICIAL_SIMULADO);
      const nuevoSaldo = actual + monto;

      tx.update(userRef, {
        walletBalance: nuevoSaldo,
        actualizado_en: serverTimestamp(),
      });

      const txRef = doc(collection(db, 'transactions'));
      tx.set(txRef, {
        id: txRef.id,
        userId: uid,
        type: 'RECARGA_SIMULADA',
        amountCOP: monto,
        description: `Recarga simulada a billetera (${formatearCOP(monto)})`,
        createdAt: serverTimestamp(),
      });

      return { walletBalance: nuevoSaldo };
    });
  },

  suscribirTransaccionesUsuario(uid, callback) {
    if (!uid) return () => {};
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', uid),
      limit(50)
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => normalizarDoc(d.id, d.data()));
        list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        callback(list);
      },
      (err) => console.error('Error en suscribirTransaccionesUsuario:', err)
    );
  },

  suscribirPenalizacionesUsuario(uid, callback) {
    if (!uid) return () => {};
    const q = query(
      collection(db, 'penalties'),
      where('userId', '==', uid),
      limit(50)
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => normalizarDoc(d.id, d.data()));
        list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        callback(list);
      },
      (err) => console.error('Error en suscribirPenalizacionesUsuario:', err)
    );
  },

  suscribirIngresosPlataforma(callback) {
    const q = query(collection(db, 'platform_revenue'), limit(50));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => normalizarDoc(d.id, d.data()));
        list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        callback(list);
      },
      (err) => console.error('Error en suscribirIngresosPlataforma:', err)
    );
  },

  // ── Calificaciones ────────────────────────────────────
  async calificar(data, usuario) {
    const colRef = collection(db, 'calificaciones');
    let calificadorNombre = usuario.displayName || usuario.nombre || '';
    if (!calificadorNombre) {
      const p = await this.getPerfil(usuario.uid);
      calificadorNombre = p?.displayName || p?.nombre || usuario.email?.split('@')[0] || 'Usuario';
    }
    const calData = {
      ...data,
      calificadorId: usuario.uid,
      calificador_uid: usuario.uid,
      calificadorNombre,
      creado_en: serverTimestamp(),
    };
    const ref = await addDoc(colRef, calData);
    return { ...calData, id: ref.id, creado_en: new Date().toISOString() };
  },

  async obtenerCalificaciones(calificadoUid) {
    if (!calificadoUid) return [];
    const colRef = collection(db, 'calificaciones');
    const q = query(colRef, where('calificadoId', '==', calificadoUid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizarDoc(d.id, d.data()));
  },

  // ── Reportes ──────────────────────────────────────────
  async crearReporte(data, usuario) {
    const colRef = collection(db, 'reportes');
    const repData = {
      ...data,
      reportadoPor: usuario.uid,
      estado: 'PENDIENTE',
      creado_en: serverTimestamp(),
    };
    const ref = await addDoc(colRef, repData);
    return { ...repData, id: ref.id, creado_en: new Date().toISOString() };
  },

  async listarReportes(estado = null) {
    const colRef = collection(db, 'reportes');
    const snap = await getDocs(colRef);
    let list = snap.docs.map((d) => normalizarDoc(d.id, d.data()));
    if (estado) {
      const target = estado.toUpperCase();
      list = list.filter((r) => {
        const est = (r.estado || '').toUpperCase();
        if (target === 'ABIERTO') return est === 'PENDIENTE' || est === 'ABIERTO';
        return est === target;
      });
    }
    return list;
  },

  async resolverReporte(reporteId, payload, adminUid) {
    const ref = doc(db, 'reportes', reporteId);
    const snap = await getDoc(ref);
    const rep = snap.exists() ? snap.data() : {};
    const accion = payload?.accion || 'CERRAR';
    const resolucion = payload?.resolucion || 'Reporte atendido por administración';

    if (accion === 'BAN_USUARIO' && rep.objetivoId && rep.tipo === 'USUARIO') {
      await this.banearUsuario(rep.objetivoId, resolucion);
    } else if (accion === 'ELIMINAR_SOLICITUD' && rep.objetivoId && rep.tipo === 'SOLICITUD') {
      await this.eliminarSolicitud(rep.objetivoId);
    }

    await updateDoc(ref, {
      estado: 'RESUELTO',
      accion,
      resolucion,
      resueltoPor: adminUid,
      actualizado_en: serverTimestamp(),
    });
    const updated = await getDoc(ref);
    return normalizarDoc(updated.id, updated.data());
  },

  // ── Administración ────────────────────────────────────
  async listarUsuarios() {
    const colRef = collection(db, 'users');
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => normalizarDoc(d.id, d.data()));
  },

  async promoverAdmin(targetUid) {
    const ref = doc(db, 'users', targetUid);
    await updateDoc(ref, { role: 'ADMIN', rol: 'ADMIN', actualizado_en: serverTimestamp() });
    return true;
  },

  async revocarAdmin(targetUid) {
    const ref = doc(db, 'users', targetUid);
    const snap = await getDoc(ref);
    if (snap.exists() && (snap.data().email || '').toLowerCase() === 'admin@encargo.com') {
      throw new Error('No se puede revocar el rol de la cuenta principal admin@encargo.com.');
    }
    if (auth.currentUser && auth.currentUser.uid === targetUid) {
      throw new Error('No puedes quitarte tu propio rol de administrador.');
    }
    await updateDoc(ref, { role: 'USUARIO', rol: 'USUARIO', actualizado_en: serverTimestamp() });
    return true;
  },

  async banearUsuario(targetUid, motivo) {
    const ref = doc(db, 'users', targetUid);
    const snap = await getDoc(ref);
    if (snap.exists() && (snap.data().email || '').toLowerCase() === 'admin@encargo.com') {
      throw new Error('No se puede banear la cuenta principal admin@encargo.com.');
    }
    await updateDoc(ref, { banned: true, ban_motivo: motivo || 'Conducta no permitida' });
    return true;
  },

  async desbanearUsuario(targetUid) {
    const ref = doc(db, 'users', targetUid);
    await updateDoc(ref, {
      banned: false,
      ban_motivo: null,
      suspendedUntil: null,
      suspensionReason: null,
    });
    return true;
  },
};
