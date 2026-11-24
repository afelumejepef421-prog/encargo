import React from 'react';

/**
 * StarRating · Componente de estrellas interactivas o de sólo lectura.
 * Props:
 *  - valor: número de estrellas (1 a 5)
 *  - onChange: callback opcional si es interactivo
 *  - max: número máximo de estrellas (default 5)
 *  - soloLectura: boolean
 *  - tamano: 'sm' | 'md' | 'lg'
 */
export default function StarRating({
  valor = 0,
  onChange,
  max = 5,
  soloLectura = true,
  tamano = 'md',
}) {
  const estrellas = Array.from({ length: max }, (_, i) => i + 1);

  const getEstiloTamano = () => {
    switch (tamano) {
      case 'sm':
        return { fontSize: '1rem' };
      case 'lg':
        return { fontSize: '1.75rem' };
      default:
        return { fontSize: '1.25rem' };
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        ...getEstiloTamano(),
      }}
      role="radiogroup"
      aria-label="Calificación con estrellas"
    >
      {estrellas.map((estrella) => {
        const activa = estrella <= Math.round(valor);
        return (
          <span
            key={estrella}
            onClick={() => {
              if (!soloLectura && onChange) {
                onChange(estrella);
              }
            }}
            style={{
              cursor: soloLectura ? 'default' : 'pointer',
              color: activa ? '#f39c12' : '#d9d9d9',
              transition: 'transform 0.1s ease',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => {
              if (!soloLectura) e.currentTarget.style.transform = 'scale(1.2)';
            }}
            onMouseLeave={(e) => {
              if (!soloLectura) e.currentTarget.style.transform = 'scale(1.0)';
            }}
            title={`${estrella} de ${max} estrellas`}
          >
            ★
          </span>
        );
      })}
    </div>
  );
}
