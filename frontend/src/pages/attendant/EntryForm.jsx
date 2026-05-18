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
  const [capacityPct,   setCapacityPct]   = useState(null);
  const [slotCounts,    setSlotCounts]    = useState({});

  const phoneRef = useRef(null);

  /* load destinations from backend */
  useEffect(() => {
    api.get('/api/destinations')
      .then(({ data }) => setDestinations(data))
      .catch(() => setDestinations([]));
  }, []);

  /* load slot capacity */
  useEffect(() => {
    api.get('/api/slots')
      .then(({ data }) => {
        const slots = Array.isArray(data) ? data : [];
        const total    = slots.length;
        const occupied = slots.filter((s) => s.status === 'OCCUPIED').length;
        if (total > 0) setCapacityPct(Math.round((occupied / total) * 100));
        /* per-destination available counts */
        const counts = {};
        slots.forEach((s) => {
          if (!counts[s.destinationId]) counts[s.destinationId] = { total: 0, available: 0 };
          counts[s.destinationId].total++;
          if (s.status === 'AVAILABLE') counts[s.destinationId].available++;
        });
        setSlotCounts(counts);
      })
      .catch(() => {});
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

  const handlePlateChange = (e) => {
    const v = e.target.value.toUpperCase();
    setPlate(v);
    setErrors((p) => ({ ...p, plate: '' }));
    checkDuplicate(v);
  };

  const handlePlateKey = (e) => { if (e.key === 'Enter') phoneRef.current?.focus(); };
  const handlePhoneKey = (e) => { if (e.key === 'Enter') phoneRef.current?.blur(); };

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

  /* derive current step */
  const currentStep = confirmed ? 3 : destId && nearestSlot ? 2 : plate.trim() ? 1 : 0;

  const steps = [
    { label: 'Vehicle Details', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
    { label: 'Destination',     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
    { label: 'Confirmed',       icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> },
  ];

  return (
    <div className="page-content">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Step progress indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          {steps.map((step, i) => {
            const done   = i < currentStep;
            const active = i === currentStep;
            return (
              <>
                {/* step circle */}
                <div key={step.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? 'var(--color-available)' : active ? 'var(--brand-primary)' : 'var(--gray-100)',
                    color: done || active ? '#fff' : 'var(--gray-400)',
                    border: `2px solid ${done ? 'var(--color-available)' : active ? 'var(--brand-primary)' : 'var(--gray-200)'}`,
                    transition: 'all 0.3s ease',
                    boxShadow: active ? '0 0 0 4px var(--brand-primary-lt)' : 'none',
                  }}>
                    {done
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      : step.icon
                    }
                  </div>
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: active || done ? 600 : 400,
                    color: done ? 'var(--color-available)' : active ? 'var(--brand-primary)' : 'var(--gray-400)',
                    whiteSpace: 'nowrap',
                  }}>{step.label}</span>
                </div>
                {/* connector line */}
                {i < steps.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, marginBottom: 22,
                    background: i < currentStep ? 'var(--color-available)' : 'var(--gray-200)',
                    transition: 'background 0.3s ease',
                    margin: '0 var(--space-2) 22px',
                  }} />
                )}
              </>
            );
          })}
        </div>

        {/* capacity warning banner */}
        {capacityPct !== null && capacityPct >= 80 && !confirmed && (
          <div style={{
            background: capacityPct >= 95
              ? 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-4) var(--space-5)',
            marginBottom: 'var(--space-4)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            boxShadow: capacityPct >= 95
              ? '0 4px 16px rgba(220,38,38,0.3)'
              : '0 4px 16px rgba(217,119,6,0.3)',
            animation: 'slideDown 0.3s ease',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#fff' }}>
                {capacityPct >= 95 ? 'Parking Almost Full!' : 'Parking Filling Up'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                {capacityPct}% occupied — {capacityPct >= 95 ? 'very limited slots remaining' : 'limited slots available'}
              </div>
            </div>
            {/* capacity bar */}
            <div style={{ width: 80, flexShrink: 0 }}>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', textAlign: 'right', marginBottom: 3 }}>{capacityPct}%</div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${capacityPct}%`,
                  background: '#fff', borderRadius: 'var(--radius-full)',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          </div>
        )}

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
              <div style={{
                background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-4) var(--space-5)',
                marginBottom: 'var(--space-4)',
                boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
                animation: 'slideDown 0.3s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#fff' }}>Duplicate Plate Detected</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>
                      This plate already has an active session
                    </div>
                  </div>
                </div>
                {/* existing session details */}
                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-3)',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)',
                }}>
                  {[
                    ['Plate',    plate,                    true],
                    ['Slot',     dupSession.slotId,        true],
                    ['Dest',     dupSession.destinationName, false],
                    ['Since',    dupSession.entryTime ? new Date(dupSession.entryTime).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—', false],
                  ].map(([k, v, mono]) => (
                    <div key={k}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{k}</div>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#fff', fontFamily: mono ? 'var(--font-mono)' : undefined }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.7)', marginTop: 'var(--space-3)', fontStyle: 'italic' }}>
                  Only proceed if this is a different vehicle with the same plate.
                </div>
              </div>
            )}

            {/* plate input */}
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Plate Number <span className="required">*</span></label>
              
              {/* Uganda plate styled input */}
              <div style={{
                background: errors.plate ? 'var(--color-occupied-lt)' : '#FCD34D',
                border: `3px solid ${errors.plate ? 'var(--color-occupied)' : '#D97706'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-2) var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
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
                  className={errors.plate ? 'error' : ''}
                  value={plate}
                  onChange={handlePlateChange}
                  onKeyDown={handlePlateKey}
                  placeholder="UA 123B"
                  disabled={confirmed}
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
              {errors.plate && <div className="form-error">{errors.plate}</div>}

              {/* recent plates chips */}
              {recentPlates.length > 0 && !confirmed && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', alignSelf: 'center' }}>Recent:</span>
                  {recentPlates.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setPlate(p); setErrors((e) => ({ ...e, plate: '' })); checkDuplicate(p); }}
                      style={{ padding: '2px 10px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 600, background: '#FCD34D', border: '1.5px solid #D97706', borderRadius: 'var(--radius-full)', cursor: 'pointer', color: '#1a1a1a' }}
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

            {/* destination cards */}
            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label">Destination <span className="required">*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
                {destinations.map((d) => {
                  const id       = d._id || d.id;
                  const counts   = slotCounts[id] || { total: 0, available: 0 };
                  const pct      = counts.total ? Math.round((counts.available / counts.total) * 100) : 0;
                  const dotColor = counts.available === 0 ? 'var(--color-occupied)' : pct < 30 ? 'var(--color-warning)' : 'var(--color-available)';
                  const isSelected = destId === id;
                  const isFull     = counts.available === 0;
                  return (
                    <button
                      key={id}
                      disabled={confirmed || isFull}
                      onClick={() => {
                        setDestId(id);
                        setErrors((p) => ({ ...p, dest: '' }));
                        previewSlot(id);
                      }}
                      style={{
                        textAlign: 'left',
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-lg)',
                        border: `2px solid ${isSelected ? 'var(--brand-primary)' : 'var(--gray-200)'}`,
                        background: isSelected ? 'var(--brand-primary-lt)' : isFull ? 'var(--gray-50)' : 'var(--surface-card)',
                        cursor: isFull || confirmed ? 'not-allowed' : 'pointer',
                        opacity: isFull ? 0.5 : 1,
                        transition: 'all var(--transition-fast)',
                        boxShadow: isSelected ? '0 0 0 3px rgba(26,86,219,0.12)' : 'var(--shadow-xs)',
                      }}
                    >
                      {/* top row: dot + name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: dotColor,
                          boxShadow: `0 0 0 2px ${dotColor}30`,
                        }} />
                        <span style={{
                          fontSize: 'var(--text-xs)', fontWeight: 700,
                          color: isSelected ? 'var(--brand-primary)' : 'var(--gray-800)',
                          lineHeight: 1.3,
                        }}>{d.name}</span>
                      </div>
                      {/* bottom row: available count + mini bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--gray-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: dotColor,
                            borderRadius: 'var(--radius-full)',
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: dotColor, flexShrink: 0 }}>
                          {isFull ? 'Full' : `${counts.available} free`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {errors.dest && <div className="form-error" style={{ marginTop: 'var(--space-2)' }}>{errors.dest}</div>}
            </div>

            {/* slot preview */}
            {destId && !confirmed && (
              loadingSlot ? (
                <div className="skeleton" style={{ height: 90, borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-4)' }} />
              ) : nearestSlot ? (
                <div style={{
                  marginBottom: 'var(--space-4)',
                  background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dk) 100%)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-5)',
                  boxShadow: '0 8px 24px rgba(26,86,219,0.25)',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* background decoration */}
                  <div style={{
                    position: 'absolute', top: -20, right: -20,
                    width: 120, height: 120, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: -30, right: 40,
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)',
                  }} />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                    {/* left: label + slot number */}
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                        Nearest Available Slot
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '2.8rem',
                        fontWeight: 900,
                        color: '#fff',
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                        textShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}>
                        {nearestSlot.slotId}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.7)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        {dest?.name}
                      </div>
                    </div>

                    {/* right: pulsing slot badge */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.15)',
                        border: '2px solid rgba(255,255,255,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'pulse-dot 2s ease-in-out infinite',
                      }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5">
                          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* bottom: available count for zone */}
                  <div style={{
                    marginTop: 'var(--space-4)',
                    paddingTop: 'var(--space-3)',
                    borderTop: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.7)',
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
                    Slot assigned — barrier will open on confirm
                  </div>
                </div>
              ) : (
                <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>No available slots near this destination.</div>
              )
            )}

            {/* confirmed summary */}
            {confirmed && session && (
              <>
                {/* success banner */}
                <div style={{
                  background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-6)',
                  marginBottom: 'var(--space-4)',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(22,163,74,0.3)',
                  animation: 'slideDown 0.4s ease',
                }}>
                  {/* bg decoration */}
                  <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ position: 'absolute', bottom: -20, left: 20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

                  {/* top: check icon + title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', position: 'relative' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: '#fff' }}>Entry Confirmed!</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                        {new Date().toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                      </div>
                    </div>
                  </div>

                  {/* center: slot number */}
                  <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)', position: 'relative' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Assigned Slot</div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '3.5rem',
                      fontWeight: 900,
                      color: '#fff',
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                      textShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}>
                      {session.slotId}
                    </div>
                  </div>

                  {/* details grid */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    gap: 'var(--space-2)', position: 'relative',
                    background: 'rgba(0,0,0,0.15)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-3)',
                  }}>
                    {[['Plate', session.plateNumber, true], ['Phone', session.driverPhone, false], ['Destination', session.destinationName, false], ['Attendant', user?.name, false]].map(([k, v, mono]) => (
                      <div key={k}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{k}</div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#fff', fontFamily: mono ? 'var(--font-mono)' : undefined }}>{v || '—'}</div>
                      </div>
                    ))}
                  </div>
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
