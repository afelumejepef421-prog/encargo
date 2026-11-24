/**
 * Encargo · Panel.jsx
 * Panel principal. Muestra solicitudes públicas y propias con filtros.
 * ADMIN puede eliminar cualquier solicitud.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Estado from '../components/Estado';
import SolicitudCard from '../components/SolicitudCard';
import SelectorUbicacion from '../components/SelectorUbicacion';
import { parsearUbicacion } from '../data/municipiosColombia';

const CATEGORIAS = [
  'Plomería', 'Electricidad', 'Carpintería', 'Pintura', 'Limpieza',
  'Jardinería', 'Mecánica', 'Tecnología', 'Mudanza', 'Albañilería',
  'Cerrajería', 'Fumigación', 'Otro',
];

export default function Panel({ perfil }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState('');

  const esAdmin = perfil?.rol === 'ADMIN';

  const cargarSolicitudes = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const params = {};
      if (filtroCategoria) params.categoria = filtroCategoria;
      if (filtroMunicipio) params.municipio = filtroMunicipio;
      const data = await api.get('/solicitudes', params);
      let lista = Array.isArray(data) ? data : data.solicitudes || [];
      if (filtroDepartamento && !filtroMunicipio) {
        lista = lista.filter((sol) => parsearUbicacion(sol.municipio).departamento === filtroDepartamento);
      }
      setSolicitudes(lista);
    } catch (err) {
      setError(err.message || 'Error al cargar solicitudes');
    } finally {
      setCargando(false);
    }
  }, [filtroCategoria, filtroDepartamento, filtroMunicipio]);

  useEffect(() => {
    cargarSolicitudes();
  }, [cargarSolicitudes]);

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta solicitud?')) return;
    try {
      await api.delete(`/solicitudes/${id}`);
      setSolicitudes((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err.message || 'Error al eliminar');
    }
  };

  const handleCancelar = async (id) => {
    if (!window.confirm('¿Deseas cancelar esta solicitud?')) return;
    try {
      await api.patch(`/solicitudes/${id}`, { estado: 'cancelado' });
      setSolicitudes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, estado: 'cancelado' } : s))
      );
    } catch (err) {
      alert(err.message || 'Error al cancelar');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <h1>Panel de solicitudes</h1>
        <Link to="/solicitudes/nueva" className="btn-principal">
          + Publicar nueva solicitud
        </Link>
      </div>

      {/* Filtros */}
      <div className="panel" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
        <div className="form-grupo" style={{ marginBottom: 0, flex: '1 1 200px' }}>
          <label htmlFor="filtro-cat">Categoría</label>
          <select
            id="filtro-cat"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <SelectorUbicacion
          modoFiltro
          idPrefix="filtro"
          value={filtroMunicipio}
          onChange={setFiltroMunicipio}
          departamentoFiltro={filtroDepartamento}
          onDepartamentoFiltroChange={setFiltroDepartamento}
        />
        <button
          type="button"
          className="btn-secundario btn-sm"
          onClick={() => {
            setFiltroCategoria('');
            setFiltroDepartamento('');
            setFiltroMunicipio('');
          }}
        >
          Limpiar filtros
        </button>
      </div>

      {/* Contenido */}
      {error && <Estado tipo="error" mensaje={error} />}

      {cargando ? (
        <Estado tipo="cargando" mensaje="Cargando solicitudes…" />
      ) : solicitudes.length === 0 ? (
        <Estado tipo="vacio" mensaje="No hay solicitudes que mostrar." />
      ) : (
        <div>
          {solicitudes.map((sol) => (
            <SolicitudCard
              key={sol.id}
              solicitud={sol}
              esPropia={sol.autor_uid === perfil?.uid}
              esAdmin={esAdmin}
              onEliminar={handleEliminar}
              onCancelar={handleCancelar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
