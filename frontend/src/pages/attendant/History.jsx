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
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="page-title">Session History</div>
            <div className="page-subtitle">All vehicle sessions — most recent first</div>
          </div>
          <div className="live-indicator">LIVE</div>
        </div>

        {/* toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>

          {/* search */}
          <div className="search-input-wrapper" style={{ maxWidth: 280, width: '100%' }}>
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

          {/* 5A: status tabs */}
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

          {/* 5B: today toggle */}
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

          <div style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
            {displayed.length} record{displayed.length !== 1 ? 's' : ''}
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
                      <div className="empty-state-title">No sessions found</div>
                      <div className="empty-state-text">
                        {todayOnly ? 'No sessions today. Toggle "Today only" off to see all history.' : 'Try a different search term.'}
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
                      <tr key={rowId} style={{ background: isExp ? 'var(--gray-50)' : undefined }}>
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
                      {/* 5D: expanded row — hidden columns revealed */}
                      {isExp && (
                        <tr key={`${rowId}-exp`} style={{ background: 'var(--gray-50)' }}>
                          <td />
                          <td colSpan={9}>
                            <div style={{ display: 'flex', gap: 'var(--space-6)', padding: 'var(--space-2) 0 var(--space-3)', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-400)', marginBottom: 2 }}>Phone</div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-700)' }}>{s.driverPhone}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-400)', marginBottom: 2 }}>Attendant</div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-700)' }}>{s.attendantName || '—'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-400)', marginBottom: 2 }}>Exit Time</div>
                                <div style={{ fontSize: 'var(--text-xs)', color: isActive ? 'var(--gray-400)' : 'var(--gray-700)' }}>
                                  {isActive ? '—' : formatDateTime(s.exitTime)}
                                </div>
                              </div>
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
