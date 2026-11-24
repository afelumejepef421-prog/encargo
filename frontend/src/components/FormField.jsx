import React from 'react';

export default function FormField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  error,
  ayuda,
  required = false,
  disabled = false,
  children,
  ...props
}) {
  const tieneError = Boolean(error);

  return (
    <div className={`form-grupo ${tieneError ? 'tiene-error' : ''}`}>
      {label && (
        <label htmlFor={id}>
          {label} {required && <span style={{ color: '#c0392b' }}>*</span>}
        </label>
      )}

      {children ? (
        children
      ) : type === 'textarea' ? (
        <textarea
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          {...props}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          {...props}
        />
      )}

      {ayuda && !tieneError && <div className="ayuda">{ayuda}</div>}
      {tieneError && <div className="error-campo" role="alert">{error}</div>}
    </div>
  );
}
