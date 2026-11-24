/**
 * Encargo · Registro.jsx
 * Página de registro público con Firebase Auth.
 * Todos los nuevos usuarios son USUARIO.
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import api from '../api';
import FormField from '../components/FormField';
import Estado from '../components/Estado';
import SelectorUbicacion from '../components/SelectorUbicacion';

export default function Registro() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    contrasena: '',
    contrasena2: '',
    municipio: '',
    bio: '',
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleChange = (campo) => (e) => {
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));
    setErrores((prev) => ({ ...prev, [campo]: '' }));
  };

  const validar = () => {
    const errs = {};
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    if (!form.apellidos.trim()) errs.apellidos = 'Los apellidos son obligatorios';
    if (!form.email.trim()) errs.email = 'El correo electrónico o usuario es obligatorio';
    else if (form.email.trim().toLowerCase() !== 'admin' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Correo no válido';
    if (!form.contrasena) errs.contrasena = 'La contraseña es obligatoria';
    else if (form.contrasena.length < 6) errs.contrasena = 'Mínimo 6 caracteres';
    if (form.contrasena !== form.contrasena2) errs.contrasena2 = 'Las contraseñas no coinciden';
    if (!form.municipio) errs.municipio = 'Selecciona un municipio';
    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validar()) return;

    setEnviando(true);
    setErrorGeneral('');

    try {
      const emailLimpio = form.email.trim();
      const emailFinal = emailLimpio.toLowerCase() === 'admin'
        ? 'admin@encargo.com'
        : emailLimpio;

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        emailFinal,
        form.contrasena
      );

      const esAdminInicial = emailFinal === 'admin@encargo.com';

      await updateProfile(userCredential.user, {
        displayName: `${form.nombre.trim()} ${form.apellidos.trim()}`,
      });

      await api.post('/cuentas', {
        nombre: form.nombre.trim(),
        apellidos: form.apellidos.trim(),
        municipio: form.municipio,
        bio: form.bio.trim() || null,
        role: esAdminInicial ? 'ADMIN' : 'USUARIO',
        rol: esAdminInicial ? 'ADMIN' : 'USUARIO',
      });

      navigate('/panel');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setErrorGeneral('Este correo electrónico ya está registrado.');
      } else if (err.code === 'auth/weak-password') {
        setErrorGeneral('La contraseña es demasiado débil. Usa al menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorGeneral('El formato del correo electrónico no es válido.');
      } else {
        setErrorGeneral(err.message || 'Error al crear la cuenta. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="contenedor" style={{ maxWidth: '520px' }}>
      <h1>Crear cuenta</h1>
      <p style={{ marginBottom: '24px', color: '#666' }}>
        Regístrate para publicar solicitudes y contactar con otros usuarios.
      </p>

      {errorGeneral && <Estado tipo="error" mensaje={errorGeneral} />}

      <form onSubmit={handleSubmit}>
        <FormField
          label="Nombre"
          id="nombre"
          value={form.nombre}
          onChange={handleChange('nombre')}
          error={errores.nombre}
          required
          placeholder="Tu nombre"
        />
        <FormField
          label="Apellidos"
          id="apellidos"
          value={form.apellidos}
          onChange={handleChange('apellidos')}
          error={errores.apellidos}
          required
          placeholder="Tus apellidos"
        />
        <FormField
          label="Correo electrónico o Usuario"
          id="email"
          type="text"
          value={form.email}
          onChange={handleChange('email')}
          error={errores.email}
          required
          placeholder="correo@ejemplo.com (o Admin)"
        />
        <FormField
          label="Contraseña"
          id="contrasena"
          type="password"
          value={form.contrasena}
          onChange={handleChange('contrasena')}
          error={errores.contrasena}
          required
          ayuda="Mínimo 6 caracteres"
        />
        <FormField
          label="Confirmar contraseña"
          id="contrasena2"
          type="password"
          value={form.contrasena2}
          onChange={handleChange('contrasena2')}
          error={errores.contrasena2}
          required
        />
        <SelectorUbicacion
          value={form.municipio}
          onChange={(val) => {
            setForm((prev) => ({ ...prev, municipio: val }));
            setErrores((prev) => ({ ...prev, municipio: '' }));
          }}
          error={errores.municipio}
          required
          idPrefix="registro"
        />
        <FormField
          label="Biografía (opcional)"
          id="bio"
          type="textarea"
          value={form.bio}
          onChange={handleChange('bio')}
          placeholder="Cuéntanos un poco sobre ti…"
          rows={3}
        />

        <button type="submit" className="btn-principal" disabled={enviando} style={{ width: '100%' }}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.875rem' }}>
        ¿Ya tienes cuenta?{' '}
        <Link to="/acceso" style={{ color: '#1a1a2e', fontWeight: 600 }}>
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
