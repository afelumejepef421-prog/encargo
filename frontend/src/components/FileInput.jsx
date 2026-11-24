import React from 'react';

export default function FileInput({
  label,
  id,
  accept,
  multiple = false,
  onChange,
  error,
  ayuda,
  required = false,
  maxSizeMB = 5,
}) {
  const [nombreArchivo, setNombreArchivo] = React.useState('');

  const handleChange = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setNombreArchivo('');
      onChange(multiple ? [] : null);
      return;
    }

    if (multiple) {
      const arr = Array.from(files);
      setNombreArchivo(`${arr.length} archivo(s) seleccionado(s)`);
      onChange(arr);
    } else {
      setNombreArchivo(files[0].name);
      onChange(files[0]);
    }
  };

  return (
    <div className={`form-grupo ${error ? 'tiene-error' : ''}`}>
      {label && (
        <label htmlFor={id}>
          {label} {required && <span style={{ color: '#c0392b' }}>*</span>}
        </label>
      )}
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        style={{ display: 'block', marginTop: '4px' }}
      />
      {ayuda && !error && (
        <div className="ayuda">
          {ayuda} (Máx {maxSizeMB} MiB)
        </div>
      )}
      {error && <div className="error-campo" role="alert">{error}</div>}
    </div>
  );
}
