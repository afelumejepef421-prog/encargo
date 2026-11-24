/**
 * Encargo · Acceso.jsx
 * Página de inicio de sesión con Firebase Auth.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import FormField from '../components/FormField';
import Estado from '../components/Estado';

export default function Acceso() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !contrasena) {
      setError('Completa todos los campos.');
      return;
    }

    setEnviando(true);
    try {
      const emailLimpio = email.trim();
      const emailFinal = emailLimpio.toLowerCase() === 'admin' 
        ? 'admin@encargo.com' 
        : emailLimpio;
      await signInWithEmailAndPassword(auth, emailFinal, contrasena);
      navigate('/panel');
    } catch (err) {
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Correo o contraseña incorrectos.');
      } else if (err.code === 'auth/user-disabled') {
        setError('Esta cuenta ha sido deshabilitada.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Espera un momento e intenta de nuevo.');
      } else {
        setError(err.message || 'Error al iniciar sesión.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="contenedor" style={{ maxWidth: '420px' }}>
      <h1>Iniciar sesión</h1>
      <p style={{ marginBottom: '24px', color: '#666' }}>
        Accede a tu cuenta de Encargo.
      </p>

      {error && <Estado tipo="error" mensaje={error} />}

      <form onSubmit={handleSubmit}>
        <FormField
          label="Correo o Usuario"
          id="email"
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Admin o correo@ejemplo.com"
        />
        <FormField
          label="Contraseña"
          id="contrasena"
          type="password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          required
        />

        <button type="submit" className="btn-principal" disabled={enviando} style={{ width: '100%' }}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.875rem' }}>
        ¿No tienes cuenta?{' '}
        <Link to="/registro" style={{ color: '#1a1a2e', fontWeight: 600 }}>
          Regístrate aquí
        </Link>
      </p>
    </div>
  );
}
