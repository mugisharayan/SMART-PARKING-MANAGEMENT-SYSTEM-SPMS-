import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';
import { useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../lib/api';
import { getSocket } from './AttendantLayout';
import { isDemoMode, demoSlots, demoSessions, demoDestinations, demoLandmarks } from '../../lib/demo';

/* ── helpers ── */
function elapsed(entryTime) {
  const ms = Date.now() - new Date(entryTime).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

const STATUS_COLOR = { AVAILABLE: '#16a34a', OCCUPIED: '#dc2626', OUT_OF_SERVICE: '#6b7280' };
const ZONE_COLORS  = ['#1a56db', '#d97706', '#16a34a', '#7c3aed', '#0284c7', '#db2777', '#059669', '#ea580c'];

function makeIcon(slot, session) {
  const bg = STATUS_COLOR[slot.status] || '#6b7280';
  const shape =
    slot.status === 'AVAILABLE'
      ? `<circle cx="5" cy="5" r="3" fill="rgba(255,255,255,0.75)"/>`
      : slot.status === 'OCCUPIED'
      ? `<rect x="1" y="1" width="8" height="8" rx="1" fill="rgba(255,255,255,0.75)"/>`
      : `<polygon points="5,1 9,9 1,9" fill="rgba(255,255,255,0.75)"/>`;
  const elapsedStr = session ? `<div style="font-size:8px;opacity:.9;margin-top:1px">${elapsed(session.entryTime)}</div>` : '';
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};color:#fff;font-size:11px;font-weight:700;padding:3px 6px 4px;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.28);font-family:'JetBrains Mono',monospace;text-align:center;min-width:34px;border:2px solid rgba(255,255,255,.35);cursor:pointer">
      <svg width="10" height="10" viewBox="0 0 10 10" style="display:block;margin:0 auto 1px">${shape}</svg>
      ${slot.slotId}${elapsedStr}
    </div>`,
    iconAnchor: [17, 18],
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
      const marker  = L.marker([slot.lat, slot.lng], { icon: makeIcon(slot, session) }).addTo(map);
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
      marker.setIcon(makeIcon(slot, session));
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
        if (marker && session) marker.setIcon(makeIcon(slot, session));
      });
    }, 60000);
    return () => clearInterval(id);
  }, [sessionForSlot]);

  return null;
}

function LandmarkLayer({ landmarks }) {
  const map = useMap();
  useEffect(() => {
    const added = landmarks.map((lm) => {
      const color = lm.type === 'ENTRY_GATE' ? '#16a34a' : lm.type === 'EXIT_GATE' ? '#dc2626' : '#1a56db';
      const icon  = L.divIcon({
        className: '',
        html: `<div style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)">${lm.label}</div>`,
        iconAnchor: [0, 0],
      });
      return L.marker([lm.lat, lm.lng], { icon }).addTo(map);
    });
    return () => added.forEach((m) => m.remove());
  }, [landmarks, map]);
  return null;
}

/* ── Bottom sheet — slot detail ── */
function SlotBottomSheet({ slot, session, onClose, onStartEntry }) {
  const formatTime = (d) =>
    d ? new Date(d).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, zIndex: 15, background: 'rgba(0,0,0,0.25)' }}
      />
      {/* sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        background: 'var(--surface-card)', borderRadius: 'var(--radius-2xl) var(--radius-2xl) 0 0',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', padding: 'var(--space-5) var(--space-6) var(--space-6)',
        animation: 'slideUp 0.25s cubic-bezier(0.22,1,0.36,1)',
        maxHeight: '55vh', overflowY: 'auto',
      }}>
        {/* drag handle */}
        <div style={{ width: 40, height: 4, background: 'var(--gray-300)', borderRadius: 'var(--radius-full)', margin: '0 auto var(--space-4)' }} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 'var(--radius-lg)',
              background: slot.status === 'AVAILABLE' ? 'var(--color-available-lt)' : slot.status === 'OCCUPIED' ? 'var(--color-occupied-lt)' : 'var(--color-oos-lt)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 'var(--text-lg)',
              color: slot.status === 'AVAILABLE' ? 'var(--color-available)' : slot.status === 'OCCUPIED' ? 'var(--color-occupied)' : 'var(--color-oos)',
            }}>
              {slot.slotId}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--gray-900)' }}>Slot {slot.slotId}</div>
              <span className={`badge ${slot.status === 'AVAILABLE' ? 'badge-available' : slot.status === 'OCCUPIED' ? 'badge-occupied' : 'badge-oos'}`}>
                {slot.status === 'OUT_OF_SERVICE' ? 'Out of Service' : slot.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon btn-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* available — show Start Entry button */}
        {slot.status === 'AVAILABLE' && (
          <button
            className="btn btn-success btn-lg btn-block"
            onClick={() => onStartEntry(slot)}
            style={{ marginBottom: 'var(--space-3)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Start Entry for Slot {slot.slotId}
          </button>
        )}

        {/* occupied — session details */}
        {slot.status === 'OCCUPIED' && session && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { k: 'Plate',       v: session.plateNumber,    mono: true  },
              { k: 'Phone',       v: session.driverPhone                 },
              { k: 'Destination', v: session.destinationName             },
              { k: 'Entry',       v: formatTime(session.entryTime)       },
              { k: 'Elapsed',     v: elapsed(session.entryTime), red: true },
              { k: 'Attendant',   v: session.attendantName               },
            ].map(({ k, v, mono, red }) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--gray-100)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--gray-500)', fontWeight: 500 }}>{k}</span>
                <span style={{ fontWeight: 700, fontFamily: mono ? 'var(--font-mono)' : undefined, color: red ? 'var(--color-occupied)' : 'var(--gray-900)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {slot.status === 'OUT_OF_SERVICE' && (
          <div className="alert alert-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            This slot is out of service and cannot be assigned.
          </div>
        )}
      </div>
    </>
  );
}

/* ── Main ── */
export default function LiveMap() {
  const navigate                                     = useNavigate();
  const [slots,        setSlots]        = useState([]);
  const [sessions,     setSessions]     = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [landmarks,    setLandmarks]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [panelCollapsed, setPanelCollapsed]   = useState(false);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL'|'AVAILABLE'|'OCCUPIED'
  const mapRef = useRef(null);

  /* ── fetch — demo fallback ── */
  useEffect(() => {
    if (isDemoMode()) {
      setSlots([...demoSlots]);
      setSessions(demoSessions.filter((s) => s.status === 'ACTIVE'));
      setDestinations(demoDestinations);
      setLandmarks(demoLandmarks);
      setLoading(false);
      return;
    }
    Promise.all([
      api.get('/api/slots'),
      api.get('/api/sessions?status=ACTIVE'),
      api.get('/api/destinations'),
      api.get('/api/landmarks'),
    ]).then(([s, se, d, l]) => {
      setSlots(s.data);
      setSessions(Array.isArray(se.data) ? se.data : se.data.sessions || []);
      setDestinations(d.data);
      setLandmarks(l.data);
    }).catch(() => {
      /* fallback to demo data if API unreachable */
      setSlots([...demoSlots]);
      setSessions(demoSessions.filter((s) => s.status === 'ACTIVE'));
      setDestinations(demoDestinations);
      setLandmarks(demoLandmarks);
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

  /* zone polygons — pad around each destination's slots.
     Works even with a single slot (uses a fixed 15m pad square). */
  const zonePolygons = destinations.map((dest, i) => {
    const destSlots = slots.filter((s) => s.destinationId === (dest._id || dest.id));
    if (!destSlots.length) return null;
    const lats = destSlots.map((s) => s.lat);
    const lngs = destSlots.map((s) => s.lng);
    const pad  = 0.00013; /* ~15 m */
    const bounds = [
      [Math.max(...lats) + pad, Math.min(...lngs) - pad],
      [Math.max(...lats) + pad, Math.max(...lngs) + pad],
      [Math.min(...lats) - pad, Math.max(...lngs) + pad],
      [Math.min(...lats) - pad, Math.min(...lngs) - pad],
    ];
    return { dest, bounds, color: ZONE_COLORS[i % ZONE_COLORS.length] };
  }).filter(Boolean);

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
        center={[0.3317, 32.5935]}
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

        {zonePolygons.map(({ dest, bounds, color }) => (
          <Polygon
            key={dest._id || dest.id}
            positions={bounds}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.07, weight: 1.5, dashArray: '5 5', opacity: 0.45 }}
          />
        ))}

        <MarkersLayer
          slots={slots}
          sessions={sessions}
          onSlotClick={handleSlotClick}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
        />
        <LandmarkLayer landmarks={landmarks} />
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

            {/* slot detail moved to bottom sheet — click any marker to open */}

            <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', margin: 'var(--space-3) 0' }} />

            {/* zone legend removed — polygons on map already show zone colours + labels */}

            {/* marker legend — collapsed into a help tooltip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <div style={{ position: 'relative', display: 'inline-flex' }} className="legend-help">
                <button
                  style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid var(--gray-300)', background: 'var(--gray-50)', fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-500)', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Green = Available · Red = Occupied · Grey = Out of Service"
                >
                  ?
                </button>
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)' }}>Hover ? for legend</span>
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
