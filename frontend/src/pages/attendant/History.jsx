import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { getSocket } from './AttendantLayout';

function elapsed(entryTime) {
  const ms = Date.now() - new Date(entryTime).getTime();
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}
function duration(entry, exit) {
  const ms = new Date(exit) - new Date(entry);
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-UG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}
function isToday(dateStr) {
  const d = new Date(dateStr);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function AttendantHistory() {
  const navigate                        = useNavigate();
  const [sessions,   setSessions]       = useState([]);
  const [search,     setSearch]         = useState('');
  const [loading,    setLoading]        = useState(true);
  const [statusTab,  setStatusTab]      = useState('ALL');   // 5A: 'ALL'|'ACTIVE'|'CLOSED'
  const [todayOnly,  setTodayOnly]      = useState(true);    // 5B: default ON
  const [expanded,   setExpanded]       = useState({});      // 5D: expanded rows

  const fetchSessions = useCallback(async (term = '') => {
    try {
      const params = term ? `?search=${encodeURIComponent(term)}` : '';
      const { data } = await api.get(`/api/sessions${params}`);
      setSessions(Array.isArray(data) ? data : data.sessions || []);
    } catch { setSessions([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    const id = setTimeout(() => fetchSessions(search), 300);
    return () => clearTimeout(id);
  }, [search, fetchSessions]);

  useEffect(() => {
    const s = getSocket();
    const onCreated = ({ session }) => setSessions((prev) => [session, ...prev]);
    const onClosed  = (payload) => {
      const id = payload.sessionId || payload._id;
      setSessions((prev) => prev.map((s) =>
        (s._id === id || s.id === id) ? { ...s, status: 'CLOSED', exitTime: new Date().toISOString() } : s
      ));
    };
    s.on('session_created', onCreated);
    s.on('session_closed',  onClosed);
    return () => { s.off('session_created', onCreated); s.off('session_closed', onClosed); };
  }, []);

  const exportCSV = () => {
    const headers = ['Plate', 'Phone', 'Destination', 'Slot', 'Attendant', 'Entry Time', 'Exit Time', 'Duration', 'Status'];
    const rows = displayed.map((s) => {
      const isActive = s.status === 'ACTIVE';
      const dur = isActive ? elapsed(s.entryTime) : duration(s.entryTime, s.exitTime);
      return [
        s.plateNumber, s.driverPhone, s.destinationName, s.slotId,
        s.attendantName || '—', formatDateTime(s.entryTime),
        isActive ? '—' : formatDateTime(s.exitTime), dur, s.status,
      ].join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `session-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* apply all filters */
  const displayed = sessions.filter((s) => {
    if (statusTab !== 'ALL' && s.status !== statusTab) return false;
    if (todayOnly && !isToday(s.entryTime)) return false;
    return true;
  });

  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="page-content">
      {/* responsive column styles */}
      <style>{`
        @media (max-width: 1100px) {
          .hist-col-phone, .hist-col-attendant { display: none; }
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* stat cards */}
        {(() => {
          const todaySessions = sessions.filter((s) => isToday(s.entryTime));
          const activeNow     = sessions.filter((s) => s.status === 'ACTIVE').length;
          const closedToday   = todaySessions.filter((s) => s.status === 'CLOSED').length;
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
              {[
                {
                  label: 'Total Today', value: todaySessions.length,
                  color: 'var(--brand-primary)', bg: 'var(--brand-primary-lt)',
                  delta: 'Sessions since midnight',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
                },
                {
                  label: 'Active Now', value: activeNow,
                  color: 'var(--color-available)', bg: 'var(--color-available-lt)',
                  delta: 'Vehicles currently parked',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
                },
                {
                  label: 'Closed Today', value: closedToday,
                  color: 'var(--color-oos)', bg: 'var(--color-oos-lt)',
                  delta: 'Vehicles that have exited',
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
                },
              ].map(({ label, value, color, bg, delta, icon }) => (
                <div key={label} style={{
                  background: 'var(--surface-card)', border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-card)',
                  overflow: 'hidden',
                }}>
                  <div style={{ height: 4, background: color }} />
                  <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {icon}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    </div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--gray-900)', marginBottom: 4, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', fontWeight: 500 }}>{delta}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* toolbar */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          {/* Row 1: search + live indicator + record count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div className="search-input-wrapper" style={{ maxWidth: 280, width: '100%', flex: 1 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plate, phone, slot..."
              />
            </div>
            <div className="live-indicator">LIVE</div>
            <div style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--gray-500)', fontWeight: 600 }}>
              {displayed.length} record{displayed.length !== 1 ? 's' : ''}
            </div>
            <button className="btn btn-outline-gray btn-sm" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
          </div>

          {/* Row 2: status tabs + today toggle + clear */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {/* status tabs */}
            <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 'var(--radius-md)', padding: 3, gap: 2 }}>
              {[['ALL','All'],['ACTIVE','Active'],['CLOSED','Closed']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setStatusTab(val)}
                  style={{
                    padding: '5px 14px', fontSize: 'var(--text-xs)', fontWeight: 600,
                    borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    background: statusTab === val ? 'var(--surface-card)' : 'transparent',
                    color: statusTab === val
                      ? val === 'ACTIVE' ? 'var(--color-available)' : val === 'CLOSED' ? 'var(--gray-600)' : 'var(--gray-800)'
                      : 'var(--gray-500)',
                    boxShadow: statusTab === val ? 'var(--shadow-xs)' : 'none',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* today toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-600)' }}>
              <div
                onClick={() => setTodayOnly((t) => !t)}
                style={{
                  width: 36, height: 20, borderRadius: 'var(--radius-full)', position: 'relative', cursor: 'pointer',
                  background: todayOnly ? 'var(--brand-primary)' : 'var(--gray-300)',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: todayOnly ? 18 : 2, width: 16, height: 16,
                  borderRadius: '50%', background: '#fff', boxShadow: 'var(--shadow-xs)',
                  transition: 'left var(--transition-fast)',
                }} />
              </div>
              Today only
            </label>

            {/* clear filters */}
            {(statusTab !== 'ALL' || !todayOnly || search) && (
              <button
                className="btn btn-outline-gray btn-sm"
                onClick={() => { setStatusTab('ALL'); setTodayOnly(true); setSearch(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="skeleton-card">
            {Array(6).fill(null).map((_, i) => (
              <div key={i} className="skeleton-table-row">
                {Array(7).fill(null).map((__, j) => <div key={j} className="skeleton" style={{ flex: 1, height: 14 }} />)}
              </div>
            ))}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th></th>{/* expand chevron */}
                  <th>Plate</th>
                  <th className="hist-col-phone">Phone</th>
                  <th>Destination</th>
                  <th>Slot</th>
                  <th className="hist-col-attendant">Attendant</th>
                  <th>Entry</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th></th>{/* actions */}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={10}>
                    <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <div className="empty-state-title">
                        {search ? `No results for "${search}"` : statusTab !== 'ALL' ? `No ${statusTab.toLowerCase()} sessions` : todayOnly ? 'No sessions today' : 'No sessions found'}
                      </div>
                      <div className="empty-state-text">
                        {search ? 'Try a different plate number, phone or slot.'
                          : statusTab === 'ACTIVE' ? 'No vehicles are currently parked.'
                          : statusTab === 'CLOSED' ? (todayOnly ? 'No vehicles have exited today.' : 'No closed sessions found.')
                          : todayOnly ? 'No sessions recorded today. Toggle "Today only" off to see all history.'
                          : 'No sessions match the current filters.'}
                      </div>
                    </div>
                  </td></tr>
                ) : displayed.map((s) => {
                  const isActive = s.status === 'ACTIVE';
                  const dur      = isActive ? elapsed(s.entryTime) : duration(s.entryTime, s.exitTime);
                  const rowId    = s._id || s.id;
                  const isExp    = expanded[rowId];
                  return (
                    <>
                      <tr key={rowId} style={{ background: isExp ? 'var(--gray-50)' : undefined, borderLeft: `3px solid ${isActive ? 'var(--color-available)' : 'var(--gray-200)'}` }}>
                        {/* 5D: expand chevron */}
                        <td style={{ width: 32, paddingRight: 0 }}>
                          <button
                            onClick={() => toggleExpand(rowId)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 4, display: 'flex' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              {isExp ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                            </svg>
                          </button>
                        </td>
                        <td className="td-plate">{s.plateNumber}</td>
                        <td className="hist-col-phone" style={{ fontSize: 'var(--text-xs)' }}>{s.driverPhone}</td>
                        <td style={{ fontSize: 'var(--text-xs)', maxWidth: 130 }}>{s.destinationName}</td>
                        <td className="td-slot">{s.slotId}</td>
                        <td className="hist-col-attendant" style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)' }}>{s.attendantName || '—'}</td>
                        <td style={{ fontSize: 'var(--text-xs)' }}>{formatDateTime(s.entryTime)}</td>
                        <td style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: isActive ? 'var(--color-occupied)' : 'var(--gray-600)' }}>{dur}</td>
                        <td><span className={`badge ${isActive ? 'badge-active' : 'badge-closed'}`}>{isActive ? 'Active' : 'Closed'}</span></td>
                        {/* 5C: quick exit button */}
                        <td style={{ textAlign: 'right' }}>
                          {isActive && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => navigate(`/attendant/exit?plate=${encodeURIComponent(s.plateNumber)}`)}
                              title="Process exit for this vehicle"
                            >
                              Exit →
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* expanded row */}
                      {isExp && (
                        <tr key={`${rowId}-exp`} style={{ background: 'var(--gray-50)', borderLeft: `3px solid ${isActive ? 'var(--color-available)' : 'var(--gray-200)'}` }}>
                          <td />
                          <td colSpan={9}>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3) 0 var(--space-4)', flexWrap: 'wrap' }}>
                              {[
                                { label: 'Phone',      value: s.driverPhone,              mono: false },
                                { label: 'Attendant',  value: s.attendantName || '—',     mono: false },
                                { label: 'Entry Time', value: formatDateTime(s.entryTime), mono: false },
                                { label: 'Exit Time',  value: isActive ? '—' : formatDateTime(s.exitTime), mono: false },
                                { label: 'Duration',   value: dur,                         mono: true  },
                              ].map(({ label, value, mono }) => (
                                <div key={label} style={{
                                  background: 'var(--surface-card)',
                                  border: '1px solid var(--gray-200)',
                                  borderRadius: 'var(--radius-lg)',
                                  padding: 'var(--space-3) var(--space-4)',
                                  minWidth: 120,
                                  boxShadow: 'var(--shadow-xs)',
                                }}>
                                  <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray-400)', marginBottom: 4 }}>{label}</div>
                                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-800)', fontFamily: mono ? 'var(--font-mono)' : undefined }}>{value}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
