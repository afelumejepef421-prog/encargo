/**
 * Encargo · AcuerdoChatPanel.jsx
 * Panel de negociación, validación de comunicación previa, doble confirmación
 * de compromiso, custodia (escrow), liberación 92%/8% y reporte de incumplimiento.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { firestoreService, formatearCOP, COMISION_PLATAFORMA } from '../firestoreService';

export default function AcuerdoChatPanel({ infoChat, perfil }) {
  const [precio, setPrecio] = useState('');
  const [fechaHora, setFechaHora] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [errorAcuerdo, setErrorAcuerdo] = useState('');
  const [avisoAcuerdo, setAvisoAcuerdo] = useState('');
  const [mostrarIncumplimiento, setMostrarIncumplimiento] = useState(false);
  const [motivoFalta, setMotivoFalta] = useState('');
  const [tipoFalta, setTipoFalta] = useState('contraparte'); // 'contraparte' | 'unilateral'

  useEffect(() => {
    if (infoChat) {
      if (infoChat.agreedPrice) setPrecio(String(infoChat.agreedPrice));
      if (infoChat.agreedDateTime) setFechaHora(infoChat.agreedDateTime);
    }
  }, [infoChat?.agreedPrice, infoChat?.agreedDateTime]);

  if (!infoChat?.solicitudId) return null;

  const uid = perfil?.uid;
  const esCliente = uid === infoChat.clientUid;
  const esPrestador = uid === infoChat.providerUid;
  const estadoAcuerdo = infoChat.agreementStatus || 'negociando';

  const ambosEnviaronMensaje =
    Boolean(infoChat.clientHasMessaged) && Boolean(infoChat.providerHasMessaged);

  const miConfirmacion = esCliente
    ? Boolean(infoChat.clientConfirmed)
    : Boolean(infoChat.providerConfirmed);
  const otraConfirmacion = esCliente
    ? Boolean(infoChat.providerConfirmed)
    : Boolean(infoChat.clientConfirmed);

  const miCompletado = esCliente
    ? Boolean(infoChat.clientCompletedConfirmed)
    : Boolean(infoChat.providerCompletedConfirmed);
  const otroCompletado = esCliente
    ? Boolean(infoChat.providerCompletedConfirmed)
    : Boolean(infoChat.clientCompletedConfirmed);

  const precioNum = Number(infoChat.agreedPrice || precio || 0);
  const comisionEst = Math.round(precioNum * COMISION_PLATAFORMA);
  const netoEst = precioNum - comisionEst;

  const handleGuardarPropuesta = async (e) => {
    e.preventDefault();
    setErrorAcuerdo('');
    setAvisoAcuerdo('');
    setProcesando(true);
    try {
      await firestoreService.actualizarPropuestaAcuerdo(infoChat.id, uid, {
        agreedPrice: Number(precio),
        agreedDateTime: fechaHora,
      });
      setAvisoAcuerdo('Propuesta actualizada. Ahora ambas partes pueden confirmarla.');
    } catch (err) {
      setErrorAcuerdo(err.message || 'No se pudo actualizar la propuesta.');
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarCompromiso = async () => {
    setErrorAcuerdo('');
    setAvisoAcuerdo('');
    setProcesando(true);
    try {
      const res = await firestoreService.confirmarCompromisoAcuerdo(infoChat.id, uid);
      if (res.estado === 'acordada') {
        setAvisoAcuerdo(
          `¡Compromiso cerrado por ambas partes! Se retuvieron ${formatearCOP(res.escrowAmount)} en custodia (Escrow).`
        );
      } else {
        setAvisoAcuerdo('Tu confirmación fue registrada. Esperando confirmación de la contraparte.');
      }
    } catch (err) {
      setErrorAcuerdo(err.message || 'No se pudo confirmar el compromiso.');
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarCompletado = async () => {
    setErrorAcuerdo('');
    setAvisoAcuerdo('');
    setProcesando(true);
    try {
      const res = await firestoreService.confirmarTrabajoCompletado(
        infoChat.solicitudId,
        infoChat.id,
        uid
      );
      if (res.completada) {
        setAvisoAcuerdo(
          `¡Trabajo completado! Se liberó ${formatearCOP(res.netoPrestador)} (92%) al solucionador y ${formatearCOP(res.comision)} (8%) de comisión.`
        );
      } else {
        setAvisoAcuerdo('Confirmaste que el trabajo terminó. Falta la confirmación de la otra parte para liberar el pago.');
      }
    } catch (err) {
      setErrorAcuerdo(err.message || 'Error al confirmar finalización.');
    } finally {
      setProcesando(false);
    }
  };

  const handleIncumplimiento = async (e) => {
    e.preventDefault();
    setErrorAcuerdo('');
    setAvisoAcuerdo('');
    setProcesando(true);
    try {
      const offenderUid =
        tipoFalta === 'unilateral'
          ? uid
          : esCliente
          ? infoChat.providerUid
          : infoChat.clientUid;
      const res = await firestoreService.reportarIncumplimientoAcuerdo(
        infoChat.solicitudId,
        infoChat.id,
        uid,
        offenderUid,
        motivoFalta
      );
      setMostrarIncumplimiento(false);
      setMotivoFalta('');
      setAvisoAcuerdo(
        `Incumplimiento registrado (Falta #${res.strikeNumber}). Penalización aplicada: ${formatearCOP(res.amountCOP)}.` +
          (res.suspendedUntil
            ? ` Cuenta suspendida hasta ${new Date(res.suspendedUntil).toLocaleString('es-CO')}.`
            : '')
      );
    } catch (err) {
      setErrorAcuerdo(err.message || 'No se pudo registrar el incumplimiento.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="acuerdo-panel" style={{
      background: '#ffffff',
      border: '1px solid #d9d9d9',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '14px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        <div>
          <strong style={{ fontSize: '0.95rem', color: '#1a1a2e' }}>
            🤝 Acuerdo de Solicitud:{' '}
            <Link to={`/solicitudes/${infoChat.solicitudId}`} style={{ color: '#1a5276' }}>
              {infoChat.solicitudTitulo || infoChat.solicitudId}
            </Link>
          </strong>
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
            Tu rol en esta negociación: <strong>{esCliente ? 'Cliente (Solicitante)' : esPrestador ? 'Solucionador (Prestador)' : 'Participante'}</strong>
          </div>
        </div>
        <span className={`badge badge-estado-${estadoAcuerdo}`}>
          {estadoAcuerdo.replace('_', ' ').toUpperCase()}
        </span>
      </div>

      {errorAcuerdo && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '10px' }}>
          ⚠️ {errorAcuerdo}
        </div>
      )}
      {avisoAcuerdo && (
        <div style={{ background: '#dcfce7', color: '#166534', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '10px' }}>
          ✅ {avisoAcuerdo}
        </div>
      )}

      {/* FASE 1: NEGOCIACIÓN */}
      {estadoAcuerdo === 'negociando' && (
        <div>
          <form onSubmit={handleGuardarPropuesta} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', alignItems: 'end', marginBottom: '12px' }}>
            <div className="form-grupo" style={{ marginBottom: 0 }}>
              <label htmlFor="acuerdo-precio">Valor acordado (COP)</label>
              <input
                id="acuerdo-precio"
                type="number"
                min="1000"
                step="500"
                placeholder="Ej: 80000"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                required
              />
            </div>
            <div className="form-grupo" style={{ marginBottom: 0 }}>
              <label htmlFor="acuerdo-fecha">Fecha y hora pactada</label>
              <input
                id="acuerdo-fecha"
                type="datetime-local"
                value={fechaHora}
                onChange={(e) => setFechaHora(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-secundario" disabled={procesando}>
              💾 Actualizar propuesta
            </button>
          </form>

          {precioNum > 0 && (
            <div style={{ fontSize: '0.8rem', color: '#555', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px' }}>
              Desglose al cerrar acuerdo: Custodia cliente <strong>{formatearCOP(precioNum)}</strong> · Comisión plataforma (8%): <strong>{formatearCOP(comisionEst)}</strong> · Neto solucionador (92%): <strong>{formatearCOP(netoEst)}</strong>
            </div>
          )}

          {/* Validación previa de comunicación */}
          <div style={{ fontSize: '0.8rem', padding: '8px 12px', borderRadius: '6px', background: ambosEnviaronMensaje ? '#f0fdf4' : '#fffbeb', border: `1px solid ${ambosEnviaronMensaje ? '#bbf7d0' : '#fde68a'}`, marginBottom: '10px' }}>
            <strong>Validación previa:</strong>{' '}
            Cliente envió mensaje: {infoChat.clientHasMessaged ? '✅' : '⏳'} &nbsp;|&nbsp;
            Solucionador envió mensaje: {infoChat.providerHasMessaged ? '✅' : '⏳'}
            {!ambosEnviaronMensaje && (
              <div style={{ color: '#92400e', marginTop: '4px' }}>
                El botón de confirmar compromiso se habilitará cuando ambas partes hayan enviado al menos un mensaje en este chat.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '0.82rem', color: '#444' }}>
              Confirmación Cliente: <strong>{infoChat.clientConfirmed ? '✅ Confirmado' : '⏳ Pendiente'}</strong> ·
              Confirmación Solucionador: <strong>{infoChat.providerConfirmed ? '✅ Confirmado' : '⏳ Pendiente'}</strong>
            </div>
            <button
              type="button"
              className="btn-principal"
              disabled={
                !ambosEnviaronMensaje ||
                !infoChat.agreedPrice ||
                !infoChat.agreedDateTime ||
                miConfirmacion ||
                procesando
              }
              onClick={handleConfirmarCompromiso}
            >
              {miConfirmacion
                ? '✓ Ya confirmaste el compromiso'
                : '🤝 Confirmar compromiso'}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '6px', marginBottom: 0 }}>
            {esCliente
              ? 'Compromiso del cliente: Al confirmar, te comprometes a no contratar a nadie más para esta solicitud y se retendrá el 100% en custodia.'
              : 'Compromiso del solucionador: Al confirmar, te comprometes a cumplir con el trabajo en el valor, fecha y hora pactados.'}
          </p>
        </div>
      )}

      {/* FASE 2: EN PROGRESO / ACORDADA */}
      {(estadoAcuerdo === 'en_progreso' || estadoAcuerdo === 'acordada') && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.85rem' }}>
            <div><strong>Valor en custodia (100%):</strong><br />{formatearCOP(infoChat.escrowAmount || infoChat.agreedPrice)}</div>
            <div><strong>Comisión plataforma (8%):</strong><br />{formatearCOP(infoChat.platformFee || comisionEst)}</div>
            <div><strong>Pago al solucionador (92%):</strong><br />{formatearCOP(infoChat.providerNet || netoEst)}</div>
            <div><strong>Fecha pactada:</strong><br />{infoChat.agreedDateTime ? new Date(infoChat.agreedDateTime).toLocaleString('es-CO') : '—'}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
            <div style={{ fontSize: '0.82rem', color: '#444' }}>
              Trabajo completado — Cliente: <strong>{infoChat.clientCompletedConfirmed ? '✅' : '⏳'}</strong> ·
              Solucionador: <strong>{infoChat.providerCompletedConfirmed ? '✅' : '⏳'}</strong>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-principal"
                disabled={miCompletado || procesando}
                onClick={handleConfirmarCompletado}
              >
                {miCompletado
                  ? '✓ Confirmación de cierre enviada'
                  : '✅ Confirmar trabajo completado'}
              </button>
              <button
                type="button"
                className="btn-peligro btn-sm"
                onClick={() => setMostrarIncumplimiento(!mostrarIncumplimiento)}
              >
                ⚠️ Reportar incumplimiento / Cancelar
              </button>
            </div>
          </div>

          {mostrarIncumplimiento && (
            <form onSubmit={handleIncumplimiento} style={{ marginTop: '10px', padding: '12px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '6px' }}>
              <strong style={{ color: '#991b1b', fontSize: '0.875rem', display: 'block', marginBottom: '6px' }}>
                Registro de incumplimiento o cancelación unilateral
              </strong>
              <p style={{ fontSize: '0.78rem', color: '#7f1d1d', marginBottom: '8px' }}>
                1.ª y 2.ª falta: multa de $5.000 COP. 3.ª falta en adelante: multa de $10.000 COP + suspensión automática de 7 días.
              </p>
              <div className="form-grupo" style={{ marginBottom: '8px' }}>
                <label htmlFor="tipo-falta">Responsable de la falta</label>
                <select id="tipo-falta" value={tipoFalta} onChange={(e) => setTipoFalta(e.target.value)}>
                  <option value="contraparte">Reportar incumplimiento de la contraparte</option>
                  <option value="unilateral">Cancelar unilateralmente (asumir sanción)</option>
                </select>
              </div>
              <div className="form-grupo" style={{ marginBottom: '8px' }}>
                <label htmlFor="motivo-falta">Motivo detallado</label>
                <textarea
                  id="motivo-falta"
                  rows={2}
                  required
                  placeholder="Describe el incumplimiento o motivo de cancelación…"
                  value={motivoFalta}
                  onChange={(e) => setMotivoFalta(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn-peligro btn-sm" disabled={procesando}>
                  Confirmar registro de falta
                </button>
                <button type="button" className="btn-secundario btn-sm" onClick={() => setMostrarIncumplimiento(false)}>
                  Cerrar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* FASE 3: COMPLETADA / INCUMPLIDA */}
      {estadoAcuerdo === 'completada' && (
        <div style={{ fontSize: '0.85rem', color: '#166534', background: '#f0fdf4', padding: '10px 12px', borderRadius: '6px' }}>
          🎉 Servicio completado y liquidado: <strong>{formatearCOP(infoChat.providerNet || netoEst)}</strong> transferidos al solucionador (92%) y <strong>{formatearCOP(infoChat.platformFee || comisionEst)}</strong> de comisión (8%).{' '}
          <Link to="/billetera" style={{ fontWeight: 600 }}>Ver comprobante en Billetera →</Link>
        </div>
      )}

      {estadoAcuerdo === 'incumplida' && (
        <div style={{ fontSize: '0.85rem', color: '#991b1b', background: '#fef2f2', padding: '10px 12px', borderRadius: '6px' }}>
          ⛔ Acuerdo cerrado por incumplimiento: {infoChat.breachReason || 'Se aplicó la penalización correspondiente.'}
        </div>
      )}
    </div>
  );
}
