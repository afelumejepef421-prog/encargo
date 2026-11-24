/**
 * Encargo · firebase-shim.js
 * Adaptador local de Firebase Auth con aislamiento estricto de identidad por cuenta.
 * Si 'firebase' está instalado en node_modules, vite.config.js usará el paquete real.
 */

function obtenerUidYNombre(email) {
  const clean = (email || '').trim().toLowerCase();
  if (clean === 'admin@encargo.com' || clean.includes('admin')) {
    return { uid: 'admin-master-uid', nombre: 'Carlos Administrador', esAdmin: true };
  }
  if (clean === 'luis.morales@ejemplo.com') {
    return { uid: 'usr-luis-uid', nombre: 'Luis Morales', esAdmin: false };
  }
  if (clean === 'elena.vega@ejemplo.com') {
    return { uid: 'usr-elena-uid', nombre: 'Elena Vega', esAdmin: false };
  }
  if (clean === 'roberto.torres@ejemplo.com') {
    return { uid: 'usr-roberto-uid', nombre: 'Roberto Torres', esAdmin: false };
  }
  const hash = Math.abs(clean.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(16);
  return { uid: `usr_${hash}`, nombre: clean.split('@')[0], esAdmin: false };
}

let currentUser = null;
try {
  // Priorizar sessionStorage para permitir múltiples cuentas en ventanas independientes
  const guardado = sessionStorage.getItem('encargo_firebase_user') || localStorage.getItem('encargo_firebase_user');
  if (guardado) {
    const parsed = JSON.parse(guardado);
    if (parsed && parsed.uid && parsed.email) {
      currentUser = {
        ...parsed,
        getIdToken: async () => `demo-token:${parsed.uid}:${parsed.email}`,
      };
    }
  }
} catch (e) {
  currentUser = null;
}

const authListeners = [];

function notificar(user) {
  currentUser = user;
  try {
    if (user) {
      const dataStr = JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
      sessionStorage.setItem('encargo_firebase_user', dataStr);
      localStorage.setItem('encargo_firebase_user', dataStr);
    } else {
      sessionStorage.removeItem('encargo_firebase_user');
      localStorage.removeItem('encargo_firebase_user');
    }
  } catch (e) {}

  authListeners.forEach((cb) => {
    try {
      cb(currentUser);
    } catch (err) {
      console.error(err);
    }
  });
}

export const auth = {
  get currentUser() {
    return currentUser;
  },
};

export function initializeApp(config) {
  return { name: '[DEFAULT]', options: config };
}

export function getAuth(app) {
  return auth;
}

export function onAuthStateChanged(authInstance, callback) {
  authListeners.push(callback);
  setTimeout(() => callback(currentUser), 50);
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx !== -1) authListeners.splice(idx, 1);
  };
}

export async function signInWithEmailAndPassword(authInstance, email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const { uid, nombre, esAdmin } = obtenerUidYNombre(cleanEmail);

  const user = {
    uid,
    email: cleanEmail,
    displayName: nombre,
    photoURL: '',
    getIdToken: async () => (esAdmin ? 'demo-admin-token' : `demo-token:${uid}:${cleanEmail}`),
  };

  notificar(user);
  return { user };
}

export async function createUserWithEmailAndPassword(authInstance, email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const { uid, nombre } = obtenerUidYNombre(cleanEmail);

  const user = {
    uid,
    email: cleanEmail,
    displayName: nombre,
    photoURL: '',
    getIdToken: async () => `demo-token:${uid}:${cleanEmail}`,
  };

  notificar(user);
  return { user };
}

export async function updateProfile(user, { displayName, photoURL }) {
  if (currentUser) {
    if (displayName) currentUser.displayName = displayName;
    if (photoURL) currentUser.photoURL = photoURL;
    notificar(currentUser);
  }
  return true;
}

export async function signOut(authInstance) {
  currentUser = null;
  try {
    sessionStorage.removeItem('encargo_firebase_user');
    localStorage.removeItem('encargo_firebase_user');
  } catch (e) {}
  notificar(null);
  return true;
}
