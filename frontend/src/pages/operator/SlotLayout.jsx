import { useEffect, useRef, useState, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../lib/api';
import { getOpSocket } from './OperatorLayout';

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
        api.patch(`/api/slots/${slot.slotId}`, { lat, lng })
          .then(() => {
            onSlotMoved(slot.slotId, lat, lng);
            onToast('success', `Slot ${slot.slotId} moved`, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            console.log(`✅ Slot ${slot.slotId} position saved to DB: ${lat}, ${lng}`);
          })
          .catch((err) => {
            marker.setLatLng([slot.lat, slot.lng]);
            onToast('error', `Failed to save ${slot.slotId}`, 'Position not updated');
            console.error(`❌ Failed to save slot ${slot.slotId}:`, err.response?.data || err.message);
          });
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
function AddSlotModal({ latlng, destinations, slots, onSave, onCancel, preselectedDestId }) {
  const [slotId,  setSlotId]  = useState('');
  const [destId,  setDestId]  = useState(preselectedDestId || '');
  const [error,   setError]   = useState('');

  const handleSave = () => {
    const id = slotId.trim().toUpperCase();
    if (!id) { setError('Slot ID is required.'); return; }
    if (slots.find((s) => s.slotId === id)) { setError(`Slot ${id} already exists.`); return; }
    const dup = slots.find((s) => haversine(latlng.lat, latlng.lng, s.lat, s.lng) < 1);
    if (dup) { setError(`Slot ${dup.slotId} is already within 1m of this position.`); return; }
    onSave({ slotId: id, destinationId: destId || null, lat: parseFloat(latlng.lat.toFixed(6)), lng: parseFloat(latlng.lng.toFixed(6)) });
  };

  return createPortal(
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
              placeholder="e.g. F1" autoFocus style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }} />
            {error && <div className="form-error">{error}</div>}
          </div>
          <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label">Destination Zone</label>
            <select className="select" value={destId} onChange={(e) => setDestId(e.target.value)}>
              <option value="">None</option>
              {destinations.map((d) => <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>)}
            </select>
            {preselectedDestId && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-available)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Zone pre-selected from your click location
              </div>
            )}
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
    </div>,
    document.body
  );
}

/* ── Add Landmark Modal ── */
function AddLandmarkModal({ latlng, onSave, onCancel }) {
  const [label, setLabel] = useState('');
  const [type,  setType]  = useState('DESTINATION_POI');
  const [error, setError] = useState('');
  return createPortal(
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
            <input className={`input${error ? ' error' : ''}`} value={label} onChange={(e) => { setLabel(e.target.value); setError(''); }} placeholder="e.g. Entry Gate" autoFocus />
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
    </div>,
    document.body
  );
}

/* ── Confirm modal ── */
function ConfirmModal({ title, text, onOk, onCancel }) {
  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal-sm">
        <div className="modal-header"><div className="modal-title">{title}</div><button className="modal-close" onClick={onCancel}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <div className="modal-body"><p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-700)', lineHeight: 'var(--leading-relaxed)' }}>{text}</p></div>
        <div className="modal-footer"><button className="btn btn-outline-gray" onClick={onCancel}>Cancel</button><button className="btn btn-danger" onClick={onOk}>Confirm</button></div>
      </div>
    </div>,
    document.body
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

/* ── Map instance ref capture ── */
function MapRefCapture({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
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
  const [zoneFilter,   setZoneFilter]   = useState('ALL');
  const [collapsed,    setCollapsed]    = useState({});
  const [search,       setSearch]       = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const mapRef = useRef(null);
  const { toasts, add: toast } = useToast();

  const load = useCallback(async () => {
    try {
      const slotsRes = await api.get('/api/slots');
      setSlots(slotsRes.data);

      try {
        const destRes = await api.get('/api/destinations');
        setDestinations(destRes.data);
      } catch {
        setDestinations([]);
      }

      try {
        const lmRes = await api.get('/api/landmarks');
        setLandmarks(lmRes.data);
      } catch {
        setLandmarks([]);
      }
    } catch (err) {
      console.error('Failed to load slots from backend:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Socket live updates — slot statuses stay fresh without refresh ── */
  useEffect(() => {
    const s = getOpSocket();

    /* slot_updated — operator marked OOS/restored from another tab or dashboard */
    const onSlotUpdated = ({ slotId, status }) => {
      setSlots((prev) => prev.map((sl) => sl.slotId === slotId ? { ...sl, status } : sl));
    };

    /* session_created — attendant checked a vehicle in, slot becomes OCCUPIED */
    const onSessionCreated = ({ session }) => {
      if (!session?.slotId) return;
      setSlots((prev) => prev.map((sl) => sl.slotId === session.slotId ? { ...sl, status: 'OCCUPIED' } : sl));
    };

    /* session_closed — vehicle exited, slot becomes AVAILABLE */
    const onSessionClosed = ({ slotId }) => {
      if (!slotId) return;
      setSlots((prev) => prev.map((sl) => sl.slotId === slotId ? { ...sl, status: 'AVAILABLE' } : sl));
    };

    s.on('slot_updated',    onSlotUpdated);
    s.on('session_created', onSessionCreated);
    s.on('session_closed',  onSessionClosed);
    return () => {
      s.off('slot_updated',    onSlotUpdated);
      s.off('session_created', onSessionCreated);
      s.off('session_closed',  onSessionClosed);
    };
  }, []);

  const handleMapClick = useCallback((latlng, clickMode) => {
    if (clickMode === 'add')      setAddSlotData({ latlng, destinationId: zoneFilter !== 'ALL' ? zoneFilter : null });
    if (clickMode === 'landmark') setAddLmData({ latlng });
  }, [zoneFilter]);

  const handleToggleOos = useCallback((slot) => {
    const doToggle = async () => {
      const newStatus = slot.status === 'OUT_OF_SERVICE' ? 'AVAILABLE' : 'OUT_OF_SERVICE';
      try { await api.patch(`/api/slots/${slot.slotId}`, { status: newStatus }); }
      catch (err) { toast('error', 'Update failed', err.response?.data?.message || ''); return; }
      toast(newStatus === 'AVAILABLE' ? 'success' : 'warning', `Slot ${slot.slotId}`, newStatus === 'AVAILABLE' ? 'Restored to service' : 'Marked out of service');
      setConfirm(null);
      setSlots((prev) => prev.map((s) => s.slotId === slot.slotId ? { ...s, status: newStatus } : s));
    };
    if (slot.status === 'OCCUPIED') {
      setConfirm({ title: 'Slot Has Active Session', text: `Slot ${slot.slotId} has an active session. Mark it out of service anyway?`, onOk: doToggle });
    } else {
      doToggle();
    }
  }, [toast]);

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
  }, [handleToggleOos]);

  const handleSlotMoved = useCallback((slotId, lat, lng) => {
    setSlots((prev) => prev.map((s) => s.slotId === slotId ? { ...s, lat, lng } : s));
  }, []);

  const handleSaveSlot = async ({ slotId, destinationId, lat, lng }) => {
    const newSlot = { slotId, label: slotId, lat, lng, status: 'AVAILABLE', destinationId };
    try {
      const { data } = await api.post('/api/slots', { slotId, label: slotId, lat, lng, destinationId });
      newSlot._id = data._id;
    } catch (err) { toast('error', 'Failed to add slot', err.response?.data?.message || ''); return; }
    setSlots((prev) => [...prev, newSlot]);
    setAddSlotData(null);
    toast('success', 'Slot added', slotId);
  };

  const handleSaveLandmark = async ({ label, type, lat, lng }) => {
    try { await api.post('/api/landmarks', { label, type, lat, lng }); }
    catch (err) { toast('error', 'Failed to add landmark', err.response?.data?.message || ''); return; }
    setLandmarks((prev) => [...prev, { _id: 'lm' + Date.now(), label, type, lat, lng }]);
    setAddLmData(null);
    toast('success', 'Landmark added', label);
  };

  const handleLocateSlot = useCallback((slot) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([slot.lat, slot.lng], 20, { animate: true, duration: 0.8 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const exportCSV = () => {
    const headers = ['Slot ID', 'Zone', 'Status', 'Latitude', 'Longitude'];
    const rows = slots.map((slot) => {
      const dest = destinations.find((d) => (d._id || d.id)?.toString() === slot.destinationId?.toString());
      return [
        slot.slotId,
        dest ? dest.name : 'No Zone',
        slot.status,
        Number(slot.lat).toFixed(6),
        Number(slot.lng).toFixed(6),
      ].join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `slot-layout-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      {addSlotData && <AddSlotModal latlng={addSlotData.latlng} destinations={destinations} slots={slots} onSave={handleSaveSlot} onCancel={() => setAddSlotData(null)} preselectedDestId={addSlotData.destinationId} />}
      {addLmData   && <AddLandmarkModal latlng={addLmData.latlng} onSave={handleSaveLandmark} onCancel={() => setAddLmData(null)} />}

      <div className="page-subtitle" style={{ marginBottom: 'var(--space-5)' }}>Click the map to place slots. Drag markers to reposition.</div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        {[
          {
            label: 'Total Slots',
            value: slots.length,
            color: 'var(--brand-primary)',
            bg:    'var(--brand-primary-lt)',
            delta: `${destinations.length} zone${destinations.length !== 1 ? 's' : ''} configured`,
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            ),
          },
          {
            label: 'Available',
            value: available,
            color: 'var(--color-available)',
            bg:    'var(--color-available-lt)',
            delta: slots.length ? `${Math.round((available / slots.length) * 100)}% of total` : '—',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ),
          },
          {
            label: 'Occupied',
            value: occupied,
            color: 'var(--color-occupied)',
            bg:    'var(--color-occupied-lt)',
            delta: slots.length ? `${Math.round((occupied / slots.length) * 100)}% occupancy rate` : '—',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="3" width="15" height="13" rx="2"/>
                <path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            ),
          },
          {
            label: 'Out of Service',
            value: oos,
            color: 'var(--color-oos)',
            bg:    'var(--color-oos-lt)',
            delta: oos > 0 ? `${oos} slot${oos !== 1 ? 's' : ''} need attention` : 'All slots operational',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
            ),
          },
        ].map(({ label, value, color, bg, delta, icon }) => (
          <div key={label} style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--gray-200)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{ height: 4, background: color }} />
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: bg, color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              </div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--gray-900)', marginBottom: 6, lineHeight: 1 }}>{value}</div>
              {/* occupancy progress bar on Occupied card */}
              {label === 'Occupied' && slots.length > 0 && (
                <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round((occupied / slots.length) * 100)}%`,
                    background: occupied / slots.length > 0.8 ? 'var(--color-occupied)' : occupied / slots.length > 0.5 ? 'var(--color-warning)' : 'var(--color-available)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
              )}
              <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', fontWeight: 500 }}>{delta}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        {/* Row 1: Mode switcher + hint */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 'var(--radius-md)', padding: 3, gap: 2 }}>
            {modeButtons.map(({ key, label, icon }) => {
              const activeColors = {
                view:     { bg: 'var(--brand-primary)',   text: '#fff' },
                add:      { bg: 'var(--color-available)', text: '#fff' },
                landmark: { bg: 'var(--color-warning)',   text: '#fff' },
              };
              const isActive = mode === key;
              return (
                <button key={key} onClick={() => setMode(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    background: isActive ? activeColors[key].bg : 'transparent',
                    color: isActive ? activeColors[key].text : 'var(--gray-500)',
                    fontWeight: isActive ? 700 : 500, fontSize: 'var(--text-sm)',
                    boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                    transition: 'all var(--transition-fast)',
                  }}>
                  {icon}{label}
                </button>
              );
            })}
          </div>
          {/* animated hint badge */}
          {mode !== 'view' && (
            <span style={{
              fontSize: 'var(--text-xs)', fontWeight: 600,
              color:      mode === 'add' ? 'var(--color-available)' : 'var(--color-warning)',
              background: mode === 'add' ? 'var(--color-available-lt)' : 'var(--color-warning-lt)',
              padding: '5px 12px', borderRadius: 'var(--radius-full)',
              display: 'flex', alignItems: 'center', gap: 6,
              animation: 'slideDown 0.25s ease',
              border: `1px solid ${mode === 'add' ? 'var(--color-available)' : 'var(--color-warning)'}`,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {mode === 'add'
                  ? <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                  : <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>
                }
              </svg>
              {mode === 'add' ? 'Click map to place a slot' : 'Click map to place a landmark'}
            </span>
          )}
        </div>
        {/* Row 2: Badges + Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span className="badge badge-available" style={{ padding: '4px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-available)', display: 'inline-block', marginRight: 4 }} />
            {available} Available
          </span>
          <span className="badge badge-occupied" style={{ padding: '4px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-occupied)', display: 'inline-block', marginRight: 4 }} />
            {occupied} Occupied
          </span>
          <span className="badge badge-oos" style={{ padding: '4px 10px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-oos)', display: 'inline-block', marginRight: 4 }} />
            {oos} OOS
          </span>
          <div style={{ marginLeft: 'auto' }}>
            <button
              className="btn btn-outline-gray btn-sm"
              onClick={() => { load(); toast('info', 'Positions reloaded', 'Slot positions refreshed from database.'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
              </svg>
              Refresh Slots
            </button>
          </div>
        </div>
      </div>

      {/* Map */}
      {loading ? (
        <div className="skeleton" style={{ height: 500, borderRadius: 'var(--radius-xl)' }} />
      ) : (
        <div style={{
          height: fullscreen ? '80vh' : 500,
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          border: '1px solid var(--gray-200)',
          position: 'relative',
          transition: 'height 0.4s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: fullscreen ? 'var(--shadow-xl)' : 'var(--shadow-card)',
        }}>
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
            <MapRefCapture mapRef={mapRef} />
          </MapContainer>

          {/* fullscreen toggle */}
          <button
            onClick={() => setFullscreen((f) => !f)}
            style={{
              position: 'absolute', top: 'var(--space-3)', left: 'var(--space-3)', zIndex: 10,
              background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(10px)',
              border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)',
              padding: '6px 10px', fontSize: 'var(--text-xs)', fontWeight: 600,
              color: 'var(--gray-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: 'var(--shadow-sm)', transition: 'all var(--transition-fast)',
            }}
            title={fullscreen ? 'Exit fullscreen' : 'Expand map'}
          >
            {fullscreen ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
              </svg>
            )}
            {fullscreen ? 'Exit Fullscreen' : 'Expand Map'}
          </button>

          {/* map legend */}
          <div style={{
            position: 'absolute', bottom: 'var(--space-3)', left: 'var(--space-3)',
            zIndex: 10, background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(10px)',
            borderRadius: 'var(--radius-lg)', padding: '8px 12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column', gap: 5,
            fontSize: 'var(--text-xs)', fontWeight: 600,
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gray-400)', marginBottom: 2 }}>Legend</div>
            {[
              { color: '#16a34a', label: 'Available', shadow: 'rgba(22,163,74,.45)' },
              { color: '#dc2626', label: 'Occupied',  shadow: 'rgba(220,38,38,.45)' },
              { color: '#6b7280', label: 'Out of Service', shadow: 'rgba(107,114,128,.35)' },
            ].map(({ color, label, shadow }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="10" height="13" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style={{ filter: `drop-shadow(0 1px 2px ${shadow})`, flexShrink: 0 }}>
                  <path d="M14,2 C8.477,2 4,6.477 4,12 C4,19.5 14,34 14,34 C14,34 24,19.5 24,12 C24,6.477 19.523,2 14,2 Z" fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
                  <circle cx="14" cy="12" r="5" fill="rgba(255,255,255,0.25)"/>
                </svg>
                <span style={{ color: 'var(--gray-700)' }}>{label}</span>
              </div>
            ))}
          </div>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div className="card-title">All Slots</div>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', fontWeight: 500 }}>
              {slots.length} total
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {/* search */}
            <div className="search-input-wrapper" style={{ maxWidth: 220 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search slot or zone..."
              />
            </div>
            {/* export */}
            <button className="btn btn-outline-gray btn-sm" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
            {/* zone filter pills */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button onClick={() => setZoneFilter('ALL')} className={`btn btn-sm ${zoneFilter === 'ALL' ? 'btn-primary' : 'btn-outline-gray'}`}>
                All ({slots.length})
              </button>
              {destinations.map((d) => {
                const id       = (d._id || d.id).toString();
                const count    = slots.filter((s) => s.destinationId?.toString() === id).length;
                const zoneOcc  = slots.filter((s) => s.destinationId?.toString() === id && s.status === 'OCCUPIED').length;
                const zonePct  = count ? (zoneOcc / count) : 0;
                const dotColor = zonePct > 0.8 ? 'var(--color-occupied)' : zonePct > 0.5 ? 'var(--color-warning)' : 'var(--color-available)';
                const isActive = zoneFilter === id;
                return (
                  <button
                    key={id}
                    onClick={() => setZoneFilter(id)}
                    className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-gray'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: isActive ? 'rgba(255,255,255,0.8)' : dotColor,
                      boxShadow: isActive ? 'none' : `0 0 0 2px ${dotColor}30`,
                    }} />
                    {d.name.split(' ')[0]} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Slot ID</th><th>Zone</th><th>Latitude</th><th>Longitude</th><th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                /* group slots by destination */
                const groups = {};
                slots.forEach((slot) => {
                  const dest = destinations.find((d) => (d._id || d.id)?.toString() === slot.destinationId?.toString());
                  const key  = dest ? (dest._id || dest.id).toString() : 'none';
                  const name = dest ? dest.name : 'No Zone';
                  if (!groups[key]) groups[key] = { name, slots: [] };
                  groups[key].slots.push(slot);
                });
                return Object.entries(groups)
                  .filter(([key]) => zoneFilter === 'ALL' || key === zoneFilter.toString())
                  .map(([key, group]) => {
                    /* apply search filter within each group */
                    const t = search.toLowerCase();
                    const filteredSlots = search
                      ? group.slots.filter((s) =>
                          s.slotId.toLowerCase().includes(t) ||
                          group.name.toLowerCase().includes(t)
                        )
                      : group.slots;
                    if (filteredSlots.length === 0) return null;
                    const isCollapsed = collapsed[key];
                    return (
                      <Fragment key={key}>
                        {/* zone header row */}
                        {(() => {
                          const zoneOcc   = group.slots.filter((s) => s.status === 'OCCUPIED').length;
                          const zoneTotal = group.slots.length;
                          const zonePct   = zoneTotal ? (zoneOcc / zoneTotal) : 0;
                          const borderColor = zonePct > 0.8 ? 'var(--color-occupied)' : zonePct > 0.5 ? 'var(--color-warning)' : 'var(--color-available)';
                          const bgTint      = zonePct > 0.8 ? 'rgba(220,38,38,0.04)' : zonePct > 0.5 ? 'rgba(217,119,6,0.04)' : 'rgba(22,163,74,0.04)';
                          return (
                            <tr
                              style={{ background: bgTint, cursor: 'pointer', borderLeft: `4px solid ${borderColor}` }}
                              onClick={() => setCollapsed((p) => ({ ...p, [key]: !p[key] }))}
                            >
                              <td colSpan={6} style={{ padding: 'var(--space-2) var(--space-4)', fontWeight: 700, fontSize: 'var(--text-xs)', color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                  {/* chevron + name */}
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      {isCollapsed ? <polyline points="9 18 15 12 9 6"/> : <polyline points="6 9 12 15 18 9"/>}
                                    </svg>
                                    {group.name}
                                    <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>({filteredSlots.length} slot{filteredSlots.length !== 1 ? 's' : ''})</span>
                                  </span>
                                  {/* Add slot directly to this zone */}
                                  {key !== 'none' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Use map center as placeholder coords; operator can drag the pin after
                                        const center = mapRef.current ? mapRef.current.getCenter() : { lat: 0.326689, lng: 32.606920 };
                                        setAddSlotData({ latlng: { lat: center.lat, lng: center.lng }, destinationId: key });
                                      }}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '2px 8px', borderRadius: 6,
                                        background: 'rgba(26,86,219,0.1)',
                                        border: '1px solid rgba(26,86,219,0.25)',
                                        color: 'var(--brand-primary)',
                                        fontSize: '0.65rem', fontWeight: 700,
                                        cursor: 'pointer', letterSpacing: '0.03em',
                                        transition: 'all 0.15s ease',
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,86,219,0.2)'; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(26,86,219,0.1)'; }}
                                      title={`Add slot to ${group.name}`}
                                    >
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                      </svg>
                                      Add Slot
                                    </button>
                                  )}
                                  {/* occupancy progress bar */}
                                  {(() => {
                                    const pct      = zoneTotal ? Math.round((zoneOcc / zoneTotal) * 100) : 0;
                                    const barColor = zonePct > 0.8 ? 'var(--color-occupied)' : zonePct > 0.5 ? 'var(--color-warning)' : 'var(--color-available)';
                                    return (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, maxWidth: 180 }}>
                                        <div style={{ flex: 1, height: 5, background: 'var(--gray-200)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                                          <div style={{
                                            height: '100%', width: `${pct}%`,
                                            background: barColor, borderRadius: 'var(--radius-full)',
                                            transition: 'width 0.6s ease',
                                          }} />
                                        </div>
                                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: barColor, minWidth: 32 }}>{pct}%</span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          );
                        })()}
                        {/* slot rows */}
                        {!isCollapsed && filteredSlots.map((slot) => (
                          <tr key={slot.slotId} style={{
                            borderLeft: `3px solid ${
                              slot.status === 'AVAILABLE' ? 'var(--color-available)'
                              : slot.status === 'OCCUPIED' ? 'var(--color-occupied)'
                              : 'var(--color-oos)'
                            }`,
                          }}>
                            <td className="td-slot">{slot.slotId}</td>
                            <td style={{ fontSize: 'var(--text-xs)' }}>{group.name}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{Number(slot.lat).toFixed(6)}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{Number(slot.lng).toFixed(6)}</td>
                            <td><span className={`badge ${slot.status === 'AVAILABLE' ? 'badge-available' : slot.status === 'OCCUPIED' ? 'badge-occupied' : 'badge-oos'}`}>{slot.status}</span></td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                                <button
                                  className="btn btn-outline-gray btn-sm"
                                  onClick={() => handleLocateSlot(slot)}
                                  title="Locate on map"
                                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                                  </svg>
                                  Locate
                                </button>
                                <button
                                  className={`btn btn-sm ${slot.status === 'OUT_OF_SERVICE' ? 'btn-success' : 'btn-warning'}`}
                                  onClick={() => handleToggleOos(slot)}
                                >{slot.status === 'OUT_OF_SERVICE' ? 'Restore' : 'Mark OOS'}</button>
                              </div>
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
