import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../lib/api';
import { getOpSocket } from './OperatorLayout';

function elapsed(entryTime) {
  const ms = Date.now() - new Date(entryTime).getTime();
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}
function isLongStay(entryTime) {
  const ms = Date.now() - new Date(entryTime).getTime();
  return ms > 6 * 60 * 60 * 1000; // 6 hours in milliseconds
}
function duration(entry, exit) {
  const ms = new Date(exit) - new Date(entry);
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-UG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function OperatorHistory() {
  const [sessions,       setSessions]       = useState([]);
  const [search,         setSearch]         = useState('');
  const [loading,        setLoading]        = useState(true);
  const [statusTab,      setStatusTab]      = useState('ALL');
  const [todayOnly,      setTodayOnly]      = useState(false);
  const [dateFilter,     setDateFilter]     = useState('');
  const [attendantFilter,setAttendantFilter]= useState('ALL');
  const [expanded,       setExpanded]       = useState({});

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
    const s = getOpSocket();
    const onCreated = ({ session }) => setSessions((prev) => [session, ...prev]);
    const onClosed  = (payload) => {
      const id = payload.sessionId || payload._id;
      setSessions((prev) => prev.map((s) => (s._id === id || s.id === id) ? { ...s, status: 'CLOSED', exitTime: new Date().toISOString() } : s));
    };
    s.on('session_created', onCreated);
    s.on('session_closed',  onClosed);
    return () => { s.off('session_created', onCreated); s.off('session_closed', onClosed); };
  }, []);

  /* derive filtered list + attendant options */
  const attendants = ['ALL', ...new Set(sessions.map((s) => s.attendantName).filter(Boolean))];
  const isToday = (d) => { const n = new Date(); const t = new Date(d); return t.getFullYear()===n.getFullYear()&&t.getMonth()===n.getMonth()&&t.getDate()===n.getDate(); };
  const isSameDate = (d, filterDate) => { const t = new Date(d); const f = new Date(filterDate); return t.getFullYear()===f.getFullYear()&&t.getMonth()===f.getMonth()&&t.getDate()===f.getDate(); };
  const displayed = sessions.filter((s) => {
    if (statusTab !== 'ALL' && s.status !== statusTab) return false;
    if (todayOnly && !isToday(s.entryTime)) return false;
    if (dateFilter && !isSameDate(s.entryTime, dateFilter)) return false;
    if (attendantFilter !== 'ALL' && s.attendantName !== attendantFilter) return false;
    return true;
  });

  /* check if any filters are active */
  const hasActiveFilters = search || statusTab !== 'ALL' || todayOnly || dateFilter || attendantFilter !== 'ALL';

  /* clear all filters */
  const clearAllFilters = () => {
    setSearch('');
    setStatusTab('ALL');
    setTodayOnly(false);
    setDateFilter('');
    setAttendantFilter('ALL');
  };

  /* summary strip stats */
  const midnight = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const todaySess   = sessions.filter((s) => new Date(s.entryTime) >= midnight);
  const activeNow   = sessions.filter((s) => s.status === 'ACTIVE').length;
  const closedToday = todaySess.filter((s) => s.status === 'CLOSED' && s.exitTime);
  const avgMs  = closedToday.length ? closedToday.reduce((sum,s) => sum+(new Date(s.exitTime)-new Date(s.entryTime)),0)/closedToday.length : 0;
  const avgMin = Math.round(avgMs/60000);

  /* smart empty state message */
  const getEmptyStateMessage = () => {
    if (search) return { title: 'No sessions found', text: `No sessions match "${search}"` };
    if (todayOnly || dateFilter) return { title: 'No sessions found', text: dateFilter ? `No sessions on ${new Date(dateFilter).toLocaleDateString('en-UG')}` : 'No sessions today' };
    if (statusTab !== 'ALL') return { title: 'No sessions found', text: `No ${statusTab.toLowerCase()} sessions found` };
    if (attendantFilter !== 'ALL') return { title: 'No sessions found', text: `No sessions for ${attendantFilter}` };
    return { title: 'No sessions recorded yet', text: 'Sessions will appear here once vehicles start parking.' };
  };

  /* CSV export */
  const exportCSV = () => {
    const headers = ['Plate','Phone','Destination','Slot','Attendant','Entry','Exit','Duration','Status'];
    const rows = displayed.map((s) => {
      const isActive = s.status === 'ACTIVE';
      const dur = isActive ? elapsed(s.entryTime) : duration(s.entryTime, s.exitTime);
      return [s.plateNumber, s.driverPhone, s.destinationName, s.slotId, s.attendantName||'', formatDateTime(s.entryTime), isActive?'':formatDateTime(s.exitTime), dur, s.status].join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = `sessions-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <div className="page-subtitle">All vehicle sessions across all attendants</div>
        <div className="live-indicator">LIVE</div>
      </div>

      {/* summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        {[
          { label: 'Total Sessions', value: sessions.length, color: 'var(--brand-primary)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, delta: 'All time' },
          { label: 'Active Now',     value: activeNow,       color: 'var(--color-occupied)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/></svg>, delta: 'Live count' },
          { label: "Today's Entries",value: todaySess.length,color: 'var(--color-available)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, delta: 'Since midnight' },
          { label: 'Avg Duration',   value: avgMin > 0 ? `${avgMin}m` : '—', color: 'var(--color-warning)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, delta: 'Today only' },
        ].map(({ label, value, color, icon, delta }) => (
          <div key={label} style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--gray-200)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* colored top border */}
            <div style={{ height: 4, background: color }} />
            <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
              {/* icon circle + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: `${color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color
                }}>
                  {icon}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              </div>
              {/* large number */}
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, color: 'var(--gray-900)', marginBottom: 6 }}>{value}</div>
              {/* delta line */}
              <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', fontWeight: 500 }}>{delta}</div>
            </div>
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        {/* Row 1: Search + Record Count + Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div className="search-input-wrapper" style={{ maxWidth: 320, width: '100%', flex: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plate or phone..." />
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--gray-500)', fontWeight: 600 }}>
            {displayed.length} record{displayed.length !== 1 ? 's' : ''}
          </div>
          <button className="btn btn-outline-gray btn-sm" onClick={exportCSV}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
        
        {/* Row 2: All Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {/* status tabs */}
          <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 'var(--radius-md)', padding: 3, gap: 2 }}>
            {[['ALL','All'],['ACTIVE','Active'],['CLOSED','Closed']].map(([val,label]) => (
              <button key={val} onClick={() => setStatusTab(val)}
                style={{ padding: '5px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: statusTab===val ? 'var(--surface-card)' : 'transparent', color: statusTab===val ? 'var(--gray-800)' : 'var(--gray-500)', boxShadow: statusTab===val ? 'var(--shadow-xs)' : 'none', transition: 'all var(--transition-fast)' }}>
                {label}
              </button>
            ))}
          </div>
          {/* today toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-600)' }}>
            <div onClick={() => setTodayOnly((t) => !t)} style={{ width: 36, height: 20, borderRadius: 'var(--radius-full)', position: 'relative', cursor: 'pointer', background: todayOnly ? 'var(--brand-primary)' : 'var(--gray-300)', transition: 'background var(--transition-fast)' }}>
              <div style={{ position: 'absolute', top: 2, left: todayOnly ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: 'var(--shadow-xs)', transition: 'left var(--transition-fast)' }} />
            </div>
            Today only
          </label>
          {/* date filter */}
          <input
            type="date"
            className="select"
            style={{ width: 'auto', minWidth: 140 }}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            title="Filter by specific date"
          />
          {/* attendant filter */}
          <select className="select" style={{ width: 'auto', minWidth: 140 }} value={attendantFilter} onChange={(e) => setAttendantFilter(e.target.value)}>
            {attendants.map((a) => <option key={a} value={a}>{a === 'ALL' ? 'All Attendants' : a}</option>)}
          </select>
          {/* clear filters button */}
          {hasActiveFilters && (
            <button
              className="btn btn-outline-gray btn-sm"
              onClick={clearAllFilters}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="skeleton-card">
          {Array(8).fill(null).map((_, i) => (
            <div key={i} className="skeleton-table-row">
              {Array(9).fill(null).map((__, j) => <div key={j} className="skeleton" style={{ flex: 1, height: 14 }} />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Plate</th><th>Phone</th><th>Destination</th><th>Slot</th>
                <th>Attendant</th><th>Entry</th><th>Exit</th><th>Duration</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                    <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div className="empty-state-title">{getEmptyStateMessage().title}</div>
                    <div className="empty-state-text">{getEmptyStateMessage().text}</div>
                  </div>
                </td></tr>
              ) : displayed.map((s) => {
                const isActive = s.status === 'ACTIVE';
                const dur   = isActive ? elapsed(s.entryTime) : duration(s.entryTime, s.exitTime);
                const rowId = s._id || s.id;
                const isExp = expanded[rowId];
                return (
                  <>
                    <tr key={rowId} style={{ borderLeft: `3px solid ${isActive ? 'var(--color-available)' : 'var(--gray-200)'}`, position: 'relative' }}
                        onMouseEnter={(e) => {
                          const btn = e.currentTarget.querySelector('.details-btn');
                          if (btn) btn.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                          const btn = e.currentTarget.querySelector('.details-btn');
                          if (btn) btn.style.opacity = '0';
                        }}>
                      <td className="td-plate">{s.plateNumber}</td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{s.driverPhone}</td>
                      <td style={{ fontSize: 'var(--text-xs)', maxWidth: 140 }}>{s.destinationName}</td>
                      <td className="td-slot">{s.slotId}</td>
                      <td style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)' }}>{s.attendantName || '—'}</td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{formatDateTime(s.entryTime)}</td>
                      <td style={{ fontSize: 'var(--text-xs)', color: isActive ? 'var(--gray-400)' : 'var(--gray-700)' }}>{isActive ? '—' : formatDateTime(s.exitTime)}</td>
                      <td style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: isActive ? 'var(--color-occupied)' : 'var(--gray-600)', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{dur}</span>
                          {isActive && isLongStay(s.entryTime) && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              background: 'var(--color-warning)',
                              color: '#fff',
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              ⚠ Long stay
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ position: 'relative' }}>
                        <span className={`badge ${isActive ? 'badge-active' : 'badge-closed'}`}>{isActive ? 'Active' : 'Closed'}</span>
                        {/* Details button that slides in on hover */}
                        <button
                          className="details-btn"
                          onClick={() => setExpanded((p) => ({ ...p, [rowId]: !p[rowId] }))}
                          style={{
                            position: 'absolute',
                            right: -8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'var(--surface-card)',
                            border: '1px solid var(--gray-300)',
                            borderRadius: 'var(--radius-full)',
                            padding: '4px 10px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--gray-600)',
                            cursor: 'pointer',
                            opacity: 0,
                            transition: 'all var(--transition-fast)',
                            boxShadow: 'var(--shadow-xs)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {isExp ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {isExp && (
                      <tr key={`${rowId}-exp`} style={{ background: 'var(--gray-50)', borderLeft: `3px solid ${isActive ? 'var(--color-available)' : 'var(--gray-200)'}` }}>
                        <td colSpan={9}>
                          <div style={{ display: 'flex', gap: 'var(--space-6)', padding: 'var(--space-2) 0 var(--space-3)', flexWrap: 'wrap' }}>
                            {[['Session ID', rowId], ['Full Entry Time', new Date(s.entryTime).toLocaleString('en-UG', { dateStyle: 'short', timeStyle: 'medium' })], ['Full Exit Time', isActive ? '—' : new Date(s.exitTime).toLocaleString('en-UG', { dateStyle: 'short', timeStyle: 'medium' })]].map(([k,v]) => (
                              <div key={k}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-400)', marginBottom: 2 }}>{k}</div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-700)', fontFamily: k === 'Session ID' ? 'monospace' : 'inherit' }}>{v}</div>
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
  );
}
