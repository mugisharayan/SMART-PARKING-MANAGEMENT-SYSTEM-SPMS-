import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../lib/api';
import { getSocket } from './AttendantLayout';
import useAuthStore from '../../store/authStore';
import CameraAnpr from '../../components/CameraAnpr';

const UGANDA_PHONE = /^(\+2567\d{8}|07\d{8})$/;
const RECENT_KEY   = 'pms_recent_plates';

function isValidPlate(plate) {
  const p = plate.toUpperCase().replace(/\s+/g, ' ').trim();
  return (
    /^U[A-Z] \d{3}[A-Z]$/.test(p)       ||
    /^U[A-Z]{2} \d{3}[A-Z]$/.test(p)    ||
    /^H4DF \d{3}$/.test(p)              ||
    /^UG \d{3,4}( [A-Z])?$/.test(p)     ||
    /^LG \d{3,4}$/.test(p)              ||
    /^UP \d{3,4}$/.test(p)              ||
    /^TG \d{3,4}$/.test(p)              ||
    /^C[DC] \d{2,6}( U)?$/.test(p)      ||
    /^[A-Z0-9]{3,7}$/.test(p.replace(/\s/g, ''))
  );
}

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
  const { user }       = useAuthStore();
  const [searchParams] = useSearchParams();

  const [plate,         setPlate]         = useState('');
  const [phone,         setPhone]         = useState('');
  const [destId,        setDestId]        = useState('');
  const [errors,        setErrors]        = useState({});
  const [destinations,  setDestinations]  = useState([]);
  const [nearestSlot,   setNearestSlot]   = useState(null);
  const [loadingSlot,   setLoadingSlot]   = useState(false);
  const [recentPlates,  setRecentPlates]  = useState(getRecentPlates());
  const [dupSession,    setDupSession]    = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [confirmed,     setConfirmed]     = useState(false);
  const [barrierOpen,   setBarrierOpen]   = useState(false);
  const [session,       setSession]       = useState(null);
  const [notifyStatus,  setNotifyStatus]  = useState({});

  const phoneRef = useRef(null);
  const destRef  = useRef(null);

  /* load destinations from backend */
  useEffect(() => {
    api.get('/api/destinations')
      .then(({ data }) => setDestinations(data))
      .catch(() => setDestinations([]));
  }, []);

  /* socket: listen for ANPR events from hardware scanner */
  useEffect(() => {
    const s = getSocket();
    const onAnpr = ({ camera, plate: p }) => {
      if (camera === 'entry') {
        setPlate(p);
        checkDuplicate(p);
      }
    };
    s.on('anpr_plate_read', onAnpr);
    return () => s.off('anpr_plate_read', onAnpr);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkDuplicate = useCallback(async (p) => {
    if (!p.trim()) { setDupSession(null); return; }
    try {
      const { data } = await api.get(`/api/sessions/active?plate=${encodeURIComponent(p.trim())}`);
      setDupSession(data || null);
    } catch { setDupSession(null); }
  }, []);

  const previewSlot = useCallback(async (dId) => {
    if (!dId) { setNearestSlot(null); return; }
    setLoadingSlot(true);
    try {
      const { data } = await api.get(`/api/slots/nearest?destinationId=${dId}`);
      setNearestSlot(data);
    } catch { setNearestSlot(null); }
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

  const handlePlateKey = (e) => { if (e.key === 'Enter') phoneRef.current?.focus(); };
  const handlePhoneKey = (e) => { if (e.key === 'Enter') destRef.current?.focus(); };

  const handleConfirm = async () => {
    const errs = {};
    if (!plate.trim())                                 errs.plate = 'Plate number is required.';
    else if (!isValidPlate(plate))                     errs.plate = 'Enter a valid Uganda plate (e.g. UA 123B, UAA 123B, UG 1234, H4DF 001).';
    if (!UGANDA_PHONE.test(phone.replace(/\s/g, ''))) errs.phone = 'Enter a valid Ugandan mobile number.';
    if (!destId)                                       errs.dest  = 'Please select a destination.';
    if (!nearestSlot)                                  errs.dest  = 'No available slots near this destination.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const { data } = await api.post('/api/sessions', {
        plateNumber:   plate.trim().toUpperCase().replace(/\s+/g, ' '),
        driverPhone:   phone.trim(),
        destinationId: destId,
        slotId:        nearestSlot.slotId,
      });
      const sess = data.session || data;
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

            {/* Camera ANPR */}
            {!confirmed && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <CameraAnpr
                  camera="entry"
                  onPlateDetected={(p) => {
                    setPlate(p);
                    setErrors((e) => ({ ...e, plate: '' }));
                    checkDuplicate(p);
                  }}
                />
              </div>
            )}

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

            {/* plate input */}
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Plate Number <span className="required">*</span></label>
              <input
                className={`input${errors.plate ? ' error' : ''}`}
                value={plate}
                onChange={handlePlateChange}
                onKeyDown={handlePlateKey}
                placeholder="e.g. UA 123B, UAA 123B, UG 1234, H4DF 001"
                disabled={confirmed}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '0.1em' }}
              />
              {errors.plate && <div className="form-error">{errors.plate}</div>}

              {/* recent plates chips */}
              {recentPlates.length > 0 && !confirmed && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', alignSelf: 'center' }}>Recent:</span>
                  {recentPlates.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setPlate(p); setErrors((e) => ({ ...e, plate: '' })); checkDuplicate(p); }}
                      style={{ padding: '2px 10px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 600, background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-full)', cursor: 'pointer', color: 'var(--gray-700)' }}
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
              </>
            )}

            {errors.submit && <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>{errors.submit}</div>}

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
