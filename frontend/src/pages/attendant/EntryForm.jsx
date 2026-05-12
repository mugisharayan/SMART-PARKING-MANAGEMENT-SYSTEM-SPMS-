import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { getSocket } from './AttendantLayout';
import {
  isDemoMode, demoDestinations, demoNearestSlot,
  demoCreateSession, demoActiveSessionForPlate,
} from '../../lib/demo';
import useAuthStore from '../../store/authStore';

const UGANDA_PHONE    = /^(\+2567\d{8}|07\d{8})$/;
const SAMPLE_PLATES   = ['UAA 123B', 'UBB 456C', 'UCC 789D', 'UDD 321E', 'UEE 654F', 'UGG 147H'];
const RECENT_KEY      = 'pms_recent_plates';
const LONG_STAY_HOURS = 6;

/* ── recent plates helpers ── */
function getRecentPlates() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function pushRecentPlate(plate) {
  const list = [plate, ...getRecentPlates().filter((p) => p !== plate)].slice(0, 4);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
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
        Entry Barrier — {open ? 'Open' : 'Closed'}
      </div>
    </div>
  );
}

export default function EntryForm() {
  const { user }          = useAuthStore();
  const [searchParams]    = useSearchParams();
  const preselectedSlotId = searchParams.get('slotId'); // from LiveMap "Start Entry" button

  /* form fields */
  const [plate,    setPlate]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [destId,   setDestId]   = useState('');
  const [errors,   setErrors]   = useState({});

  /* data */
  const [destinations,  setDestinations]  = useState([]);
  const [nearestSlot,   setNearestSlot]   = useState(null);
  const [loadingSlot,   setLoadingSlot]   = useState(false);
  const [recentPlates,  setRecentPlates]  = useState(getRecentPlates());

  /* ANPR */
  const [anprStatus, setAnprStatus] = useState('idle');
  const [anprPlate,  setAnprPlate]  = useState('');
  const timerRef = useRef(null);

  /* duplicate plate warning */
  const [dupSession, setDupSession] = useState(null);

  /* confirmed state */
  const [loading,      setLoading]      = useState(false);
  const [confirmed,    setConfirmed]    = useState(false);
  const [barrierOpen,  setBarrierOpen]  = useState(false);
  const [session,      setSession]      = useState(null);
  const [notifyStatus, setNotifyStatus] = useState({});

  /* fetch destinations */
  useEffect(() => {
    if (isDemoMode()) { setDestinations(demoDestinations); return; }
    api.get('/api/destinations').then(({ data }) => setDestinations(data)).catch(() => setDestinations(demoDestinations));
  }, []);

  /* ANPR simulation */
  const simulate = useCallback(() => {
    const p = SAMPLE_PLATES[Math.floor(Math.random() * SAMPLE_PLATES.length)];
    setAnprStatus('scanning'); setAnprPlate('');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAnprStatus('captured'); setAnprPlate(p); setPlate(p);
      checkDuplicate(p);
    }, 2000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const s = getSocket();
    const onAnpr = ({ camera, plate: p }) => {
      if (camera === 'entry') { setAnprStatus('captured'); setAnprPlate(p); setPlate(p); checkDuplicate(p); }
    };
    s.on('anpr_plate_read', onAnpr);
    if (isDemoMode()) simulate();
    return () => { s.off('anpr_plate_read', onAnpr); clearTimeout(timerRef.current); };
  }, [simulate]); // eslint-disable-line react-hooks/exhaustive-deps

  /* duplicate check */
  const checkDuplicate = useCallback(async (p) => {
    if (!p.trim()) { setDupSession(null); return; }
    try {
      if (isDemoMode()) {
        setDupSession(demoActiveSessionForPlate(p));
      } else {
        const { data } = await api.get(`/api/sessions/active?plate=${encodeURIComponent(p.trim())}`);
        setDupSession(data || null);
      }
    } catch { setDupSession(null); }
  }, []);

  /* nearest slot preview */
  const previewSlot = useCallback(async (dId) => {
    if (!dId) { setNearestSlot(null); return; }
    setLoadingSlot(true);
    try {
      if (isDemoMode()) { setNearestSlot(demoNearestSlot(dId)); }
      else {
        const { data } = await api.get(`/api/slots/nearest?destinationId=${dId}`);
        setNearestSlot(data);
      }
    } catch { setNearestSlot(demoNearestSlot(dId)); }
    finally { setLoadingSlot(false); }
  }, []);

  const handleDestChange = (e) => {
    setDestId(e.target.value);
    setErrors((p) => ({ ...p, dest: '' }));
    previewSlot(e.target.value);
  };

  const handlePlateChange = (e) => {
    const v = e.target.value.toUpperCase();
    setPlate(v);
    setErrors((p) => ({ ...p, plate: '' }));
    checkDuplicate(v);
  };

  /* keyboard: Enter advances focus */
  const phoneRef = useRef(null);
  const destRef  = useRef(null);
  const handlePlateKey = (e) => { if (e.key === 'Enter') phoneRef.current?.focus(); };
  const handlePhoneKey = (e) => { if (e.key === 'Enter') destRef.current?.focus(); };

  /* confirm */
  const handleConfirm = async () => {
    const errs = {};
    if (!plate.trim())                                    errs.plate = 'Plate number is required.';
    if (!UGANDA_PHONE.test(phone.replace(/\s/g, '')))    errs.phone = 'Enter a valid Ugandan mobile number.';
    if (!destId)                                          errs.dest  = 'Please select a destination.';
    if (!nearestSlot)                                     errs.dest  = 'No available slots near this destination.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const dest = destinations.find((d) => (d._id || d.id) === destId);
      let sess;
      if (isDemoMode()) {
        sess = demoCreateSession({
          plateNumber: plate.trim().toUpperCase().replace(/\s+/g, ' '),
          driverPhone: phone.trim(),
          destinationId: destId,
          slotId: nearestSlot.slotId,
          attendantName: user?.name || 'Attendant',
          attendantId:   user?.id   || 'u2',
        });
      } else {
        const { data } = await api.post('/api/sessions', {
          plateNumber:   plate.trim().toUpperCase().replace(/\s+/g, ' '),
          driverPhone:   phone.trim(),
          destinationId: destId,
          slotId:        nearestSlot.slotId,
        });
        sess = data.session || data;
      }
      pushRecentPlate(plate.trim().toUpperCase().replace(/\s+/g, ' '));
      setRecentPlates(getRecentPlates());
      setSession(sess);
      setTimeout(() => setBarrierOpen(true), 100);
      setConfirmed(true);
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || 'Failed to create session.' });
    } finally {
      setLoading(false);
    }
  };

  const sendNotify = async (channel) => {
    if (!session) return;
    setNotifyStatus((p) => ({ ...p, [channel]: 'sending' }));
    try {
      if (isDemoMode()) { await new Promise((r) => setTimeout(r, 1200)); }
      else { await api.post('/api/notifications/send', { sessionId: session._id, channel }); }
      setNotifyStatus((p) => ({ ...p, [channel]: 'sent' }));
    } catch { setNotifyStatus((p) => ({ ...p, [channel]: 'failed' })); }
  };

  const notifyLabel = (ch) => {
    const s = notifyStatus[ch];
    if (s === 'sending') return 'Sending...';
    if (s === 'sent')    return 'Sent ✓';
    if (s === 'failed')  return 'Retry';
    return ch === 'WHATSAPP' ? 'WhatsApp' : 'SMS';
  };

  const reset = () => {
    setPlate(''); setPhone(''); setDestId(''); setErrors({});
    setNearestSlot(null); setDupSession(null);
    setConfirmed(false); setBarrierOpen(false); setSession(null); setNotifyStatus({});
    setAnprStatus('idle'); setAnprPlate('');
    if (isDemoMode()) simulate();
  };

  const dest = destinations.find((d) => (d._id || d.id) === destId);

  return (
    <div className="page-content">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="page-header">
          <div className="page-title">New Vehicle Entry</div>
          <div className="page-subtitle">Record driver details and assign a parking slot</div>
        </div>

        <div className="card">
          <div className="card-body">

            {/* ANPR box */}
            <div className="anpr-box" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="anpr-scan-line" />
              <div className={`anpr-status ${anprStatus === 'idle' ? 'scanning' : anprStatus}`}>
                {anprStatus === 'scanning' ? 'Scanning...' : anprStatus === 'captured' ? 'Plate Captured' : 'Waiting for camera...'}
              </div>
              {anprPlate && <div className="anpr-plate">{anprPlate}</div>}
            </div>

            {/* duplicate plate warning */}
            {dupSession && !confirmed && (
              <div className="alert alert-warning" style={{ marginBottom: 'var(--space-4)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>
                  <strong>{plate}</strong> already has an active session in slot{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{dupSession.slotId}</strong>.
                  Confirm only if this is a different vehicle.
                </span>
              </div>
            )}

            {/* plate input + simulate (demo only) */}
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Plate Number <span className="required">*</span></label>
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <input
                    className={`input${errors.plate ? ' error' : ''}`}
                    value={plate}
                    onChange={handlePlateChange}
                    onKeyDown={handlePlateKey}
                    placeholder="e.g. UAA 123B"
                    disabled={confirmed}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '0.1em' }}
                  />
                  {errors.plate && <div className="form-error">{errors.plate}</div>}
                </div>
                {/* only visible in demo mode */}
                {isDemoMode() && (
                  <button className="btn btn-outline btn-sm" style={{ marginTop: 2 }} onClick={simulate} disabled={confirmed}>
                    Simulate
                  </button>
                )}
              </div>

              {/* recent plates chips */}
              {recentPlates.length > 0 && !confirmed && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', alignSelf: 'center' }}>Recent:</span>
                  {recentPlates.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setPlate(p); setErrors((e) => ({ ...e, plate: '' })); checkDuplicate(p); }}
                      style={{
                        padding: '2px 10px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 600,
                        background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-full)',
                        cursor: 'pointer', color: 'var(--gray-700)', transition: 'all var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-primary-lt)'; e.currentTarget.style.borderColor = 'var(--brand-primary)'; e.currentTarget.style.color = 'var(--brand-primary)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--gray-100)'; e.currentTarget.style.borderColor = 'var(--gray-200)'; e.currentTarget.style.color = 'var(--gray-700)'; }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* phone */}
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Driver Phone <span className="required">*</span></label>
              <div className="input-wrapper">
                <svg className="input-icon-left" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/>
                </svg>
                <input
                  ref={phoneRef}
                  className={`input has-icon-left${errors.phone ? ' error' : ''}`}
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: '' })); }}
                  onKeyDown={handlePhoneKey}
                  placeholder="+256 7XX XXX XXX or 07XX XXX XXX"
                  disabled={confirmed}
                />
              </div>
              {errors.phone && <div className="form-error">{errors.phone}</div>}
            </div>

            {/* destination */}
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Destination <span className="required">*</span></label>
              <select
                ref={destRef}
                className={`select${errors.dest ? ' error' : ''}`}
                value={destId}
                onChange={handleDestChange}
                disabled={confirmed}
              >
                <option value="">Select destination...</option>
                {destinations.map((d) => (
                  <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>
                ))}
              </select>
              {errors.dest && <div className="form-error">{errors.dest}</div>}
            </div>

            {/* slot preview */}
            {destId && !confirmed && (
              loadingSlot ? (
                <div className="skeleton" style={{ height: 90, borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-4)' }} />
              ) : nearestSlot ? (
                <div className="slot-preview" style={{ marginBottom: 'var(--space-4)' }}>
                  <div className="slot-preview-label">Nearest Available Slot</div>
                  <div className="slot-preview-number">{nearestSlot.slotId}</div>
                  <div className="slot-preview-zone">{dest?.name}</div>
                </div>
              ) : (
                <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>No available slots near this destination.</div>
              )
            )}

            {/* confirmed summary */}
            {confirmed && session && (
              <>
                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
                  {[['Plate', session.plateNumber, true], ['Phone', session.driverPhone], ['Destination', session.destinationName], ['Slot', session.slotId, true]].map(([k, v, mono]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--gray-100)', fontSize: 'var(--text-xs)' }}>
                      <span style={{ color: 'var(--gray-500)' }}>{k}</span>
                      <span style={{ fontWeight: 700, fontFamily: mono ? 'var(--font-mono)' : undefined, color: k === 'Slot' ? 'var(--brand-primary)' : 'var(--gray-900)' }}>{v}</span>
                    </div>
                  ))}
                </div>

                <BarrierWidget open={barrierOpen} />

                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-700)', marginBottom: 'var(--space-3)' }}>Send slot number to driver:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    {['WHATSAPP', 'SMS'].map((ch) => (
                      <button
                        key={ch}
                        className="btn btn-outline"
                        disabled={notifyStatus[ch] === 'sending' || notifyStatus[ch] === 'sent'}
                        onClick={() => sendNotify(ch)}
                        style={{ flexDirection: 'column', height: 68, gap: 'var(--space-2)', borderColor: ch === 'WHATSAPP' && notifyStatus[ch] !== 'sent' ? '#25d366' : undefined, color: ch === 'WHATSAPP' && notifyStatus[ch] !== 'sent' ? '#25d366' : undefined }}
                      >
                        {ch === 'WHATSAPP'
                          ? <svg viewBox="0 0 24 24" fill="#25d366" width="22" height="22"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                          : <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2" width="22" height="22"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        }
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{notifyLabel(ch)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {errors.submit && <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>{errors.submit}</div>}

            {/* actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              {confirmed ? (
                <button className="btn btn-primary btn-lg" onClick={reset}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Entry
                </button>
              ) : (
                <button className="btn btn-success btn-lg" onClick={handleConfirm} disabled={loading || !nearestSlot}>
                  {loading
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="btn-spinner" />Processing...</span>
                    : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Confirm &amp; Open Barrier</>
                  }
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
