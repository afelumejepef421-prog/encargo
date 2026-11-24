import React from 'react';

export default function Dialogo({
  abierto,
  titulo,
  onCerrar,
  children,
}) {
  if (!abierto) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="tarjeta"
        style={{
          backgroundColor: '#ffffff',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#888',
            }}
            aria-label="Cerrar modal"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
