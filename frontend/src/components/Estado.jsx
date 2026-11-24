import React from 'react';

export default function Estado({ tipo = 'info', mensaje, children }) {
  if (!mensaje && !children) return null;

  const clase = {
    cargando: 'estado-cargando',
    vacio: 'estado-vacio',
    error: 'estado-error',
    exito: 'estado-exito',
    advertencia: 'estado-advertencia',
    info: 'estado-info',
  }[tipo] || 'estado-info';

  return (
    <div className={clase} role={tipo === 'error' ? 'alert' : 'status'}>
      {mensaje || children}
    </div>
  );
}
