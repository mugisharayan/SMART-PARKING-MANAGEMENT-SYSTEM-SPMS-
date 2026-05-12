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

export default function Destinations() {
  const [destinations, setDestinations] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [editingId,    setEditingId]    = useState(null);   // null = add, string = edit
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [formErrors,   setFormErrors]   = useState({});
  const [saving,       setSaving]       = useState(false);
  const [inlineEdit,   setInlineEdit]   = useState({});    // { [id]: { name, anchorLat, anchorLng } }
  const [confirm,      setConfirm]      = useState(null);  // { title, text, onOk }
  const { toasts, add: toast } = useToast();

  /* ── helpers to count active sessions / slots per dest ── */
  const activeSessions = useCallback((destId) => {
    if (isDemoMode()) return demoSessions.filter((s) => s.destinationId === destId && s.status === 'ACTIVE').length;
    return 0; // populated from API data when available
  }, []);
  const slotCount = useCallback((destId) => {
    if (isDemoMode()) return demoSlots.filter((s) => s.destinationId === destId).length;
    return 0;
  }, []);

  const load = useCallback(async () => {
    if (isDemoMode()) { setDestinations([...demoDestinations]); setLoading(false); return; }
    try {
      const { data } = await api.get('/api/destinations');
      setDestinations(data);
    } catch {
      setDestinations([...demoDestinations]);
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

  /* ── Inline edit ── */
  const startInline = (dest) => {
    setInlineEdit((p) => ({ ...p, [dest._id || dest.id]: { name: dest.name, anchorLat: String(dest.anchorLat), anchorLng: String(dest.anchorLng) } }));
  };
  const cancelInline = (id) => setInlineEdit((p) => { const n = { ...p }; delete n[id]; return n; });

  const saveInline = async (id) => {
    const vals = inlineEdit[id];
    if (!vals?.name.trim()) { toast('error', 'Name required', ''); return; }
    const payload = { name: vals.name.trim(), anchorLat: parseFloat(vals.anchorLat), anchorLng: parseFloat(vals.anchorLng) };
    try {
      if (isDemoMode()) {
        const d = demoDestinations.find((x) => x._id === id || x.id === id);
        if (d) { d.name = payload.name; d.anchorLat = payload.anchorLat; d.anchorLng = payload.anchorLng; }
      } else {
        await api.patch(`/api/destinations/${id}`, payload);
      }
      toast('success', 'Destination updated', payload.name);
      cancelInline(id);
      await load();
    } catch (err) {
      toast('error', 'Save failed', err.response?.data?.message || '');
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

      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Destination Management</div>
          <div className="page-subtitle">Add, edit, or remove mall destinations</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Destination
        </button>
      </div>

      {/* ── Slide-in drawer for Add / Edit ── */}
      {showForm && (
        <>
          {/* backdrop */}
          <div
            onClick={closeForm}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(2px)', zIndex: 300 }}
          />
          {/* drawer */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
            background: 'var(--surface-card)', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
            zIndex: 301, display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.25s cubic-bezier(0.22,1,0.36,1)',
          }}>
            <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
            {/* drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--gray-200)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--gray-900)' }}>
                  {editingId ? 'Edit Destination' : 'Add New Destination'}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginTop: 2 }}>Fill in the details below</div>
              </div>
              <button className="btn-ghost btn-icon" onClick={closeForm}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* drawer body */}
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
              <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                <label className="form-label">GPS Anchor Latitude <span className="required">*</span></label>
                <input
                  className={`input${formErrors.anchorLat ? ' error' : ''}`}
                  value={form.anchorLat} type="number" step="0.00001"
                  onChange={(e) => { setForm((p) => ({ ...p, anchorLat: e.target.value })); setFormErrors((p) => ({ ...p, anchorLat: '' })); }}
                  placeholder="e.g. 0.32845"
                />
                {formErrors.anchorLat && <div className="form-error">{formErrors.anchorLat}</div>}
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-5)' }}>
                <label className="form-label">GPS Anchor Longitude <span className="required">*</span></label>
                <input
                  className={`input${formErrors.anchorLng ? ' error' : ''}`}
                  value={form.anchorLng} type="number" step="0.00001"
                  onChange={(e) => { setForm((p) => ({ ...p, anchorLng: e.target.value })); setFormErrors((p) => ({ ...p, anchorLng: '' })); }}
                  placeholder="e.g. 32.60412"
                />
                {formErrors.anchorLng && <div className="form-error">{formErrors.anchorLng}</div>}
              </div>
              <div className="alert alert-info" style={{ fontSize: 'var(--text-xs)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                The GPS anchor is used to calculate the nearest parking slot for drivers heading to this destination.
              </div>
            </div>
            {/* drawer footer */}
            <div style={{ padding: 'var(--space-5) var(--space-6)', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-outline-gray" style={{ flex: 1 }} onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
                {saving ? <><span className="btn-spinner" /> Saving...</> : editingId ? 'Save Changes' : 'Add Destination'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Cards grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-4)' }}>
          {Array(6).fill(null).map((_, i) => (
            <div key={i} className="skeleton-card" style={{ height: 140 }} />
          ))}
        </div>
      ) : destinations.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
            <div className="empty-state-title">No destinations yet</div>
            <div className="empty-state-text">Click "Add Destination" to get started.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-4)' }}>
          {destinations.map((dest) => {
            const id      = dest._id || dest.id;
            const active  = activeSessions(id);
            const slotsN  = slotCount(id);
            const occPct  = slotsN ? Math.round((active / slotsN) * 100) : 0;
            const barColor = occPct > 80 ? 'var(--color-occupied)' : occPct > 50 ? 'var(--color-warning)' : 'var(--color-available)';
            return (
              <div key={id} className="card" style={{ transition: 'box-shadow var(--transition-fast), transform var(--transition-fast)' }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = ''; }}
              >
                <div className="card-body">
                  {/* header row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--gray-900)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dest.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                        {Number(dest.anchorLat).toFixed(4)}, {Number(dest.anchorLng).toFixed(4)}
                      </div>
                    </div>
                    <span className={`badge ${active > 0 ? 'badge-active' : 'badge-closed'}`} style={{ flexShrink: 0, marginLeft: 'var(--space-2)' }}>
                      {active} active
                    </span>
                  </div>
                  {/* stats row */}
                  <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--gray-900)', lineHeight: 1 }}>{slotsN}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Slots</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-occupied)', lineHeight: 1 }}>{active}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Occupied</div>
                    </div>
                  </div>
                  {/* occupancy bar */}
                  <div style={{ height: 5, background: 'var(--gray-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 'var(--space-4)' }}>
                    <div style={{ height: '100%', width: `${occPct}%`, background: barColor, borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
                  </div>
                  {/* actions */}
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => startInline(dest)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => handleDelete(dest)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
