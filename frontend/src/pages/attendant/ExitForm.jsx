import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { getSocket } from './AttendantLayout';
import { isDemoMode, demoSessions, demoActiveSessionForPlate, demoCloseSession } from '../../lib/demo';
import CameraAnpr from '../../components/CameraAnpr';

const LONG_STAY_HOURS = 6;

function elapsed(entryTime) {
  const ms = Date.now() - new Date(entryTime).getTime();
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}
function elapsedHours(entryTime) {
  return (Date.now() - new Date(entryTime).getTime()) / 3600000;
}
function formatTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function BarrierWidget({ open }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--space-5)', background: 'var(--gray-50)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--gray-200)', margin: 'var(--space-4) 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 'var(--space-3)' }}>
        <div style={{ width: 14, height: 56, background: 'linear-gradient(180deg,#374151 0%,#1f2937 100%)', borderRadius: '4px 4px 0 0' }} />
        <div className={`barrier-arm${open ? ' open' : ''}`} />
      </div>
      <div style={{ width: 200, height: 8, background: 'var(--gray-300)', borderRadius: 'var(--radius-full)' }} />
      <div className={`barrier-label${open ? ' open-label' : ''}`} style={{ marginTop: 'var(--space-2)' }}>
        Exit Barrier — {open ? 'Open' : 'Closed'}
      </div>
    </div>
  );
}

function ConfirmModal({ title, text, onOk, onCancel, okLabel = 'Confirm', okClass = 'btn-danger' }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onCancel}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-700)', lineHeight: 'var(--leading-relaxed)' }}>{text}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline-gray" onClick={onCancel}>Cancel</button>
          <button className={`btn ${okClass}`} onClick={onOk}>{okLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function ExitForm() {
  const [searchParams]                    = useSearchParams();
  const [plate,       setPlate]           = useState(searchParams.get('plate') || '');
  const [anprStatus,  setAnprStatus]      = useState('idle');
  const [anprPlate,   setAnprPlate]       = useState('');
  const [session,     setSession]         = useState(null);
  const [notFound,    setNotFound]        = useState(false);
  const [loading,     setLoading]         = useState(false);
  const [done,        setDone]            = useState(false);
  const [closedSlot,  setClosedSlot]      = useState('');
  const [barrierOpen, setBarrierOpen]     = useState(false);
  const [plateError,  setPlateError]      = useState('');
  const [recentActive, setRecentActive]   = useState([]);  // 4A: proactive list
  const [forceConfirm, setForceConfirm]   = useState(false); // 4C: force exit modal
  const timerRef = useRef(null);

  /* load recent active sessions for proactive list */
  const loadRecent = useCallback(async () => {
    try {
      if (isDemoMode()) {
        setRecentActive(
          [...demoSessions]
            .filter((s) => s.status === 'ACTIVE')
            .sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime))
            .slice(0, 5)
        );
        return;
      }
      const { data } = await api.get('/api/sessions?status=ACTIVE&limit=5&sort=-entryTime');
      const list = Array.isArray(data) ? data : data.sessions || [];
      setRecentActive(list.slice(0, 5));
    } catch {
      setRecentActive(
        [...demoSessions].filter((s) => s.status === 'ACTIVE').slice(0, 5)
      );
    }
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  const lookupSession = useCallback(async (p) => {
    const trimmed = p.trim();
    if (!trimmed) { setSession(null); setNotFound(false); return; }
    try {
      if (isDemoMode()) {
        const s = demoActiveSessionForPlate(trimmed);
        setSession(s); setNotFound(!s);
      } else {
        const { data } = await api.get(`/api/sessions/active?plate=${encodeURIComponent(trimmed)}`);
        setSession(data); setNotFound(false);
      }
    } catch (err) {
      const s = demoActiveSessionForPlate(trimmed);
      setSession(s); setNotFound(!s && err.response?.status === 404);
    }
  }, []);

  /* if plate pre-filled from history quick-exit link */
  useEffect(() => {
    if (plate) lookupSession(plate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const simulate = useCallback(async () => {
    let activePlates = [];
    if (isDemoMode()) {
      activePlates = demoSessions.filter((s) => s.status === 'ACTIVE').map((s) => s.plateNumber);
    } else {
      try {
        const { data } = await api.get('/api/sessions?status=ACTIVE&limit=20');
        activePlates = (Array.isArray(data) ? data : data.sessions || []).map((s) => s.plateNumber);
      } catch {
        activePlates = demoSessions.filter((s) => s.status === 'ACTIVE').map((s) => s.plateNumber);
      }
    }
    if (!activePlates.length) return;
    const p = activePlates[Math.floor(Math.random() * activePlates.length)];
    setAnprStatus('scanning'); setAnprPlate('');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAnprStatus('captured'); setAnprPlate(p); setPlate(p); lookupSession(p);
    }, 2000);
  }, [lookupSession]);

  useEffect(() => {
    const s = getSocket();
    const onAnpr = ({ camera, plate: p }) => {
      if (camera === 'exit') {
        setAnprStatus('captured'); setAnprPlate(p); setPlate(p);
        setDone(false); setBarrierOpen(false); lookupSession(p);
      }
    };
    s.on('anpr_plate_read', onAnpr);
    if (!plate) simulate();
    return () => { s.off('anpr_plate_read', onAnpr); clearTimeout(timerRef.current); };
  }, [simulate, lookupSession, plate]);

  const handlePlateChange = (e) => {
    const v = e.target.value.toUpperCase();
    setPlate(v); setPlateError('');
    if (done) { setDone(false); setBarrierOpen(false); setSession(null); setNotFound(false); }
    else lookupSession(v);
  };

  const processExit = async () => {
    if (!plate.trim()) { setPlateError('Please enter a plate number.'); return; }
    if (!session) return;
    setLoading(true);
    try {
      if (isDemoMode()) { demoCloseSession(session._id); }
      else { await api.patch(`/api/sessions/${session._id}/exit`); }
      setClosedSlot(session.slotId);
      setTimeout(() => setBarrierOpen(true), 100);
      setDone(true); setSession(null);
      loadRecent();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process exit.');
    } finally { setLoading(false); }
  };

  /* 4C: force exit — open barrier with no session */
  const handleForceExit = () => setForceConfirm(true);
  const confirmForce = async () => {
    setForceConfirm(false);
    setClosedSlot('—');
    setTimeout(() => setBarrierOpen(true), 100);
    setDone(true);
    /* log a barrier-only event if API available */
    if (!isDemoMode()) {
      api.post('/api/barrier-logs/force', { plate: plate.trim(), note: 'Manual override — no active session' }).catch(() => {});
    }
  };

  const reset = () => {
    setPlate(''); setAnprStatus('idle'); setAnprPlate('');
    setSession(null); setNotFound(false); setDone(false);
    setBarrierOpen(false); setPlateError(''); setClosedSlot('');
    simulate(); loadRecent();
  };

  return (
    <div className="page-content">
      {forceConfirm && (
        <ConfirmModal
          title="Force Open Barrier"
          text={`No active session found for "${plate}". Open the exit barrier manually anyway? This will be logged as a manual override.`}
          okLabel="Force Open"
          okClass="btn-danger"
          onOk={confirmForce}
          onCancel={() => setForceConfirm(false)}
        />
      )}

      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="page-header">
          <div className="page-title">Process Vehicle Exit</div>
          <div className="page-subtitle">Look up the active session and release the slot</div>
        </div>

        {/* 4A: proactive recent vehicles */}
        {recentActive.length > 0 && !done && (
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="card-header" style={{ padding: 'var(--space-3) var(--space-5)' }}>
              <div className="card-title" style={{ fontSize: 'var(--text-sm)' }}>Recently Entered — tap to select</div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-5)', overflowX: 'auto', flexWrap: 'wrap' }}>
              {recentActive.map((s) => {
                const longStay = elapsedHours(s.entryTime) >= LONG_STAY_HOURS;
                return (
                  <button
                    key={s._id || s.id}
                    onClick={() => { setPlate(s.plateNumber); setAnprStatus('captured'); setAnprPlate(s.plateNumber); lookupSession(s.plateNumber); }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)',
                      border: `1.5px solid ${longStay ? 'var(--color-warning)' : 'var(--gray-200)'}`,
                      background: longStay ? 'var(--color-warning-lt)' : 'var(--gray-50)',
                      cursor: 'pointer', transition: 'all var(--transition-fast)', minWidth: 120,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.background = 'var(--brand-primary-lt)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = longStay ? 'var(--color-warning)' : 'var(--gray-200)'; e.currentTarget.style.background = longStay ? 'var(--color-warning-lt)' : 'var(--gray-50)'; }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--gray-900)' }}>{s.plateNumber}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginTop: 2 }}>
                      Slot <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)' }}>{s.slotId}</strong>
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: longStay ? 'var(--color-warning)' : 'var(--gray-400)', marginTop: 2, fontWeight: longStay ? 700 : 400 }}>
                      {elapsed(s.entryTime)}{longStay ? ' ⚠' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-body">
            <div style={{ maxWidth: 480, margin: '0 auto' }}>

              {/* Camera ANPR */}
              {!done && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <CameraAnpr
                    camera="exit"
                    onPlateDetected={(p) => {
                      setPlate(p);
                      setPlateError('');
                      setDone(false);
                      lookupSession(p);
                    }}
                  />
                </div>
              )}

              {/* Demo simulate — only in demo mode */}
              {isDemoMode() && !done && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
                  <button className="btn btn-outline btn-sm" onClick={simulate}>Simulate ANPR (Demo)</button>
                </div>
              )}

              {/* plate input */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Plate Number <span className="required">*</span></label>
                <input
                  className={`input${plateError ? ' error' : ''}`}
                  value={plate}
                  onChange={handlePlateChange}
                  placeholder="e.g. UA 123B, UAA 123B, UG 1234, H4DF 001"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '0.1em' }}
                />
              </div>
              {plateError && <div className="form-error" style={{ marginTop: -12, marginBottom: 'var(--space-3)' }}>{plateError}</div>}

              {/* session preview */}
              {session && !done && (
                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-700)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="status-dot occupied" /> Active Session Found
                  </div>
                  {/* critical info large */}
                  <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-400)', marginBottom: 2 }}>Plate</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--gray-900)' }}>{session.plateNumber}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-400)', marginBottom: 2 }}>Slot</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--brand-primary)' }}>{session.slotId}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-400)', marginBottom: 2 }}>Duration</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--color-occupied)' }}>{elapsed(session.entryTime)}</span>
                        {/* 4B: long-stay warning */}
                        {elapsedHours(session.entryTime) >= LONG_STAY_HOURS && (
                          <span className="badge badge-warning" style={{ fontSize: '0.6rem' }}>Long stay</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* secondary info small */}
                  {[
                    ['Destination', session.destinationName],
                    ['Entry Time',  formatTime(session.entryTime)],
                    ['Attendant',   session.attendantName],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderTop: '1px solid var(--gray-100)', fontSize: 'var(--text-xs)' }}>
                      <span style={{ color: 'var(--gray-400)' }}>{k}</span>
                      <span style={{ color: 'var(--gray-600)', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* not found */}
              {notFound && !done && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <div className="alert alert-danger" style={{ marginBottom: 'var(--space-3)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    No active session found for <strong>{plate}</strong>. Barrier remains closed.
                  </div>
                  {/* 4C: force exit */}
                  <button className="btn btn-outline-gray btn-sm" onClick={handleForceExit} style={{ width: '100%' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    Force Open Barrier (manual override)
                  </button>
                </div>
              )}

              {/* barrier + success */}
              {done && <BarrierWidget open={barrierOpen} />}
              {done && (
                <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {closedSlot === '—'
                    ? 'Barrier opened manually. No session was closed.'
                    : <>Session closed. Slot <strong>{closedSlot}</strong> is now available.</>
                  }
                </div>
              )}

              {/* actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button className="btn btn-outline-gray btn-sm" onClick={reset} style={{ alignSelf: 'center' }}>
                  Start over
                </button>
                {!done ? (
                  <button className="btn btn-danger btn-lg" onClick={processExit} disabled={loading || !session}>
                    {loading
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="btn-spinner" />Processing...</span>
                      : <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                          </svg>
                          Process Exit
                        </>
                    }
                  </button>
                ) : (
                  <button className="btn btn-primary btn-lg" onClick={reset}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Exit
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
