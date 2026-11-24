/**
 * Encargo · Billetera.jsx
 * Billetera simulada en COP, custodia (escrow), historial de penalizaciones (strikes),
 * comprobantes de movimientos e ingresos de comisión del 8% (para ADMIN).
 */
import React, { useState, useEffect } from 'react';
import {
  firestoreService,
  formatearCOP,
  verificarSuspensionActiva,
} from '../firestoreService';
import Estado from '../components/Estado';

export default function Billetera({ perfil }) {
  const [transacciones, setTransacciones] = useState([]);
  const [penalizaciones, setPenalizaciones] = useState([]);
  const [ingresosPlataforma, setIngresosPlataforma] = useState([]);
  const [montoRecarga, setMontoRecarga] = useState('50000');
  const [recargando, setRecargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const esAdmin = (perfil?.rol || perfil?.role) === 'ADMIN';
  const uid = perfil?.uid;

  useEffect(() => {
    if (!uid) return;
    const unsubTx = firestoreService.suscribirTransaccionesUsuario(uid, setTransacciones);
    const unsubPen = firestoreService.suscribirPenalizacionesUsuario(uid, setPenalizaciones);
    let unsubRev = () => {};
    if (esAdmin) {
      unsubRev = firestoreService.suscribirIngresosPlataforma(setIngresosPlataforma);
    }
    return () => {
      unsubTx();
      unsubPen();
      unsubRev();
    };
  }, [uid, esAdmin]);

  if (!perfil) return <Estado tipo="cargando" mensaje="Cargando billetera…" />;

  const susp = verificarSuspensionActiva(perfil);

  const handleRecargar = async (montoPersonalizado = null) => {
    const val = Number(montoPersonalizado ?? montoRecarga);
    setError('');
    setMensaje('');
    setRecargando(true);
    try {
      await firestoreService.recargarBilleteraSimulada(uid, val);
      setMensaje(`Recarga simulada de ${formatearCOP(val)} acreditada correctamente.`);
    } catch (err) {
      setError(err.message || 'No se pudo recargar el saldo.');
    } finally {
      setRecargando(false);
    }
  };

  const totalComisiones = ingresosPlataforma.reduce(
    (acc, r) => acc + Number(r.feeAmountCOP || 0),
    0
  );

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto' }}>
      <h1>💳 Billetera y Reputación Financiera (COP)</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Simulación de saldo en pesos colombianos (COP), retenciones en custodia (Escrow),
        comisión automática del 8 % y control de penalizaciones.
      </p>

      {susp.suspendida && (
        <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '14px', borderRadius: '8px', marginBottom: '20px' }}>
          <strong>⛔ Cuenta suspendida temporalmente por acumulación de faltas</strong>
          <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>
            Motivo: {susp.motivo}<br />
            Fecha de reactivación: <strong>{new Date(susp.hasta).toLocaleString('es-CO')}</strong>
          </div>
        </div>
      )}

      {mensaje && <Estado tipo="exito" mensaje={mensaje} />}
      {error && <Estado tipo="error" mensaje={error} />}

      {/* Tarjetas de resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="tarjeta" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.8125rem', color: '#666' }}>Saldo disponible</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#166534', marginTop: '4px' }}>
            {formatearCOP(perfil.walletBalance ?? 200000)}
          </div>
        </div>

        <div className="tarjeta" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.8125rem', color: '#666' }}>Faltas acumuladas (Strikes)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: (perfil.strikes || 0) >= 3 ? '#dc2626' : '#1a1a2e', marginTop: '4px' }}>
            {perfil.strikes || 0} {(perfil.strikes || 0) >= 3 ? '⛔' : ''}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>
            1.ª/2.ª falta: $5.000 · 3.ª+: $10.000 + 7 días
          </div>
        </div>

        <div className="tarjeta" style={{ marginBottom: 0 }}>
          <div style={{ fontSize: '0.8125rem', color: '#666' }}>Deuda por penalizaciones</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: (perfil.penaltyDebt || 0) > 0 ? '#b91c1c' : '#444', marginTop: '4px' }}>
            {formatearCOP(perfil.penaltyDebt || 0)}
          </div>
        </div>
      </div>

      {/* Recarga simulada */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '10px' }}>➕ Recarga simulada de saldo (COP)</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="number"
            min="1000"
            step="5000"
            value={montoRecarga}
            onChange={(e) => setMontoRecarga(e.target.value)}
            style={{ width: '160px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #d9d9d9' }}
          />
          <button type="button" className="btn-principal btn-sm" disabled={recargando} onClick={() => handleRecargar()}>
            Recargar monto
          </button>
          <button type="button" className="btn-secundario btn-sm" disabled={recargando} onClick={() => handleRecargar(50000)}>
            +$50.000
          </button>
          <button type="button" className="btn-secundario btn-sm" disabled={recargando} onClick={() => handleRecargar(100000)}>
            +$100.000
          </button>
          <button type="button" className="btn-secundario btn-sm" disabled={recargando} onClick={() => handleRecargar(200000)}>
            +$200.000
          </button>
        </div>
      </div>

      {/* Comprobantes de transacciones */}
      <div className="tarjeta" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>📄 Historial de Movimientos y Comprobantes</h2>
        {transacciones.length === 0 ? (
          <p style={{ color: '#666', fontSize: '0.9rem' }}>Aún no registras movimientos en tu billetera.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tabla-reportes" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Detalle</th>
                  <th>Monto (COP)</th>
                </tr>
              </thead>
              <tbody>
                {transacciones.map((tx) => {
                  const positivo = Number(tx.amountCOP) >= 0;
                  return (
                    <tr key={tx.id}>
                      <td style={{ fontSize: '0.8rem' }}>
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString('es-CO') : '—'}
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#f1f5f9', color: '#1e293b' }}>
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{tx.description}</td>
                      <td style={{ fontWeight: 700, color: positivo ? '#166534' : '#b91c1c' }}>
                        {positivo ? '+' : ''}{formatearCOP(tx.amountCOP)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Penalizaciones registradas */}
      {penalizaciones.length > 0 && (
        <div className="tarjeta" style={{ marginBottom: '24px', borderColor: '#fecaca' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#991b1b', marginBottom: '12px' }}>⚠️ Registro Auditado de Penalizaciones</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="tabla-reportes" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Falta #</th>
                  <th>Fecha</th>
                  <th>Motivo</th>
                  <th>Multa</th>
                  <th>Suspensión</th>
                </tr>
              </thead>
              <tbody>
                {penalizaciones.map((p) => (
                  <tr key={p.id}>
                    <td><strong>#{p.strikeNumber}</strong></td>
                    <td style={{ fontSize: '0.8rem' }}>{p.createdAt ? new Date(p.createdAt).toLocaleString('es-CO') : '—'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{p.reason}</td>
                    <td style={{ color: '#b91c1c', fontWeight: 700 }}>{formatearCOP(p.amountCOP)}</td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {p.suspendedUntil ? `Hasta ${new Date(p.suspendedUntil).toLocaleString('es-CO')}` : 'No aplica'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ingresos de la plataforma (solo ADMIN) */}
      {esAdmin && (
        <div className="tarjeta" style={{ borderColor: '#bfdbfe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>🏦 Ingresos de la Plataforma (Comisión 8%)</h2>
            <strong style={{ fontSize: '1.1rem', color: '#1d4ed8' }}>
              Total recaudado: {formatearCOP(totalComisiones)}
            </strong>
          </div>
          {ingresosPlataforma.length === 0 ? (
            <p style={{ color: '#666', fontSize: '0.9rem' }}>No se han liberado servicios aún.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tabla-reportes" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Solicitud</th>
                    <th>Valor Bruto</th>
                    <th>Pago Prestador (92%)</th>
                    <th>Comisión Plataforma (8%)</th>
                  </tr>
                </thead>
                <tbody>
                  {ingresosPlataforma.map((rev) => (
                    <tr key={rev.id}>
                      <td style={{ fontSize: '0.8rem' }}>{rev.createdAt ? new Date(rev.createdAt).toLocaleString('es-CO') : '—'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{rev.solicitudId}</td>
                      <td>{formatearCOP(rev.grossAmountCOP)}</td>
                      <td>{formatearCOP(rev.providerNetCOP)}</td>
                      <td style={{ fontWeight: 700, color: '#1d4ed8' }}>{formatearCOP(rev.feeAmountCOP)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
