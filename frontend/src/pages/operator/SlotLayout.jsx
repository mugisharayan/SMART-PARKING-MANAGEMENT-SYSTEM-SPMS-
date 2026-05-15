import { useEffect, useRef, useState, useCallback, Fragment } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../lib/api';
import { isDemoMode, demoSlots, demoDestinations, demoLandmarks, saveSlotPosition, applyPersistedPositions, clearSlotPositions } from '../../lib/demo';

/* ── helpers ── */
function haversine(la1, lo1, la2, lo2) {
  const R = 6371000, r = (x) => (x * Math.PI) / 180;
  const dLa = r(la2 - la1), dLo = r(lo2 - lo1);
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATUS_COLOR  = { AVAILABLE: '#16a34a', OCCUPIED: '#dc2626', OUT_OF_SERVICE: '#6b7280' };
const STATUS_SHADOW = { AVAILABLE: 'rgba(22,163,74,.45)', OCCUPIED: 'rgba(220,38,38,.45)', OUT_OF_SERVICE: 'rgba(107,114,128,.35)' };

function makeSlotIcon(slot) {
  const fill   = STATUS_COLOR[slot.status]  || '#6b7280';
  const shadow = STATUS_SHADOW[slot.status] || 'rgba(107,114,128,.35)';
  const pulse  = slot.status === 'AVAILABLE'
    ? `<circle cx="14" cy="14" r="13" fill="none" stroke="${fill}" stroke-width="2" opacity="0.35">
         <animate attributeName="r" from="10" to="18" dur="1.8s" repeatCount="indefinite"/>
         <animate attributeName="opacity" from="0.5" to="0" dur="1.8s" repeatCount="indefinite"/>
       </circle>`
    : '';
  /* pin body: teardrop path centred at (14,14), tip at bottom (14,34) */
  const pinPath = 'M14,2 C8.477,2 4,6.477 4,12 C4,19.5 14,34 14,34 C14,34 24,19.5 24,12 C24,6.477 19.523,2 14,2 Z';
  const label   = slot.slotId.length > 2
    ? `<text x="14" y="14.5" text-anchor="middle" dominant-baseline="middle" font-size="5.5" font-weight="800" fill="#fff" font-family="'JetBrains Mono',monospace" letter-spacing="-0.3">${slot.slotId}</text>`
    : `<text x="14" y="14" text-anchor="middle" dominant-baseline="middle" font-size="7" font-weight="800" fill="#fff" font-family="'JetBrains Mono',monospace">${slot.slotId}</text>`;
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:28px;height:36px;filter:drop-shadow(0 3px 6px ${shadow})">
      <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
        ${pulse}
        <path d="${pinPath}" fill="${fill}" stroke="rgba(255,255,255,0.6)" stroke-width="1.2"/>
        <circle cx="14" cy="12" r="5.5" fill="rgba(255,255,255,0.2)"/>
        ${label}
      </svg>
    </div>`,
    iconSize:   [28, 36],
    iconAnchor: [14, 36],
    popupAnchor:[0, -36],
  });
}

/* ── Map layer — manages all slot markers imperatively ── */
function SlotMapLayer({ slots, destinations, landmarks, mode, onSlotClick, onMapClick, onSlotMoved, onToast }) {
  const map         = useMap();
  const markersRef  = useRef({});
  const landmarkRef = useRef([]);

  /* slot markers */
  useEffect(() => {
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};
    slots.forEach((slot) => {
      const marker = L.marker([slot.lat, slot.lng], { icon: makeSlotIcon(slot), draggable: true }).addTo(map);
      marker.on('click', () => { if (mode === 'view') onSlotClick(slot, marker); });
      marker.on('dragend', (e) => {
        const ll  = e.target.getLatLng();
        const lat = parseFloat(ll.lat.toFixed(6));
        const lng = parseFloat(ll.lng.toFixed(6));
        /* persist position to database, then update React state */
        if (isDemoMode()) {
          saveSlotPosition(slot.slotId, lat, lng);
          onSlotMoved(slot.slotId, lat, lng);
          onToast('success', `Slot ${slot.slotId} moved`, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } else {
          api.patch(`/api/slots/${slot.slotId}`, { lat, lng })
            .then(() => {
              onSlotMoved(slot.slotId, lat, lng);
              onToast('success', `Slot ${slot.slotId} moved`, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
              console.log(`✅ Slot ${slot.slotId} position saved to DB: ${lat}, ${lng}`);
            })
            .catch((err) => {
              /* revert marker to last known good position on failure */
              marker.setLatLng([slot.lat, slot.lng]);
              onToast('error', `Failed to save ${slot.slotId}`, 'Position not updated');
              console.error(`❌ Failed to save slot ${slot.slotId}:`, err.response?.data || err.message);
            });
        }
      });
      markersRef.current[slot.slotId] = marker;
    });
    return () => { Object.values(markersRef.current).forEach((m) => m.remove()); markersRef.current = {}; };
  }, [slots, map, mode, onSlotClick, onSlotMoved]);

  /* landmark markers — removed, no overlays on map */

  /* map click */
  useEffect(() => {
    map.getContainer().style.cursor = mode === 'view' ? '' : 'crosshair';
    const handler = (e) => { if (mode !== 'view') onMapClick(e.latlng, mode); };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map, mode, onMapClick]);

  return null;
}

/* ── Add Slot Modal ── */
function AddSlotModal({ latlng, destinations, slots, onSave, onCancel }) {
  const [slotId,  setSlotId]  = useState('');
  const [destId,  setDestId]  = useState('');
  const [error,   setError]   = useState('');

  const handleSave = () => {
    const id = slotId.trim().toUpperCase();
    if (!id) { setError('Slot ID is required.'); return; }
    if (slots.find((s) => s.slotId === id)) { setError(`Slot ${id} already exists.`); return; }
    const dup = slots.find((s) => haversine(latlng.lat, latlng.lng, s.lat, s.lng) < 1);
    if (dup) { setError(`Slot ${dup.slotId} is already within 1m of this position.`); return; }
    onSave({ slotId: id, destinationId: destId || null, lat: parseFloat(latlng.lat.toFixed(6)), lng: parseFloat(latlng.lng.toFixed(6)) });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-title">Add New Slot</div>
          <button className="modal-close" onClick={onCancel}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Slot ID <span className="required">*</span></label>
            <input className={`input${error ? ' error' : ''}`} value={slotId}
              onChange={(e) => { setSlotId(e.target.value.toUpperCase()); setError(''); }}
              placeholder="e.g. F1" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }} />
            {error && <div className="form-error">{error}</div>}
          </div>
          <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label">Destination Zone</label>
            <select className="select" value={destId} onChange={(e) => setDestId(e.target.value)}>
              <option value="">None</option>
              {destinations.map((d) => <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--gray-500)', fontFamily: 'var(--font-mono)' }}>
            GPS: {latlng.lat.toFixed(6)}, {latlng.lng.toFixed(6)}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline-gray" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Add Slot</button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Landmark Modal ── */
function AddLandmarkModal({ latlng, onSave, onCancel }) {
  const [label, setLabel] = useState('');
  const [type,  setType]  = useState('DESTINATION_POI');
  const [error, setError] = useState('');
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-title">Add Landmark</div>
          <button className="modal-close" onClick={onCancel}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Label <span className="required">*</span></label>
            <input className={`input${error ? ' error' : ''}`} value={label} onChange={(e) => { setLabel(e.target.value); setError(''); }} placeholder="e.g. Entry Gate" />
            {error && <div className="form-error">{error}</div>}
          </div>
          <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label">Type</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ENTRY_GATE">Entry Gate</option>
              <option value="EXIT_GATE">Exit Gate</option>
              <option value="DESTINATION_POI">Destination POI</option>
            </select>
          </div>
          <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--gray-500)', fontFamily: 'var(--font-mono)' }}>
            GPS: {latlng.lat.toFixed(6)}, {latlng.lng.toFixed(6)}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline-gray" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { if (!label.trim()) { setError('Label required.'); return; } onSave({ label: label.trim(), type, lat: parseFloat(latlng.lat.toFixed(6)), lng: parseFloat(latlng.lng.toFixed(6)) }); }}>Add Landmark</button>
        </div>
      </div>
    </div>
  );
}

/* ── Confirm modal ── */
function ConfirmModal({ title, text, onOk, onCancel }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal-sm">
        <div className="modal-header"><div className="modal-title">{title}</div><button className="modal-close" onClick={onCancel}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <div className="modal-body"><p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-700)', lineHeight: 'var(--leading-relaxed)' }}>{text}</p></div>
        <div className="modal-footer"><button className="btn btn-outline-gray" onClick={onCancel}>Cancel</button><button className="btn btn-danger" onClick={onOk}>Confirm</button></div>
      </div>
    </div>
  );
}

/* ── Toast ── */
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, title, msg = '') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, type, title, msg }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);
  return { toasts, add };
}
function ToastContainer({ toasts }) {
  return toasts.length ? (
    <div className="toast-container">
      {toasts.map(({ id, type, title, msg }) => (
        <div key={id} className={`toast ${type}`}>
          <div className="toast-content"><div className="toast-title">{title}</div>{msg && <div className="toast-message">{msg}</div>}</div>
        </div>
      ))}
    </div>
  ) : null;
}

/* ── Reset view control ── */
function ResetViewControl() {
  const map = useMap();
  return (
    <div style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', zIndex: 10 }}>
      <button
        onClick={() => map.flyTo([0.326689, 32.606920], 18, { animate: true, duration: 0.8 })}
        style={{
          background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(10px)',
          border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
          padding: '6px 10px', fontSize: 'var(--text-xs)', fontWeight: 600,
          color: 'var(--gray-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        Reset View
      </button>
    </div>
  );
}

/* ── Main ── */
export default function SlotLayout() {
  const [slots,        setSlots]        = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [landmarks,    setLandmarks]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [mode,         setMode]         = useState('view');
  const [addSlotData,  setAddSlotData]  = useState(null);
  const [addLmData,    setAddLmData]    = useState(null);
  const [confirm,      setConfirm]      = useState(null);
  const [zoneFilter,   setZoneFilter]   = useState('ALL');  // S1: zone filter
  const [collapsed,    setCollapsed]    = useState({});     // S1: collapsed zone groups
  const { toasts, add: toast } = useToast();

  const load = useCallback(async () => {
    if (isDemoMode()) {
      setSlots(applyPersistedPositions([...demoSlots]));
      setDestinations([...demoDestinations]);
      setLandmarks([...demoLandmarks]);
      setLoading(false);
      return;
    }
    try {
      /* Fetch slots independently — a missing destinations/landmarks endpoint
         must NOT cause slots (and their saved positions) to be lost.        */
      const slotsRes = await api.get('/api/slots');
      setSlots(slotsRes.data);

      /* Destinations and landmarks are optional — fail gracefully */
      try {
        const destRes = await api.get('/api/destinations');
        setDestinations(destRes.data);
      } catch {
        setDestinations([...demoDestinations]);
      }

      try {
        const lmRes = await api.get('/api/landmarks');
        setLandmarks(lmRes.data);
      } catch {
        setLandmarks([]);
      }

    } catch (err) {
      /* Only fall back to demo data if the slots fetch itself failed */
      console.error('Failed to load slots from backend:', err.message);
      setSlots([...demoSlots]);
      setDestinations([...demoDestinations]);
      setLandmarks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMapClick = useCallback((latlng, clickMode) => {
    if (clickMode === 'add')      setAddSlotData({ latlng });
    if (clickMode === 'landmark') setAddLmData({ latlng });
  }, []);

  const handleSlotClick = useCallback((slot, marker) => {
    const isOos = slot.status === 'OUT_OF_SERVICE';
    marker.bindPopup(`
      <div style="font-family:Inter,sans-serif;min-width:180px">
        <div style="font-weight:700;font-size:14px;margin-bottom:8px">Slot ${slot.slotId}</div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:8px">Status: <strong style="color:${STATUS_COLOR[slot.status]}">${slot.status}</strong></div>
        <button id="oos-btn-${slot.slotId}" style="padding:4px 10px;font-size:11px;font-weight:600;border-radius:4px;border:none;cursor:pointer;background:${isOos ? '#16a34a' : '#dc2626'};color:#fff">
          ${isOos ? 'Restore' : 'Mark OOS'}
        </button>
      </div>
    `).openPopup();
    setTimeout(() => {
      const btn = document.getElementById(`oos-btn-${slot.slotId}`);
      if (btn) btn.onclick = () => { marker.closePopup(); handleToggleOos(slot); };
    }, 50);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleOos = (slot) => {
    const doToggle = async () => {
      const newStatus = slot.status === 'OUT_OF_SERVICE' ? 'AVAILABLE' : 'OUT_OF_SERVICE';
      if (isDemoMode()) {
        slot.status = newStatus;
      } else {
        try { await api.patch(`/api/slots/${slot.slotId}`, { status: newStatus }); }
        catch (err) { toast('error', 'Update failed', err.response?.data?.message || ''); return; }
      }
      toast(newStatus === 'AVAILABLE' ? 'success' : 'warning', `Slot ${slot.slotId}`, newStatus === 'AVAILABLE' ? 'Restored to service' : 'Marked out of service');
      setConfirm(null);
      setSlots((prev) => prev.map((s) => s.slotId === slot.slotId ? { ...s, status: newStatus } : s));
    };

    if (slot.status === 'OCCUPIED') {
      setConfirm({ title: 'Slot Has Active Session', text: `Slot ${slot.slotId} has an active session. Mark it out of service anyway?`, onOk: doToggle });
    } else {
      doToggle();
    }
  };

  const handleSlotMoved = useCallback((slotId, lat, lng) => {
    setSlots((prev) => prev.map((s) => s.slotId === slotId ? { ...s, lat, lng } : s));
  }, []);

  const handleSaveSlot = async ({ slotId, destinationId, lat, lng }) => {
    const newSlot = { _id: 's' + Date.now(), id: 's' + Date.now(), slotId, label: slotId, lat, lng, status: 'AVAILABLE', destinationId };
    if (isDemoMode()) {
      demoSlots.push(newSlot);
    } else {
      try { const { data } = await api.post('/api/slots', { slotId, label: slotId, lat, lng, destinationId }); newSlot._id = data._id; }
      catch (err) { toast('error', 'Failed to add slot', err.response?.data?.message || ''); return; }
    }
    setSlots((prev) => [...prev, newSlot]);
    setAddSlotData(null);
    toast('success', 'Slot added', slotId);
  };

  const handleSaveLandmark = async ({ label, type, lat, lng }) => {
    const lm = { _id: 'lm' + Date.now(), label, type, lat, lng };
    if (isDemoMode()) {
      demoLandmarks.push(lm);
    } else {
      try { await api.post('/api/landmarks', { label, type, lat, lng }); }
      catch (err) { toast('error', 'Failed to add landmark', err.response?.data?.message || ''); return; }
    }
    setLandmarks((prev) => [...prev, lm]);
    setAddLmData(null);
    toast('success', 'Landmark added', label);
  };

  const modeButtons = [
    { key: 'view',     label: 'View',         icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> },
    { key: 'add',      label: 'Add Slot',     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> },
    { key: 'landmark', label: 'Add Landmark', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
  ];

  const available = slots.filter((s) => s.status === 'AVAILABLE').length;
  const occupied  = slots.filter((s) => s.status === 'OCCUPIED').length;
  const oos       = slots.filter((s) => s.status === 'OUT_OF_SERVICE').length;

  return (
    <div className="page-content">
      <ToastContainer toasts={toasts} />
      {confirm    && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}
      {addSlotData && <AddSlotModal latlng={addSlotData.latlng} destinations={destinations} slots={slots} onSave={handleSaveSlot} onCancel={() => setAddSlotData(null)} />}
      {addLmData   && <AddLandmarkModal latlng={addLmData.latlng} onSave={handleSaveLandmark} onCancel={() => setAddLmData(null)} />}

      <div className="page-header">
        <div className="page-title">Slot Layout Management</div>
        <div className="page-subtitle">Click the map to place slots. Drag markers to reposition.</div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {/* mode pill buttons */}
        <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 'var(--radius-md)', padding: 3, gap: 2 }}>
          {modeButtons.map(({ key, label, icon }) => (
            <button key={key} onClick={() => setMode(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                background: mode === key ? 'var(--surface-card)' : 'transparent',
                color: mode === key ? 'var(--brand-primary)' : 'var(--gray-500)',
                fontWeight: mode === key ? 700 : 500, fontSize: 'var(--text-sm)',
                boxShadow: mode === key ? 'var(--shadow-xs)' : 'none',
                transition: 'all var(--transition-fast)',
              }}>
              {icon}{label}
            </button>
          ))}
        </div>
        {mode !== 'view' && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-primary)', fontWeight: 600, background: 'var(--brand-primary-lt)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
            {mode === 'add' ? 'Click map to place a slot' : 'Click map to place a landmark'}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <span className="badge badge-available">{available} Available</span>
          <span className="badge badge-occupied">{occupied} Occupied</span>
          <span className="badge badge-oos">{oos} OOS</span>
          <button
            className="btn btn-outline-gray btn-sm"
            onClick={() => { clearSlotPositions(); load(); toast('info', 'Positions reset', 'All slots returned to default positions.'); }}
            title="Reset all slot positions to defaults"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
            Reset Positions
          </button>
        </div>
      </div>

      {/* Map */}
      {loading ? (
        <div className="skeleton" style={{ height: 420, borderRadius: 'var(--radius-xl)' }} />
      ) : (
        <div style={{ height: 420, borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--gray-200)', position: 'relative' }}>
          <MapContainer center={[0.326689, 32.606920]} zoom={18} zoomControl style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" maxZoom={21} />
            <SlotMapLayer
              slots={slots}
              destinations={destinations}
              landmarks={landmarks}
              mode={mode}
              onSlotClick={handleSlotClick}
              onMapClick={handleMapClick}
              onSlotMoved={handleSlotMoved}
              onToast={toast}
            />
            <ResetViewControl />
          </MapContainer>
          {/* floating slot count pill */}
          <div style={{
            position: 'absolute', bottom: 'var(--space-3)', left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(10px)',
            borderRadius: 'var(--radius-full)', padding: '6px 16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center',
            fontSize: 'var(--text-xs)', fontWeight: 600, pointerEvents: 'none',
          }}>
            <span style={{ color: 'var(--color-available)' }}>{available} free</span>
            <span style={{ color: 'var(--gray-300)' }}>|</span>
            <span style={{ color: 'var(--color-occupied)' }}>{occupied} taken</span>
            <span style={{ color: 'var(--gray-300)' }}>|</span>
            <span style={{ color: 'var(--color-oos)' }}>{oos} OOS</span>
          </div>
        </div>
      )}

      {/* Slots table — grouped by zone with filter pills */}
      <div className="card" style={{ marginTop: 'var(--space-4)' }}>
        <div className="card-header">
          <div className="card-title">All Slots</div>
          {/* zone filter pills */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              onClick={() => setZoneFilter('ALL')}
              className={`btn btn-sm ${zoneFilter === 'ALL' ? 'btn-primary' : 'btn-outline-gray'}`}
            >All</button>
            {destinations.map((d) => (
              <button
                key={d._id || d.id}
                onClick={() => setZoneFilter(d._id || d.id)}
                className={`btn btn-sm ${zoneFilter === (d._id || d.id) ? 'btn-primary' : 'btn-outline-gray'}`}
              >{d.name.split(' ')[0]}</button>
            ))}
          </div>
        </div>
        <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none' }}>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Slot ID</th><th>Zone</th><th>Latitude</th><th>Longitude</th><th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                /* group slots by destination */
                const groups = {};
                slots.forEach((slot) => {
                  const dest = destinations.find((d) => (d._id || d.id) === slot.destinationId);
                  const key  = dest ? (dest._id || dest.id) : 'none';
                  const name = dest ? dest.name : 'No Zone';
                  if (!groups[key]) groups[key] = { name, slots: [] };
                  groups[key].slots.push(slot);
                });
                return Object.entries(groups)
                  .filter(([key]) => zoneFilter === 'ALL' || key === zoneFilter)
                  .map(([key, group]) => {
                    const isCollapsed = collapsed[key];
                    return (
                      <Fragment key={key}>
                        {/* zone header row */}
                        <tr style={{ background: 'var(--gray-50)', cursor: 'pointer' }}
                          onClick={() => setCollapsed((p) => ({ ...p, [key]: !p[key] }))}
                        >
                          <td colSpan={7} style={{ padding: 'var(--space-2) var(--space-4)', fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                {isCollapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="6 9 12 15 18 9"/>}
                              </svg>
                              {group.name} <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>({group.slots.length} slots)</span>
                            </span>
                          </td>
                        </tr>
                        {/* slot rows */}
                        {!isCollapsed && group.slots.map((slot) => (
                          <tr key={slot.slotId}>
                            <td style={{ width: 32 }} />
                            <td className="td-slot">{slot.slotId}</td>
                            <td style={{ fontSize: 'var(--text-xs)' }}>{group.name}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{Number(slot.lat).toFixed(6)}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{Number(slot.lng).toFixed(6)}</td>
                            <td><span className={`badge ${slot.status === 'AVAILABLE' ? 'badge-available' : slot.status === 'OCCUPIED' ? 'badge-occupied' : 'badge-oos'}`}>{slot.status}</span></td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className={`btn btn-sm ${slot.status === 'OUT_OF_SERVICE' ? 'btn-success' : 'btn-warning'}`}
                                onClick={() => handleToggleOos(slot)}
                              >{slot.status === 'OUT_OF_SERVICE' ? 'Restore' : 'Mark OOS'}</button>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
