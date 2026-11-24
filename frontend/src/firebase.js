/**
 * Encargo · firebase.js
 * Inicialización del SDK oficial de Firebase para la Web.
 * Conectado al proyecto en la nube: encargo-app-8a98f
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyA8GHddiQX4gx_Ee_ZyHRc6SHJWUIGpf_s",
  authDomain: "encargo-app-8a98f.firebaseapp.com",
  projectId: "encargo-app-8a98f",
  storageBucket: "encargo-app-8a98f.firebasestorage.app",
  messagingSenderId: "768434780176",
  appId: "1:768434780176:web:e957c8bf65a74de193b295",
  measurementId: "G-WWZ3RLCPWP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
