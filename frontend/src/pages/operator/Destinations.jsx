import { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { isDemoMode, demoDestinations, demoSessions, demoSlots } from '../../lib/demo';

/* ── Confirm modal ── */
function ConfirmModal({ title, text, onOk, onCancel }) {
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
          <button className="btn btn-danger" onClick={onOk}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

/* ── Toast helper (local, no global state needed) ── */
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((type, title, msg) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, type, title, msg }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);
  return { toasts, add };
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  const colors = { success: 'var(--color-available)', error: 'var(--color-occupied)', warning: 'var(--color-warning)', info: 'var(--brand-primary)' };
  return (
    <div className="toast-container">
      {toasts.map(({ id, type, title, msg }) => (
        <div key={id} className={`toast ${type}`}>
          <div className="toast-content">
            <div className="toast-title">{title}</div>
            {msg && <div className="toast-message">{msg}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

const EMPTY_FORM = { name: '', anchorLat: '', anchorLng: '' };

/* ── per-destination accent colours (cycles through 8) ── */
const CARD_COLORS = [
  { border: '#1a56db', bg: 'rgba(26,86,219,0.04)',  icon: 'rgba(26,86,219,0.12)',  text: '#1a56db'  },
  { border: '#0284c7', bg: 'rgba(2,132,199,0.04)',   icon: 'rgba(2,132,199,0.12)',   text: '#0284c7'  },
  { border: '#16a34a', bg: 'rgba(22,163,74,0.04)',   icon: 'rgba(22,163,74,0.12)',   text: '#16a34a'  },
  { border: '#d97706', bg: 'rgba(217,119,6,0.04)',   icon: 'rgba(217,119,6,0.12)',   text: '#d97706'  },
  { border: '#7c3aed', bg: 'rgba(124,58,237,0.04)',  icon: 'rgba(124,58,237,0.12)',  text: '#7c3aed'  },
  { border: '#db2777', bg: 'rgba(219,39,119,0.04)',  icon: 'rgba(219,39,119,0.12)',  text: '#db2777'  },
  { border: '#059669', bg: 'rgba(5,150,105,0.04)',   icon: 'rgba(5,150,105,0.12)',   text: '#059669'  },
  { border: '#ea580c', bg: 'rgba(234,88,12,0.04)',   icon: 'rgba(234,88,12,0.12)',   text: '#ea580c'  },
];

/* ── Destination card with GPS toggle ── */
function DestCard({ dest, active, slotsN, occPct, barColor, onEdit, onDelete, colorIdx }) {
  const [showGps, setShowGps] = useState(false);
  const accent = CARD_COLORS[colorIdx % CARD_COLORS.length];
  return (
    <div
      className="card"
      style={{
        transition: 'box-shadow var(--transition-fast), transform var(--transition-fast)',
        background: `linear-gradient(160deg, #ffffff 55%, ${accent.bg} 100%)`,
        borderTop: `3px solid ${accent.border}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
    >
      <div className="card-body">
        {/* header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          {/* icon circle + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--radius-xl)',
              background: accent.icon,
              border: `1.5px solid ${accent.border}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: accent.text, lineHeight: 1 }}>
                {dest.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--gray-900)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {dest.name}
              </div>
              {/* GPS toggle */}
              <button
                onClick={() => setShowGps((v) => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3,
                  fontSize: '0.65rem', fontWeight: 600,
                  color: showGps ? accent.text : 'var(--gray-400)',
                  background: showGps ? accent.icon : 'transparent',
                  border: `1px solid ${showGps ? accent.border : 'var(--gray-200)'}`,
                  borderRadius: 'var(--radius-full)',
                  padding: '2px 7px', cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                GPS
              </button>
              {showGps && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--gray-500)', marginTop: 3 }}>
                  {Number(dest.anchorLat).toFixed(6)}, {Number(dest.anchorLng).toFixed(6)}
                </div>
              )}
            </div>
          </div>
          {/* active badge — top right */}
          <span
            className={`badge ${active > 0 ? 'badge-active' : 'badge-closed'}`}
            style={{ flexShrink: 0, marginLeft: 'var(--space-2)' }}
          >
            {active} active
          </span>
        </div>
        {/* stats row — 3 columns: Slots / Occupied / Available */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--gray-100)', overflow: 'hidden',
          marginBottom: 'var(--space-3)',
        }}>
          {[
            { label: 'Slots',     value: slotsN,           dot: accent.border,            textColor: 'var(--gray-900)' },
            { label: 'Occupied',  value: active,           dot: 'var(--color-occupied)',   textColor: 'var(--color-occupied)' },
            { label: 'Available', value: slotsN - active,  dot: 'var(--color-available)',  textColor: 'var(--color-available)' },
          ].map(({ label, value, dot, textColor }, i) => (
            <div key={label} style={{
              textAlign: 'center', padding: 'var(--space-2) var(--space-1)',
              borderRight: i < 2 ? '1px solid var(--gray-100)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-400)' }}>{label}</span>
              </div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: textColor, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>
        {/* occupancy bar */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-400)' }}>Occupancy</span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: barColor }}>{occPct}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${occPct}%`,
              background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow: `0 0 8px ${barColor}60`,
            }} />
          </div>
        </div>
        {/* actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--gray-100)' }}>
          <button
            className="btn btn-sm btn-outline-gray"
            onClick={() => onEdit(dest)}
            title="Edit destination"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: '5px 12px' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button
            className="btn btn-sm btn-icon btn-ghost"
            onClick={() => onDelete(dest)}
            title="Delete destination"
            style={{ color: 'var(--color-occupied)', width: 30, height: 30 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-occupied-lt)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Destinations() {
  const [slots,        setSlots]        = useState([]);
  const [sessions,     setSessions]     = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [formErrors,   setFormErrors]   = useState({});
  const [saving,       setSaving]       = useState(false);
  const [confirm,      setConfirm]      = useState(null);
  const [search,       setSearch]       = useState('');
  const { toasts, add: toast } = useToast();

  /* counts derived from real state — works in both demo and API mode */
  const activeSessions = useCallback((destId) =>
    sessions.filter((s) => s.destinationId === destId && s.status === 'ACTIVE').length
  , [sessions]);

  const slotCount = useCallback((destId) =>
    slots.filter((s) => s.destinationId === destId).length
  , [slots]);

  const load = useCallback(async () => {
    if (isDemoMode()) {
      setDestinations([...demoDestinations]);
      setSessions(demoSessions.filter((s) => s.status === 'ACTIVE'));
      setSlots([...demoSlots]);
      setLoading(false);
      return;
    }
    try {
      const [destsRes, slotsRes, sessRes] = await Promise.all([
        api.get('/api/destinations'),
        api.get('/api/slots'),
        api.get('/api/sessions?status=ACTIVE'),
      ]);
      setDestinations(destsRes.data);
      setSlots(slotsRes.data);
      setSessions(Array.isArray(sessRes.data) ? sessRes.data : sessRes.data.sessions || []);
    } catch {
      setDestinations([...demoDestinations]);
      setSessions(demoSessions.filter((s) => s.status === 'ACTIVE'));
      setSlots([...demoSlots]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Add / Edit form ── */
  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setFormErrors({}); setShowForm(true); };
  const openEdit = (dest) => {
    setEditingId(dest._id || dest.id);
    setForm({ name: dest.name, anchorLat: String(dest.anchorLat), anchorLng: String(dest.anchorLng) });
    setFormErrors({});
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.anchorLat || isNaN(form.anchorLat)) errs.anchorLat = 'Valid latitude required.';
    if (!form.anchorLng || isNaN(form.anchorLng)) errs.anchorLng = 'Valid longitude required.';
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), anchorLat: parseFloat(form.anchorLat), anchorLng: parseFloat(form.anchorLng) };
    try {
      if (isDemoMode()) {
        if (editingId) {
          const d = demoDestinations.find((x) => x._id === editingId || x.id === editingId);
          if (d) { d.name = payload.name; d.anchorLat = payload.anchorLat; d.anchorLng = payload.anchorLng; }
          toast('success', 'Destination updated', payload.name);
        } else {
          const nd = { _id: 'd' + Date.now(), id: 'd' + Date.now(), ...payload };
          demoDestinations.push(nd);
          toast('success', 'Destination added', payload.name);
        }
        await load();
      } else {
        if (editingId) {
          await api.patch(`/api/destinations/${editingId}`, payload);
          toast('success', 'Destination updated', payload.name);
        } else {
          await api.post('/api/destinations', payload);
          toast('success', 'Destination added', payload.name);
        }
        await load();
      }
      closeForm();
    } catch (err) {
      toast('error', 'Save failed', err.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = (dest) => {
    const id     = dest._id || dest.id;
    const active = activeSessions(id);
    const doDelete = async () => {
      try {
        if (isDemoMode()) {
          const idx = demoDestinations.findIndex((x) => x._id === id || x.id === id);
          if (idx !== -1) demoDestinations.splice(idx, 1);
        } else {
          await api.delete(`/api/destinations/${id}`);
        }
        toast('success', 'Destination removed', dest.name);
        await load();
      } catch (err) {
        toast('error', 'Delete failed', err.response?.data?.message || '');
      }
      setConfirm(null);
    };

    if (active > 0) {
      setConfirm({
        title: 'Active Sessions Warning',
        text:  `"${dest.name}" has ${active} active session(s). Removing it will not affect those sessions but drivers will no longer see it as a destination. Proceed?`,
        onOk:  doDelete,
      });
    } else {
      setConfirm({
        title: 'Remove Destination',
        text:  `Are you sure you want to remove "${dest.name}"? This cannot be undone.`,
        onOk:  doDelete,
      });
    }
  };

  return (
    <div className="page-content">
      <ToastContainer toasts={toasts} />
      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <div className="page-subtitle">Add, edit, or remove mall destinations</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {/* search */}
          <div className="search-input-wrapper" style={{ maxWidth: 220 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search destinations..."
            />
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Destination
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      {!loading && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          background: 'var(--surface-card)', border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-card)',
          marginBottom: 'var(--space-6)', overflow: 'hidden',
        }}>
          {[
            {
              label: 'Destinations',
              value: destinations.length,
              color: 'var(--brand-primary)',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
            },
            {
              label: 'Total Slots',
              value: slots.length,
              color: 'var(--color-info)',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-info)" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
            },
            {
              label: 'Active Sessions',
              value: sessions.length,
              color: 'var(--color-occupied)',
              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-occupied)" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
            },
          ].map(({ label, value, color, icon }, i) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-4) var(--space-5)',
              borderRight: i < 2 ? '1px solid var(--gray-100)' : 'none',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-lg)',
                background: `${color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--gray-900)', lineHeight: 1, marginTop: 2 }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Slide-in drawer for Add / Edit ── */}
      {showForm && (
        <>
          {/* backdrop */}
          <div
            onClick={closeForm}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(3px)', zIndex: 300 }}
          />
          {/* drawer */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
            background: 'var(--surface-card)', boxShadow: '-12px 0 40px rgba(0,0,0,0.15)',
            zIndex: 301, display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.25s cubic-bezier(0.22,1,0.36,1)',
          }}>
            <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

            {/* ── Colored header band ── */}
            <div style={{
              background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dk) 100%)',
              padding: 'var(--space-6)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* decorative circle */}
              <div style={{
                position: 'absolute', top: -30, right: -30,
                width: 120, height: 120, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
              }} />
              <div style={{
                position: 'absolute', bottom: -20, right: 40,
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(255,255,255,0.04)',
              }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {editingId ? 'Edit Destination' : 'New Destination'}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                    {editingId ? (form.name || 'Edit Destination') : 'Add Destination'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                    {editingId ? 'Update the details below' : 'Fill in the details to add a new destination'}
                  </div>
                </div>
                <button
                  onClick={closeForm}
                  style={{
                    width: 32, height: 32, borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,255,255,0.15)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#fff', flexShrink: 0,
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Drawer body ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)' }}>
              <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                <label className="form-label">Destination Name <span className="required">*</span></label>
                <input
                  className={`input${formErrors.name ? ' error' : ''}`}
                  value={form.name}
                  onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setFormErrors((p) => ({ ...p, name: '' })); }}
                  placeholder="e.g. Carrefour Supermarket"
                  autoFocus
                />
                {formErrors.name && <div className="form-error">{formErrors.name}</div>}
              </div>

              {/* GPS fields — side by side */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                  GPS Anchor Coordinates <span className="required">*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-500)', marginBottom: 4, display: 'block' }}>Latitude</label>
                    <input
                      className={`input${formErrors.anchorLat ? ' error' : ''}`}
                      value={form.anchorLat} type="number" step="0.000001"
                      onChange={(e) => { setForm((p) => ({ ...p, anchorLat: e.target.value })); setFormErrors((p) => ({ ...p, anchorLat: '' })); }}
                      placeholder="0.32845"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}
                    />
                    {formErrors.anchorLat && <div className="form-error">{formErrors.anchorLat}</div>}
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-500)', marginBottom: 4, display: 'block' }}>Longitude</label>
                    <input
                      className={`input${formErrors.anchorLng ? ' error' : ''}`}
                      value={form.anchorLng} type="number" step="0.000001"
                      onChange={(e) => { setForm((p) => ({ ...p, anchorLng: e.target.value })); setFormErrors((p) => ({ ...p, anchorLng: '' })); }}
                      placeholder="32.60412"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}
                    />
                    {formErrors.anchorLng && <div className="form-error">{formErrors.anchorLng}</div>}
                  </div>
                </div>
              </div>

              {/* hint */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                background: 'var(--brand-primary-lt)', border: '1px solid rgba(26,86,219,0.15)',
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-xs)', color: 'var(--brand-primary)',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>The GPS anchor is used to calculate the nearest parking slot for drivers heading to this destination. Use coordinates from Google Maps or OpenStreetMap.</span>
              </div>
            </div>

            {/* ── Drawer footer ── */}
            <div style={{ padding: 'var(--space-5) var(--space-6)', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: 'var(--space-3)', background: 'var(--gray-50)' }}>
              <button className="btn btn-outline-gray" style={{ flex: 1 }} onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
                {saving
                  ? <><span className="btn-spinner" /> Saving...</>
                  : <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        {editingId
                          ? <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>
                          : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                        }
                      </svg>
                      {editingId ? 'Save Changes' : 'Add Destination'}
                    </>
                }
              </button>
            </div>
          </div>
        </>
      )}

      {/* Cards grid */}
      {(() => {
        const filtered = destinations.filter((d) =>
          d.name.toLowerCase().includes(search.toLowerCase())
        );
        if (loading) return (
          <>
            <style>{`
              .dest-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: var(--space-4); }
              @media (max-width: 1024px) { .dest-grid { grid-template-columns: repeat(2,1fr); } }
              @media (max-width: 640px)  { .dest-grid { grid-template-columns: 1fr; } }
            `}</style>
            <div className="dest-grid">
              {Array(6).fill(null).map((_, i) => (
                <div key={i} className="skeleton-card" style={{ height: 140 }} />
              ))}
            </div>
          </>
        );
        if (filtered.length === 0) return (
          <div className="card">
            <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <div className="empty-state-title">
                {search ? `No destinations match "${search}"` : 'No destinations yet'}
              </div>
              <div className="empty-state-text">
                {search ? 'Try a different search term.' : 'Click "Add Destination" to get started.'}
              </div>
            </div>
          </div>
        );
        return (
          <>
            <style>{`
              .dest-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: var(--space-4); }
              @media (max-width: 1024px) { .dest-grid { grid-template-columns: repeat(2,1fr); } }
              @media (max-width: 640px)  { .dest-grid { grid-template-columns: 1fr; } }
            `}</style>
            <div className="dest-grid">
              {filtered.map((dest, idx) => {
            const id       = dest._id || dest.id;
            const active   = activeSessions(id);
            const slotsN   = slotCount(id);
            const occPct   = slotsN ? Math.round((active / slotsN) * 100) : 0;
            const barColor = occPct > 80 ? 'var(--color-occupied)' : occPct > 50 ? 'var(--color-warning)' : 'var(--color-available)';
            return (
              <DestCard
                key={id}
                dest={dest}
                active={active}
                slotsN={slotsN}
                occPct={occPct}
                barColor={barColor}
                onEdit={openEdit}
                onDelete={handleDelete}
                colorIdx={idx}
              />
            );
          })}
            </div>
          </>
        );
      })()}
    </div>
  );
}
