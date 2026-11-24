/**
 * Encargo · SelectorUbicacion.jsx
 * Selector en dos pasos:
 *  1) Departamento de Colombia (en orden alfabético).
 *  2) Municipios / pueblos exclusivos del departamento elegido (en orden alfabético).
 */
import React, { useState, useEffect } from 'react';
import FormField from './FormField';
import {
  COLOMBIA_POR_DEPARTAMENTO,
  DEPARTAMENTOS_COLOMBIA,
  formatearUbicacion,
  parsearUbicacion,
} from '../data/municipiosColombia';

export default function SelectorUbicacion({
  value = '',
  onChange,
  error = '',
  required = false,
  idPrefix = 'ubicacion',
  modoFiltro = false,
  departamentoFiltro = '',
  onDepartamentoFiltroChange,
}) {
  const [departamento, setDepartamento] = useState('');
  const [municipioSimple, setMunicipioSimple] = useState('');

  useEffect(() => {
    if (modoFiltro) {
      setDepartamento(departamentoFiltro || '');
      const parsed = parsearUbicacion(value);
      setMunicipioSimple(parsed.municipio || '');
    } else {
      const parsed = parsearUbicacion(value);
      if (parsed.departamento) {
        setDepartamento(parsed.departamento);
        setMunicipioSimple(parsed.municipio);
      } else if (!value) {
        setDepartamento('');
        setMunicipioSimple('');
      }
    }
  }, [value, modoFiltro, departamentoFiltro]);

  const municipiosDisponibles = departamento
    ? COLOMBIA_POR_DEPARTAMENTO[departamento] || []
    : [];

  const handleDepartamentoChange = (e) => {
    const nuevoDepto = e.target.value;
    setDepartamento(nuevoDepto);

    if (modoFiltro) {
      setMunicipioSimple('');
      if (onDepartamentoFiltroChange) onDepartamentoFiltroChange(nuevoDepto);
      if (onChange) onChange('');
      return;
    }

    // Si es Bogotá D.C. (único distrito), preseleccionarlo automáticamente
    if (nuevoDepto === 'Bogotá D.C.') {
      setMunicipioSimple('Bogotá D.C.');
      if (onChange) onChange('Bogotá D.C.');
    } else {
      setMunicipioSimple('');
      if (onChange) onChange('');
    }
  };

  const handleMunicipioChange = (e) => {
    const nuevoMun = e.target.value;
    setMunicipioSimple(nuevoMun);
    if (onChange) {
      onChange(nuevoMun ? formatearUbicacion(departamento, nuevoMun) : '');
    }
  };

  if (modoFiltro) {
    return (
      <>
        <div className="form-grupo" style={{ marginBottom: 0, flex: '1 1 200px' }}>
          <label htmlFor={`${idPrefix}-depto`}>Departamento</label>
          <select
            id={`${idPrefix}-depto`}
            value={departamento}
            onChange={handleDepartamentoChange}
          >
            <option value="">Todos los departamentos</option>
            {DEPARTAMENTOS_COLOMBIA.map((dep) => (
              <option key={dep} value={dep}>{dep}</option>
            ))}
          </select>
        </div>

        <div className="form-grupo" style={{ marginBottom: 0, flex: '1 1 200px' }}>
          <label htmlFor={`${idPrefix}-mun`}>Municipio / Pueblo</label>
          <select
            id={`${idPrefix}-mun`}
            value={municipioSimple}
            onChange={handleMunicipioChange}
            disabled={!departamento}
          >
            <option value="">
              {departamento
                ? 'Todos los municipios del departamento'
                : '— Primero elige un departamento —'}
            </option>
            {municipiosDisponibles.map((mun) => (
              <option key={mun} value={mun}>{mun}</option>
            ))}
          </select>
        </div>
      </>
    );
  }

  return (
    <>
      <FormField
        label="Departamento"
        id={`${idPrefix}-depto`}
        required={required}
      >
        <select
          id={`${idPrefix}-depto`}
          value={departamento}
          onChange={handleDepartamentoChange}
        >
          <option value="">— Seleccionar departamento —</option>
          {DEPARTAMENTOS_COLOMBIA.map((dep) => (
            <option key={dep} value={dep}>{dep}</option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Municipio o pueblo"
        id={`${idPrefix}-mun`}
        error={error}
        required={required}
      >
        <select
          id={`${idPrefix}-mun`}
          value={municipioSimple}
          onChange={handleMunicipioChange}
          disabled={!departamento}
        >
          <option value="">
            {departamento
              ? `— Seleccionar municipio de ${departamento} —`
              : '— Primero selecciona un departamento —'}
          </option>
          {municipiosDisponibles.map((mun) => (
            <option key={mun} value={mun}>{mun}</option>
          ))}
        </select>
      </FormField>
    </>
  );
}
