/**
 * Encargo · NuevaSolicitud.jsx
 * Formulario para crear una nueva solicitud de servicio.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import FormField from '../components/FormField';
import FileInput from '../components/FileInput';
import Estado from '../components/Estado';
import SelectorUbicacion from '../components/SelectorUbicacion';

const CATEGORIAS = [
  'Plomería', 'Electricidad', 'Carpintería', 'Pintura', 'Limpieza',
  'Jardinería', 'Mecánica', 'Tecnología', 'Mudanza', 'Albañilería',
  'Cerrajería', 'Fumigación', 'Otro',
];

export default function NuevaSolicitud() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    categoria: '',
    municipio: '',
    fecha_deseada: '',
  });
  const [imagenes, setImagenes] = useState([]);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleChange = (campo) => (e) => {
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));
    setErrores((prev) => ({ ...prev, [campo]: '' }));
  };

  const validar = () => {
    const errs = {};
    if (!form.titulo.trim()) errs.titulo = 'El título es obligatorio';
    if (!form.descripcion.trim()) errs.descripcion = 'La descripción es obligatoria';
    if (!form.categoria) errs.categoria = 'Selecciona una categoría';
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
      // 1. Crear solicitud en Firestore
      const body = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        categoria: form.categoria,
        municipio: form.municipio,
      };
      if (form.fecha_deseada) body.fecha_deseada = form.fecha_deseada;
      const res = await api.post('/solicitudes', body);

      // 2. Si se adjuntaron imágenes, subirlas al almacenamiento de la solicitud
      if (imagenes && imagenes.length > 0 && res?.id) {
        const formData = new FormData();
        imagenes.forEach((img) => {
          formData.append('archivos', img);
        });
        try {
          await api.upload(`/solicitudes/${res.id}/imagenes`, formData);
        } catch (imgErr) {
          console.warn('Aviso: la solicitud se creó pero hubo un fallo al subir imágenes:', imgErr);
        }
      }
      navigate('/panel');
    } catch (err) {
      setErrorGeneral(err.message || 'Error al crear la solicitud');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="contenedor" style={{ maxWidth: '640px' }}>
      <h1>Publicar nueva solicitud</h1>
      <p style={{ marginBottom: '24px', color: '#666' }}>
        Describe el servicio que necesitas y los usuarios podrán contactarte.
      </p>

      {errorGeneral && <Estado tipo="error" mensaje={errorGeneral} />}

      <form onSubmit={handleSubmit}>
        <FormField
          label="Título"
          id="titulo"
          value={form.titulo}
          onChange={handleChange('titulo')}
          error={errores.titulo}
          required
          placeholder="Ej: Reparación de tubería en cocina"
        />
        <FormField
          label="Descripción"
          id="descripcion"
          type="textarea"
          value={form.descripcion}
          onChange={handleChange('descripcion')}
          error={errores.descripcion}
          required
          placeholder="Detalla qué necesitas, cuándo y cualquier información relevante…"
          rows={5}
        />
        <FormField label="Categoría" id="categoria" error={errores.categoria} required>
          <select
            id="categoria"
            value={form.categoria}
            onChange={handleChange('categoria')}
          >
            <option value="">— Seleccionar categoría —</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </FormField>
        <SelectorUbicacion
          value={form.municipio}
          onChange={(val) => {
            setForm((prev) => ({ ...prev, municipio: val }));
            setErrores((prev) => ({ ...prev, municipio: '' }));
          }}
          error={errores.municipio}
          required
          idPrefix="nueva-sol"
        />
        <FormField
          label="Fecha deseada (opcional)"
          id="fecha_deseada"
          type="date"
          value={form.fecha_deseada}
          onChange={handleChange('fecha_deseada')}
          ayuda="¿Cuándo necesitas el servicio?"
        />
        <FileInput
          label="Imágenes (opcional)"
          id="imagenes"
          accept="image/*"
          multiple
          onChange={setImagenes}
          ayuda="Adjunta fotos que describan el trabajo"
          maxSizeMB={5}
        />

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button type="submit" className="btn-principal" disabled={enviando}>
            {enviando ? 'Publicando…' : 'Publicar solicitud'}
          </button>
          <button type="button" className="btn-secundario" onClick={() => navigate('/panel')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
