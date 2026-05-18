import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { getSocket } from './AttendantLayout';
import CameraAnpr from '../../components/CameraAnpr';

const LONG_STAY_HOURS = 6;

function elapsed(entryTime) {
  const ms = Date.now() - new Date(entryTime).getTime();
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
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
  const [searchParams]                = useSearchParams();
  const [plate,       setPlate]       = useState(searchParams.get('plate') || '');
  const [session,     setSession]     = useState(null);
  const [notFound,    setNotFound]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [done,        setDone]        = useState(false);
  const [closedSlot,  setClosedSlot]  = useState('');
  const [barrierOpen, setBarrierOpen] = useState(false);
  const [plateError,  setPlateError]  = useState('');
  const [recentActive,setRecentActive]= useState([]);
  const [forceConfirm,setForceConfirm]= useState(false);
  const [submitError, setSubmitError] = useState('');

  /* load recent active sessions */
  const loadRecent = useCallback(async () => {
    try {
      const { data } = await api.get('/api/sessions?status=ACTIVE&limit=5');
      setRecentActive(Array.isArray(data) ? data.slice(0, 5) : []);
    } catch { setRecentActive([]); }
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  /* if plate pre-filled from URL */
  useEffect(() => {
    if (plate) lookupSession(plate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* socket: listen for ANPR events from hardware scanner */
  useEffect(() => {
    const s = getSocket();
    const onAnpr = ({ camera, plate: p }) => {
      if (camera === 'exit') {
        setPlate(p);
        setDone(false); setBarrierOpen(false);
        lookupSession(p);
      }
    };
    s.on('anpr_plate_read', onAnpr);
    return () => s.off('anpr_plate_read', onAnpr);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lookupSession = useCallback(async (p) => {
    const trimmed = p.trim();
    if (!trimmed) { setSession(null); setNotFound(false); return; }
    try {
      const { data } = await api.get(`/api/sessions/active?plate=${encodeURIComponent(trimmed)}`);
      setSession(data); setNotFound(false);
    } catch (err) {
      setSession(null);
      setNotFound(err.response?.status === 404);
    }
  }, []);

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
    setSubmitError('');
    try {
      await api.patch(`/api/sessions/${session._id}/exit`);
      setClosedSlot(session.slotId);
      setTimeout(() => setBarrierOpen(true), 100);
      setDone(true); setSession(null);
      loadRecent();
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to process exit.');
    } finally { setLoading(false); }
  };

  const confirmForce = async () => {
    setForceConfirm(false);
    setClosedSlot('—');
    setTimeout(() => setBarrierOpen(true), 100);
    setDone(true);
    api.post('/api/barrier-logs/force', {
      plate: plate.trim(),
      note: 'Manual override — no active session',
    }).catch(() => {});
  };

  const reset = () => {
    setPlate(''); setSession(null); setNotFound(false);
    setDone(false); setBarrierOpen(false); setPlateError(''); setClosedSlot('');
    setSubmitError('');
    loadRecent();
  };

  return (
    <div className="page-content">
      {forceConfirm && (
        <ConfirmModal
          title="Force Open Barrier"
          text={`No active session found for "${plate}". Open the exit barrier manually anyway? This will be logged.`}
          okLabel="Force Open"
          okClass="btn-danger"
          onOk={confirmForce}
          onCancel={() => setForceConfirm(false)}
        />
      )}

      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* recently entered vehicles */}
        {recentActive.length > 0 && !done && (
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-available)', boxShadow: '0 0 6px var(--color-available)', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
                <div className="card-title" style={{ fontSize: 'var(--text-sm)' }}>Active Vehicles</div>
              </div>
              <span className="badge badge-occupied">{recentActive.length} in lot</span>
            </div>
            <div style={{ padding: 'var(--space-3) var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-2)' }}>
              {recentActive.map((s) => {
                const longStay = elapsedHours(s.entryTime) >= LONG_STAY_HOURS;
                const isSelected = plate === s.plateNumber;
                return (
                  <button
                    key={s._id}
                    onClick={() => { setPlate(s.plateNumber); lookupSession(s.plateNumber); }}
                    style={{
                      textAlign: 'left',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-lg)',
                      border: `2px solid ${
                        isSelected ? 'var(--brand-primary)'
                        : longStay ? 'var(--color-warning)'
                        : 'var(--gray-200)'
                      }`,
                      background: isSelected ? 'var(--brand-primary-lt)' : longStay ? 'var(--color-warning-lt)' : 'var(--surface-card)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      boxShadow: isSelected ? '0 0 0 3px rgba(26,86,219,0.12)' : 'var(--shadow-xs)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* colored top border */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                      background: isSelected ? 'var(--brand-primary)' : longStay ? 'var(--color-warning)' : 'var(--gray-200)',
                    }} />
                    {/* plate */}
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 800,
                      fontSize: 'var(--text-sm)', color: isSelected ? 'var(--brand-primary)' : 'var(--gray-900)',
                      marginBottom: 4, marginTop: 4,
                    }}>{s.plateNumber}</div>
                    {/* slot */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                      </svg>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--brand-primary)' }}>{s.slotId}</span>
                    </div>
                    {/* duration */}
                    <div style={{
                      fontSize: '0.65rem', fontWeight: longStay ? 700 : 500,
                      color: longStay ? 'var(--color-warning)' : 'var(--gray-400)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {longStay && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                      )}
                      {elapsed(s.entryTime)}
                    </div>
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
                      setPlate(p); setPlateError('');
                      setDone(false); lookupSession(p);
                    }}
                  />
                </div>
              )}

              {/* plate input */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label className="form-label">Plate Number <span className="required">*</span></label>
                <div style={{
                  background: plateError ? 'var(--color-occupied-lt)' : '#FCD34D',
                  border: `3px solid ${plateError ? 'var(--color-occupied)' : '#D97706'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-2) var(--space-4)',
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  boxShadow: '0 4px 12px rgba(217,119,6,0.2)',
                  transition: 'all var(--transition-fast)',
                }}>
                  {/* UG flag strip */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                    {['#000000','#FCD34D','#DC2626','#000000','#DC2626','#FCD34D'].map((c, i) => (
                      <div key={i} style={{ width: 8, height: 5, background: c, borderRadius: 1 }} />
                    ))}
                    <div style={{ fontSize: '0.45rem', fontWeight: 800, color: '#1a1a1a', textAlign: 'center', marginTop: 2, letterSpacing: '0.05em' }}>UG</div>
                  </div>
                  <input
                    className={plateError ? 'error' : ''}
                    value={plate}
                    onChange={handlePlateChange}
                    placeholder="UA 123B"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.75rem',
                      fontWeight: 900,
                      letterSpacing: '0.15em',
                      color: '#1a1a1a',
                      textTransform: 'uppercase',
                      textAlign: 'center',
                    }}
                  />
                </div>
                {plateError && <div className="form-error" style={{ marginTop: 4 }}>{plateError}</div>}
              </div>

              {/* session preview */}
              {session && !done && (
                <div style={{
                  marginBottom: 'var(--space-4)',
                  background: 'linear-gradient(135deg, #1e40af 0%, #1a56db 100%)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-5)',
                  boxShadow: '0 8px 24px rgba(26,86,219,0.25)',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* bg decoration */}
                  <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ position: 'absolute', bottom: -30, right: 40, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

                  {/* header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-4)', position: 'relative' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active Session Found</span>
                  </div>

                  {/* main stats row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', position: 'relative' }}>
                    {/* slot number */}
                    <div>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Slot</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.8rem', fontWeight: 900, color: '#fff', lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                        {session.slotId}
                      </div>
                    </div>
                    {/* duration */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Duration</div>
                      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: elapsedHours(session.entryTime) >= LONG_STAY_HOURS ? '#fbbf24' : '#fff', lineHeight: 1 }}>
                        {elapsed(session.entryTime)}
                      </div>
                      {elapsedHours(session.entryTime) >= LONG_STAY_HOURS && (
                        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#fbbf24', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          Long Stay
                        </div>
                      )}
                    </div>
                    {/* plate */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Plate</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 800, color: '#fff', letterSpacing: '0.1em' }}>
                        {session.plateNumber}
                      </div>
                    </div>
                  </div>

                  {/* details row */}
                  <div style={{
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-3)',
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 'var(--space-2)', position: 'relative',
                  }}>
                    {[['Destination', session.destinationName], ['Entry Time', formatTime(session.entryTime)], ['Attendant', session.attendantName]].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{k}</div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{v || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* not found */}
              {notFound && !done && (
                <div style={{ marginBottom: 'var(--space-4)', animation: 'slideDown 0.3s ease' }}>
                  {/* red banner */}
                  <div style={{
                    background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)',
                    borderRadius: 'var(--radius-xl)',
                    padding: 'var(--space-4) var(--space-5)',
                    marginBottom: 'var(--space-3)',
                    boxShadow: '0 4px 16px rgba(220,38,38,0.25)',
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#fff' }}>No Active Session Found</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                        Plate <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{plate}</span> has no active parking session
                      </div>
                    </div>
                  </div>

                  {/* force open option */}
                  <div style={{
                    border: '1.5px dashed var(--gray-300)',
                    borderRadius: 'var(--radius-xl)',
                    padding: 'var(--space-4)',
                    background: 'var(--gray-50)',
                  }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-500)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      Manual override available
                    </div>
                    <button
                      className="btn btn-outline-gray btn-sm"
                      onClick={() => setForceConfirm(true)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      Force Open Barrier
                    </button>
                    <div style={{ fontSize: '0.65rem', color: 'var(--gray-400)', textAlign: 'center', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                      This action will be logged for audit purposes
                    </div>
                  </div>
                </div>
              )}

              {done && <BarrierWidget open={barrierOpen} />}
              {done && (
                <div style={{
                  background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-6)',
                  marginBottom: 'var(--space-4)',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(220,38,38,0.3)',
                  animation: 'slideDown 0.4s ease',
                }}>
                  {/* bg decoration */}
                  <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ position: 'absolute', bottom: -20, left: 20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

                  {/* top: icon + title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', position: 'relative' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: '#fff' }}>Exit Processed!</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                        {new Date().toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                      </div>
                    </div>
                  </div>

                  {/* center: freed slot */}
                  <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)', position: 'relative' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                      {closedSlot === '—' ? 'Manual Override' : 'Slot Now Available'}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '3.5rem',
                      fontWeight: 900,
                      color: '#fff',
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                      textShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}>
                      {closedSlot}
                    </div>
                  </div>

                  {/* bottom message */}
                  <div style={{
                    background: 'rgba(0,0,0,0.15)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-3)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.8)',
                    position: 'relative',
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', flexShrink: 0 }} />
                    {closedSlot === '—'
                      ? 'Barrier opened manually. No session was closed.'
                      : `Slot ${closedSlot} has been released and is now available for new vehicles.`
                    }
                  </div>
                </div>
              )}

              {submitError && (
                <div style={{
                  background: 'var(--color-occupied-lt)',
                  border: '1px solid var(--color-occupied)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-3) var(--space-4)',
                  marginBottom: 'var(--space-3)',
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  fontSize: 'var(--text-sm)', color: 'var(--color-occupied)', fontWeight: 500,
                  animation: 'slideDown 0.2s ease',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {submitError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button className="btn btn-outline-gray btn-sm" onClick={reset}>Start over</button>
                {!done ? (
                  <button className="btn btn-danger btn-lg" onClick={processExit} disabled={loading || !session}>
                    {loading
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="btn-spinner" />Processing...</span>
                      : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Process Exit</>
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
