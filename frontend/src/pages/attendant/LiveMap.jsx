import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../lib/api';
import { getSocket } from './AttendantLayout';
import { isDemoMode, demoSlots, demoSessions, applyPersistedPositions } from '../../lib/demo';

/* ── helpers ── */
function elapsed(entryTime) {
  const ms = Date.now() - new Date(entryTime).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

const STATUS_COLOR  = { AVAILABLE: '#16a34a', OCCUPIED: '#dc2626', OUT_OF_SERVICE: '#6b7280' };
const STATUS_SHADOW = { AVAILABLE: 'rgba(22,163,74,.45)', OCCUPIED: 'rgba(220,38,38,.45)', OUT_OF_SERVICE: 'rgba(107,114,128,.35)' };

function makeIcon(slot) {
  const fill   = STATUS_COLOR[slot.status]  || '#6b7280';
  const shadow = STATUS_SHADOW[slot.status] || 'rgba(107,114,128,.35)';
  const pulse  = slot.status === 'AVAILABLE'
    ? `<circle cx="14" cy="14" r="13" fill="none" stroke="${fill}" stroke-width="2" opacity="0.35">
         <animate attributeName="r" from="10" to="18" dur="1.8s" repeatCount="indefinite"/>
         <animate attributeName="opacity" from="0.5" to="0" dur="1.8s" repeatCount="indefinite"/>
       </circle>`
    : '';
  const pinPath = 'M14,2 C8.477,2 4,6.477 4,12 C4,19.5 14,34 14,34 C14,34 24,19.5 24,12 C24,6.477 19.523,2 14,2 Z';
  const label   = slot.slotId.length > 2
    ? `<text x="14" y="14.5" text-anchor="middle" dominant-baseline="middle" font-size="5.5" font-weight="800" fill="#fff" font-family="'JetBrains Mono',monospace" letter-spacing="-0.3">${slot.slotId}</text>`
    : `<text x="14" y="14" text-anchor="middle" dominant-baseline="middle" font-size="7" font-weight="800" fill="#fff" font-family="'JetBrains Mono',monospace">${slot.slotId}</text>`;
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:28px;height:36px;filter:drop-shadow(0 3px 6px ${shadow});cursor:pointer">
      <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
        ${pulse}
        <path d="${pinPath}" fill="${fill}" stroke="rgba(255,255,255,0.6)" stroke-width="1.2"/>
        <circle cx="14" cy="12" r="5.5" fill="rgba(255,255,255,0.2)"/>
        ${label}
      </svg>
    </div>`,
    iconSize:    [28, 36],
    iconAnchor:  [14, 36],
    popupAnchor: [0, -36],
  });
}

/* ── Markers layer — only re-creates markers when slots array identity changes;
      updates individual icons on session/status changes without full redraw ── */
function MarkersLayer({ slots, sessions, onSlotClick, searchTerm, statusFilter }) {
  const map        = useMap();
  const markersRef = useRef({});
  const slotsRef   = useRef(slots);
  const sessionsRef = useRef(sessions);

  const sessionForSlot = useCallback(
    (slotId) => sessionsRef.current.find((s) => s.slotId === slotId && s.status === 'ACTIVE'),
    []
  );

  /* initial render + slot list changes — full rebuild */
  useEffect(() => {
    slotsRef.current = slots;
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};
    slots.forEach((slot) => {
      const session = sessionForSlot(slot.slotId);
      const marker  = L.marker([slot.lat, slot.lng], { icon: makeIcon(slot) }).addTo(map);
      marker.on('click', () => onSlotClick(slot, sessionForSlot(slot.slotId)));
      markersRef.current[slot.slotId] = marker;
    });
    return () => {
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};
    };
  }, [slots, map, onSlotClick, sessionForSlot]);

  /* sessions change — only update icons of affected slots, no full redraw */
  useEffect(() => {
    sessionsRef.current = sessions;
    slotsRef.current.forEach((slot) => {
      const marker = markersRef.current[slot.slotId];
      if (!marker) return;
      const session = sessionForSlot(slot.slotId);
      marker.setIcon(makeIcon(slot));
    });
  }, [sessions, sessionForSlot]);

  /* search + status filter */
  useEffect(() => {
    const t = searchTerm.trim().toUpperCase();
    Object.entries(markersRef.current).forEach(([slotId, marker]) => {
      const slot        = slotsRef.current.find((s) => s.slotId === slotId);
      const matchSearch = !t || slotId.includes(t);
      const matchFilter = statusFilter === 'ALL' || slot?.status === statusFilter;
      const visible     = matchSearch && matchFilter;
      marker.setOpacity(visible ? 1 : 0.1);
      marker.setZIndexOffset(visible ? 0 : -100);
      if (t && slotId === t && visible) {
        const s = slotsRef.current.find((x) => x.slotId === slotId);
        if (s) map.setView([s.lat, s.lng], 20, { animate: true });
      }
    });
  }, [searchTerm, statusFilter, map]);

  /* elapsed tick every 60 s — only occupied slots */
  useEffect(() => {
    const id = setInterval(() => {
      slotsRef.current.forEach((slot) => {
        if (slot.status !== 'OCCUPIED') return;
        const session = sessionForSlot(slot.slotId);
        const marker  = markersRef.current[slot.slotId];
        if (marker && session) marker.setIcon(makeIcon(slot));
      });
    }, 60000);
    return () => clearInterval(id);
  }, [sessionForSlot]);

  return null;
}

/* ── Slot detail popup — centred modal card ── */
function SlotBottomSheet({ slot, session, onClose, onStartEntry }) {
  const formatTime = (d) =>
    d ? new Date(d).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

  const isAvailable = slot.status === 'AVAILABLE';
  const isOccupied  = slot.status === 'OCCUPIED';
  const isOos       = slot.status === 'OUT_OF_SERVICE';

  const accentColor = isAvailable ? '#16a34a' : isOccupied ? '#dc2626' : '#6b7280';

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isOccupied || !session) return;
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [isOccupied, session]);

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 15,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      />

      {/* centred square card */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 20,
        width: 320,
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        animation: 'scaleIn 0.2s cubic-bezier(0.22,1,0.36,1)',
      }}>
        {/* accent top bar */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }} />

        <div style={{ padding: '18px 20px 22px' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* slot badge */}
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: `${accentColor}12`,
                border: `2px solid ${accentColor}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontWeight: 900,
                fontSize: 18, color: accentColor, letterSpacing: '-0.02em', flexShrink: 0,
              }}>
                {slot.slotId}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>Slot {slot.slotId}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: accentColor, boxShadow: `0 0 0 2px ${accentColor}30` }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {isOos ? 'Out of Service' : isOccupied ? 'Occupied' : 'Available'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: 9, background: '#f3f4f6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* ── AVAILABLE ── */}
          {isAvailable && (
            <>
              <div style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: 12, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>Ready to assign</div>
                  <div style={{ fontSize: 11, color: '#16a34a', marginTop: 1 }}>Free — no active session</div>
                </div>
              </div>
              <button
                onClick={() => onStartEntry(slot)}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#16a34a 0%,#15803d 100%)',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(22,163,74,0.45)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 14px rgba(22,163,74,0.35)'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                Start Entry for Slot {slot.slotId}
              </button>
            </>
          )}

          {/* ── OCCUPIED ── */}
          {isOccupied && session && (
            <>
              {/* elapsed hero */}
              <div style={{
                background: 'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)',
                borderRadius: 14, padding: '12px 16px', marginBottom: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 14px rgba(220,38,38,0.25)',
              }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Time Parked</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{elapsed(session.entryTime)}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>Since {formatTime(session.entryTime)}</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
              </div>
              {/* detail grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { icon: '🚗', label: 'Plate',       value: session.plateNumber,    mono: true,  full: false },
                  { icon: '📞', label: 'Phone',       value: session.driverPhone,    mono: false, full: false },
                  { icon: '📍', label: 'Destination', value: session.destinationName,mono: false, full: true  },
                  { icon: '👤', label: 'Attendant',   value: session.attendantName,  mono: false, full: false },
                ].map(({ icon, label, value, mono, full }) => (
                  <div key={label} style={{
                    gridColumn: full ? '1 / -1' : undefined,
                    background: '#f9fafb', borderRadius: 10, padding: '8px 10px',
                    border: '1px solid #f3f4f6',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{icon} {label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontFamily: mono ? 'var(--font-mono)' : undefined, letterSpacing: mono ? '0.05em' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── OUT OF SERVICE ── */}
          {isOos && (
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 3 }}>Slot Unavailable</div>
                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>Taken out of service by an operator. Cannot be assigned.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Main ── */
export default function LiveMap() {
  const navigate                                     = useNavigate();
  const [slots,        setSlots]    = useState([]);
  const [sessions,     setSessions] = useState([]);
  const [loading,      setLoading]  = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [panelCollapsed, setPanelCollapsed]   = useState(false);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL'|'AVAILABLE'|'OCCUPIED'
  const mapRef = useRef(null);

  /* ── fetch — demo fallback ── */
  useEffect(() => {
    if (isDemoMode()) {
      setSlots(applyPersistedPositions([...demoSlots]));
      setSessions(demoSessions.filter((s) => s.status === 'ACTIVE'));
      setLoading(false);
      return;
    }
    Promise.all([
      api.get('/api/slots'),
      api.get('/api/sessions?status=ACTIVE'),
    ]).then(([s, se]) => {
      setSlots(s.data);
      setSessions(Array.isArray(se.data) ? se.data : se.data.sessions || []);
    }).catch(() => {
      setSlots(applyPersistedPositions([...demoSlots]));
      setSessions(demoSessions.filter((s) => s.status === 'ACTIVE'));
    }).finally(() => setLoading(false));
  }, []);

  /* ── socket ── */
  useEffect(() => {
    const s = getSocket();

    const onSlotUpdated = ({ slotId, status }) => {
      setSlots((prev) => prev.map((sl) => sl.slotId === slotId ? { ...sl, status } : sl));
      /* keep selectedSlot in sync */
      setSelectedSlot((prev) => prev?.slotId === slotId ? { ...prev, status } : prev);
    };
    const onSessionCreated = ({ session }) => {
      setSessions((prev) => [session, ...prev.filter((x) => x._id !== session._id)]);
      /* auto-pan to the newly occupied slot */
      if (session?.slotId) {
        const slot = slots.find((sl) => sl.slotId === session.slotId);
        if (slot && mapRef.current) {
          mapRef.current.flyTo([slot.lat, slot.lng], 20, { animate: true, duration: 1 });
        }
      }
    };
    const onSessionClosed = ({ sessionId, slotId }) => {
      setSessions((prev) => prev.filter((x) => x._id !== sessionId));
      setSelectedSlot((prev) => {
        if (prev?.slotId === slotId) setSelectedSession(null);
        return prev;
      });
    };

    s.on('slot_updated',     onSlotUpdated);
    s.on('session_created',  onSessionCreated);
    s.on('session_closed',   onSessionClosed);
    return () => {
      s.off('slot_updated',    onSlotUpdated);
      s.off('session_created', onSessionCreated);
      s.off('session_closed',  onSessionClosed);
    };
  }, []);

  const stats = {
    available: slots.filter((s) => s.status === 'AVAILABLE').length,
    occupied:  slots.filter((s) => s.status === 'OCCUPIED').length,
    total:     slots.length,
  };
  const occPct   = stats.total ? Math.round((stats.occupied / stats.total) * 100) : 0;
  const barColor = occPct >= 90 ? 'var(--color-occupied)' : occPct >= 60 ? 'var(--color-warning)' : 'var(--color-available)';

  const handleSlotClick = useCallback((slot, session) => {
    setSelectedSlot(slot);
    setSelectedSession(session || null);
    setPanelCollapsed(false);
  }, []);

  const handleStartEntry = useCallback((slot) => {
    setSelectedSlot(null);
    navigate(`/attendant/entry?slotId=${slot.slotId}`);
  }, [navigate]);

  const handleCloseSheet = useCallback(() => setSelectedSlot(null), []);

  /* zone polygons removed */

  if (loading) {
    return (
      <div style={{ height: 'calc(100vh - var(--topbar-height))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div className="map-loading-spinner" />
        <div className="map-loading-text">Loading parking map...</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - var(--topbar-height))', overflow: 'hidden' }}>
      <MapContainer
        center={[0.326689, 32.606920]}
        zoom={18}
        zoomControl={false}
        ref={mapRef}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={21}
        />

        <MarkersLayer
          slots={slots}
          sessions={sessions}
          onSlotClick={handleSlotClick}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
        />
      </MapContainer>

      {/* ── Floating search top-left ── */}
      <div style={{ position: 'absolute', top: 'var(--space-4)', left: 'var(--space-4)', zIndex: 10 }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }}
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Find slot e.g. A1"
            style={{
              width: 220, padding: '0.5rem 0.75rem 0.5rem 2.2rem', fontSize: 'var(--text-sm)',
              background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(14px)',
              border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 'var(--radius-full)',
              outline: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontFamily: 'var(--font-sans)',
            }}
          />
        </div>
      </div>

      {/* ── Floating panel top-right ── */}
      <div style={{
        position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)',
        width: panelCollapsed ? 'auto' : 272,
        background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(14px)',
        borderRadius: 'var(--radius-2xl)', boxShadow: '0 8px 32px rgba(0,0,0,0.13),0 0 0 1px rgba(0,0,0,0.06)',
        zIndex: 10, overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'rgba(255,255,255,0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-900)' }}>
            <div className="live-indicator" style={{ fontSize: '0.65rem' }}>LIVE</div>
            Slot Overview
          </div>
          <button
            onClick={() => setPanelCollapsed((c) => !c)}
            style={{ width: 26, height: 26, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-100)', border: 'none', cursor: 'pointer', color: 'var(--gray-500)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {panelCollapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
            </svg>
          </button>
        </div>

        {!panelCollapsed && (
          <div style={{ padding: 'var(--space-4)', maxHeight: 'calc(100vh - var(--topbar-height) - 120px)', overflowY: 'auto' }}>
            {/* status filter toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-3)', background: 'var(--gray-100)', borderRadius: 'var(--radius-md)', padding: 3 }}>
              {[['ALL','All'],['AVAILABLE','Free'],['OCCUPIED','Taken']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setStatusFilter(val)}
                  style={{
                    flex: 1, padding: '4px 0', fontSize: 'var(--text-xs)', fontWeight: 600,
                    borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    background: statusFilter === val ? 'var(--surface-card)' : 'transparent',
                    color: statusFilter === val
                      ? val === 'AVAILABLE' ? 'var(--color-available)' : val === 'OCCUPIED' ? 'var(--color-occupied)' : 'var(--gray-700)'
                      : 'var(--gray-500)',
                    boxShadow: statusFilter === val ? 'var(--shadow-xs)' : 'none',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              {[
                { label: 'Free',  value: stats.available, color: 'var(--color-available)' },
                { label: 'Taken', value: stats.occupied,  color: 'var(--color-occupied)'  },
                { label: 'Total', value: stats.total,     color: 'var(--brand-primary)'   },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2)', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-500)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* occupancy bar */}
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginBottom: 4 }}>
                <span>Occupancy</span>
                <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{occPct}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--gray-200)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${occPct}%`, background: barColor, borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
              </div>
            </div>


          </div>
        )}
      </div>

      {/* ── Slot detail bottom sheet ── */}
      {selectedSlot && (
        <SlotBottomSheet
          slot={selectedSlot}
          session={selectedSession}
          onClose={handleCloseSheet}
          onStartEntry={handleStartEntry}
        />
      )}

      {/* ── Parking full banner ── */}
      {stats.available === 0 && stats.total > 0 && (
        <div style={{
          position: 'absolute', bottom: 'var(--space-4)', left: '50%', transform: 'translateX(-50%)', zIndex: 10,
          background: 'linear-gradient(135deg,#dc2626 0%,#b91c1c 100%)', color: '#fff',
          padding: 'var(--space-3) var(--space-6)', borderRadius: 'var(--radius-full)',
          fontSize: 'var(--text-sm)', fontWeight: 700, boxShadow: '0 4px 20px rgba(220,38,38,0.45)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)', whiteSpace: 'nowrap',
          animation: 'slideUp var(--transition-base)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          PARKING FULL — Redirect incoming drivers
        </div>
      )}
    </div>
  );
}
