import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../lib/api';
import { getOpSocket } from './OperatorLayout';

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-UG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function buildLogs(sessions) {
  const logs = [];
  sessions.forEach((s) => {
    logs.push({ type: 'ENTRY', plate: s.plateNumber, attendant: s.attendantName || '—', slotId: s.slotId, time: s.entryTime, sessionId: s._id || s.id });
    if (s.exitTime) logs.push({ type: 'EXIT', plate: s.plateNumber, attendant: s.attendantName || '—', slotId: s.slotId, time: s.exitTime, sessionId: s._id || s.id });
  });
  return logs.sort((a, b) => new Date(b.time) - new Date(a.time));
}

/* Mini hourly bar chart — last 12 hours */
function MiniBarChart({ logs }) {
  const W = 400, H = 60, PAD = { top: 8, right: 8, bottom: 20, left: 24 };
  const now         = new Date();
  const currentHour = now.getHours();
  const hours       = Array.from({ length: 12 }, (_, i) => (currentHour - 11 + i + 24) % 24);
  const midnight    = new Date(); midnight.setHours(0, 0, 0, 0);

  const counts = hours.map((h) =>
    logs.filter((l) => {
      const d = new Date(l.time);
      return d >= midnight && d.getHours() === h;
    }).length
  );
  const maxVal  = Math.max(...counts, 1);
  const chartW  = W - PAD.left - PAD.right;
  const chartH  = H - PAD.top - PAD.bottom;
  const barW    = chartW / hours.length - 3;

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {counts.map((v, i) => {
          const x   = PAD.left + i * (chartW / hours.length);
          const bH  = Math.max((v / maxVal) * chartH, v > 0 ? 3 : 0);
          const y   = PAD.top + chartH - bH;
          const lbl = hours[i] === 0 ? '12a' : hours[i] < 12 ? `${hours[i]}a` : hours[i] === 12 ? '12p' : `${hours[i]-12}p`;
          return (
            <g key={i}>
              <rect 
                x={x} y={y} width={barW} height={bH} rx="2"
                fill={v > 0 ? 'var(--brand-primary)' : 'var(--gray-100)'} 
                fillOpacity={v > 0 ? 0.8 : 1}
              />
              {/* Hover tooltip */}
              <title>{`${lbl}: ${v} event${v !== 1 ? 's' : ''}`}</title>
              <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--gray-400)">{lbl}</text>
            </g>
          );
        })}
        {/* y-axis labels */}
        <text x={PAD.left - 2} y={PAD.top + 4} textAnchor="end" fontSize="8" fill="var(--gray-400)">{maxVal}</text>
        <text x={PAD.left - 2} y={PAD.top + chartH} textAnchor="end" fontSize="8" fill="var(--gray-400)">0</text>
      </svg>
    </div>
  );
}

export default function BarrierLog() {
  const [logs,        setLogs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('ALL'); // 'ALL'|'ENTRY'|'EXIT'
  const [attendantFilter, setAttendantFilter] = useState('ALL');
  const [dateRange,   setDateRange]   = useState('ALL'); // 'ALL'|'TODAY'|'YESTERDAY'|'LAST_7'|'LAST_30'
  const [dateFilter,  setDateFilter]  = useState(''); // specific date

  const load = useCallback(async () => {
    try {
      /* Try dedicated barrier-logs endpoint first, fall back to building from sessions */
      try {
        const { data } = await api.get('/api/barrier-logs');
        setLogs(Array.isArray(data) ? data : data.logs || []);
      } catch {
        const { data } = await api.get('/api/sessions');
        setLogs(buildLogs(Array.isArray(data) ? data : data.sessions || []));
      }
    } catch (err) {
      console.error('BarrierLog load failed:', err.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const s = getOpSocket();
    const onCreated = ({ session }) => {
      if (!session) return;
      setLogs((prev) => [{ type: 'ENTRY', plate: session.plateNumber, attendant: session.attendantName || '—', slotId: session.slotId, time: session.entryTime, sessionId: session._id }, ...prev]);
    };
    const onClosed = ({ sessionId }) => {
      setLogs((prev) => {
        const entry = prev.find((l) => l.sessionId === sessionId && l.type === 'ENTRY');
        if (!entry) return prev;
        return [{ type: 'EXIT', plate: entry.plate, attendant: entry.attendant, slotId: entry.slotId, time: new Date().toISOString(), sessionId }, ...prev];
      });
    };
    s.on('session_created', onCreated);
    s.on('session_closed',  onClosed);
    return () => { s.off('session_created', onCreated); s.off('session_closed', onClosed); };
  }, []);

  /* derived */
  const midnight = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const todayLogs   = logs.filter((l) => new Date(l.time) >= midnight);
  const entriesToday = todayLogs.filter((l) => l.type === 'ENTRY').length;
  const exitsToday   = todayLogs.filter((l) => l.type === 'EXIT').length;

  /* attendant options */
  const attendants = ['ALL', ...new Set(logs.map((l) => l.attendant).filter(Boolean).filter(a => a !== '—'))];

  /* date filtering logic */
  const isInDateRange = (logTime) => {
    const logDate = new Date(logTime);
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      const filterStart = new Date(filterDate); filterStart.setHours(0, 0, 0, 0);
      const filterEnd = new Date(filterDate); filterEnd.setHours(23, 59, 59, 999);
      return logDate >= filterStart && logDate <= filterEnd;
    }
    
    switch (dateRange) {
      case 'TODAY':
        return logDate >= todayStart && logDate <= today;
      case 'YESTERDAY':
        const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayStart); yesterdayEnd.setTime(yesterdayEnd.getTime() - 1);
        return logDate >= yesterdayStart && logDate <= yesterdayEnd;
      case 'LAST_7':
        const week = new Date(todayStart); week.setDate(week.getDate() - 7);
        return logDate >= week && logDate <= today;
      case 'LAST_30':
        const month = new Date(todayStart); month.setDate(month.getDate() - 30);
        return logDate >= month && logDate <= today;
      default:
        return true;
    }
  };

  const displayed = logs.filter((l) => {
    if (typeFilter !== 'ALL' && l.type !== typeFilter) return false;
    if (attendantFilter !== 'ALL' && l.attendant !== attendantFilter) return false;
    if (!isInDateRange(l.time)) return false;
    if (search) {
      const t = search.toLowerCase();
      return l.plate.toLowerCase().includes(t) || l.attendant.toLowerCase().includes(t);
    }
    return true;
  });

  /* check if any filters are active */
  const hasActiveFilters = search || typeFilter !== 'ALL' || attendantFilter !== 'ALL' || dateRange !== 'ALL' || dateFilter;

  /* clear all filters */
  const clearAllFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setAttendantFilter('ALL');
    setDateRange('ALL');
    setDateFilter('');
  };

  /* smart empty state message */
  const getEmptyStateMessage = () => {
    if (search) return { title: 'No events found', text: `No barrier events match "${search}"` };
    if (dateFilter) return { title: 'No events found', text: `No events on ${new Date(dateFilter).toLocaleDateString('en-UG')}` };
    if (dateRange !== 'ALL') {
      const rangeText = { TODAY: 'today', YESTERDAY: 'yesterday', LAST_7: 'in the last 7 days', LAST_30: 'in the last 30 days' }[dateRange];
      return { title: 'No events found', text: `No barrier events ${rangeText}` };
    }
    if (typeFilter !== 'ALL') return { title: 'No events found', text: `No ${typeFilter.toLowerCase()} events found` };
    if (attendantFilter !== 'ALL') return { title: 'No events found', text: `No events for ${attendantFilter}` };
    return { title: 'No barrier events recorded yet', text: 'Events will appear here when vehicles pass through barriers.' };
  };

  /* CSV export */
  const exportCSV = () => {
    const headers = ['Event Type','Plate Number','Slot','Attendant','Timestamp'];
    const rows = displayed.map((log) => {
      return [log.type, log.plate, log.slotId, log.attendant, formatDateTime(log.time)].join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = `barrier-log-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <div className="page-subtitle">Every barrier open event with attendant identity</div>
      </div>

      {/* summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        {[
          { label: 'Total Today',    value: todayLogs.length,  color: 'var(--brand-primary)',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, delta: 'Since midnight' },
          { label: 'Entries Today',  value: entriesToday,      color: 'var(--color-available)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>, delta: 'Vehicles entered' },
          { label: 'Exits Today',    value: exitsToday,        color: 'var(--color-occupied)',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>, delta: 'Vehicles departed' },
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

      {/* hourly mini chart */}
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="card-header">
          <div className="card-title">Barrier Events — Last 12 Hours</div>
          <span className="badge badge-primary">{todayLogs.length} today</span>
        </div>
        <div className="card-body" style={{ paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-4)' }}>
          <MiniBarChart logs={todayLogs} />
        </div>
      </div>

      {/* toolbar */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        {/* Row 1: Search + Record Count + Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div className="search-input-wrapper" style={{ maxWidth: 320, width: '100%', flex: 1 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plate or attendant..." />
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--gray-500)', fontWeight: 600 }}>
            {displayed.length} event{displayed.length !== 1 ? 's' : ''}
          </div>
          <button className="btn btn-outline-gray btn-sm" onClick={exportCSV}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
        
        {/* Row 2: All Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {/* type filter tabs */}
          <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 'var(--radius-md)', padding: 3, gap: 2 }}>
            {[['ALL','All'],['ENTRY','Entry'],['EXIT','Exit']].map(([val, label]) => (
              <button key={val} onClick={() => setTypeFilter(val)}
                style={{ padding: '5px 12px', fontSize: 'var(--text-xs)', fontWeight: 600, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: typeFilter===val ? 'var(--surface-card)' : 'transparent', color: typeFilter===val ? 'var(--gray-800)' : 'var(--gray-500)', boxShadow: typeFilter===val ? 'var(--shadow-xs)' : 'none', transition: 'all var(--transition-fast)' }}>
                {label}
              </button>
            ))}
          </div>
          {/* date range quick filters */}
          <select className="select" style={{ width: 'auto', minWidth: 120 }} value={dateRange} onChange={(e) => { setDateRange(e.target.value); if (e.target.value !== 'ALL') setDateFilter(''); }}>
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="LAST_7">Last 7 Days</option>
            <option value="LAST_30">Last 30 Days</option>
          </select>
          {/* specific date filter */}
          <input
            type="date"
            className="select"
            style={{ width: 'auto', minWidth: 140 }}
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); if (e.target.value) setDateRange('ALL'); }}
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
              {Array(5).fill(null).map((__, j) => <div key={j} className="skeleton" style={{ flex: 1, height: 14 }} />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Barrier</th>
                <th>Plate Number</th>
                <th>Slot</th>
                <th>Attendant</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="empty-state" style={{ padding: 'var(--space-10)' }}>
                    <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <div className="empty-state-title">{getEmptyStateMessage().title}</div>
                    <div className="empty-state-text">{getEmptyStateMessage().text}</div>
                  </div>
                </td></tr>
              ) : displayed.map((log, i) => (
                <tr key={`${log.sessionId}-${log.type}-${i}`} style={{
                  borderLeft: `3px solid ${log.type === 'ENTRY' ? 'var(--color-available)' : 'var(--color-occupied)'}`,
                }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: log.type === 'ENTRY' ? 'var(--color-available-lt)' : 'var(--color-occupied-lt)', flexShrink: 0 }}>
                        {log.type === 'ENTRY'
                          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-available)" strokeWidth="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-occupied)" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        }
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: log.type === 'ENTRY' ? 'var(--color-available)' : 'var(--color-occupied)' }}>
                        {log.type}
                      </span>
                    </div>
                  </td>
                  <td className="td-plate">{log.plate}</td>
                  <td className="td-slot">{log.slotId}</td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)' }}>{log.attendant}</td>
                  <td style={{ fontSize: 'var(--text-xs)' }}>{formatDateTime(log.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
