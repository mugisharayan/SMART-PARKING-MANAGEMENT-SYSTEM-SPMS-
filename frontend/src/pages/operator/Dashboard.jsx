import { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { getOpSocket } from './OperatorLayout';
import { isDemoMode, demoSlots, demoSessions, demoDestinations } from '../../lib/demo';

function formatTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function elapsed(entryTime) {
  const ms = Date.now() - new Date(entryTime).getTime();
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/* SVG line chart — entries per hour for last 12 hours */
function LineChart({ sessions, midnight }) {
  const W = 520, H = 140, PAD = { top: 16, right: 16, bottom: 28, left: 32 };
  const now = new Date();
  const currentHour = now.getHours();

  /* build 12-hour buckets ending at current hour */
  const hours = Array.from({ length: 12 }, (_, i) => (currentHour - 11 + i + 24) % 24);
  const counts = hours.map((h) =>
    sessions.filter((s) => {
      const d = new Date(s.entryTime);
      return d >= midnight && d.getHours() === h;
    }).length
  );

  const maxVal = Math.max(...counts, 1);
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top  - PAD.bottom;
  const xStep  = chartW / (hours.length - 1);

  const toX = (i) => PAD.left + i * xStep;
  const toY = (v) => PAD.top + chartH - (v / maxVal) * chartH;

  const points = counts.map((v, i) => [toX(i), toY(v)]);
  const polyline = points.map((p) => p.join(',')).join(' ');
  /* area fill path */
  const area = `M${toX(0)},${toY(0)} ` +
    points.map((p) => `L${p[0]},${p[1]}`).join(' ') +
    ` L${toX(hours.length-1)},${PAD.top+chartH} L${toX(0)},${PAD.top+chartH} Z`;

  const [hovered, setHovered] = useState(null);

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = PAD.top + chartH * (1 - f);
          return (
            <g key={f}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--gray-100)" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill="var(--gray-400)">
                {Math.round(maxVal * f)}
              </text>
            </g>
          );
        })}
        {/* area fill */}
        <path d={area} fill="var(--brand-primary)" fillOpacity="0.08" />
        {/* line */}
        <polyline points={polyline} fill="none" stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* dots + hover targets */}
        {points.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="4" fill="var(--brand-primary)" stroke="#fff" strokeWidth="2" />
            {/* invisible wider hit area */}
            <rect
              x={x - xStep / 2} y={PAD.top} width={xStep} height={chartH + PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            />
            {/* x-axis label */}
            <text x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--gray-400)">
              {hours[i] === 0 ? '12a' : hours[i] < 12 ? `${hours[i]}a` : hours[i] === 12 ? '12p' : `${hours[i]-12}p`}
            </text>
          </g>
        ))}
        {/* tooltip */}
        {hovered !== null && (() => {
          const [x, y] = points[hovered];
          const tipW = 64, tipH = 32;
          const tipX = Math.min(x - tipW / 2, W - PAD.right - tipW);
          const tipY = y - tipH - 8;
          return (
            <g>
              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="4" fill="var(--gray-900)" />
              <text x={tipX + tipW/2} y={tipY + 12} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.6)">
                {hours[hovered] === 0 ? '12:00 AM' : hours[hovered] < 12 ? `${hours[hovered]}:00 AM` : hours[hovered] === 12 ? '12:00 PM' : `${hours[hovered]-12}:00 PM`}
              </text>
              <text x={tipX + tipW/2} y={tipY + 24} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
                {counts[hovered]} entr{counts[hovered] === 1 ? 'y' : 'ies'}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

/* SVG pie chart with labelled slices */
function PieChart({ occupied, available, oos, total }) {
  const CX = 90, CY = 90, R = 75;
  const pct = total ? Math.round((occupied / total) * 100) : 0;

  const slices = [
    { value: occupied,  color: 'var(--color-occupied)',  label: 'Occupied'       },
    { value: available, color: 'var(--color-available)', label: 'Available'      },
    { value: oos,       color: 'var(--color-oos)',        label: 'Out of Service' },
  ].filter((s) => s.value > 0);

  if (!total) return (
    <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 'var(--text-sm)' }}>No data</div>
  );

  let cumAngle = -Math.PI / 2;
  const paths = slices.map((slice) => {
    const angle    = (slice.value / total) * 2 * Math.PI;
    const x1       = CX + R * Math.cos(cumAngle);
    const y1       = CY + R * Math.sin(cumAngle);
    cumAngle      += angle;
    const x2       = CX + R * Math.cos(cumAngle);
    const y2       = CY + R * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const midAngle = cumAngle - angle / 2;
    const lx       = CX + (R + 18) * Math.cos(midAngle);
    const ly       = CY + (R + 18) * Math.sin(midAngle);
    return { ...slice, d: `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${largeArc} 1 ${x2},${y2} Z`, lx, ly, pct: Math.round((slice.value / total) * 100) };
  });

  return (
    <div style={{ position: 'relative', width: 180, height: 180, flexShrink: 0 }}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        {paths.map((p) => (
          <path key={p.label} d={p.d} fill={p.color} stroke="#fff" strokeWidth="2">
            <title>{p.label}: {p.value} ({p.pct}%)</title>
          </path>
        ))}
        {/* pct labels on slices > 10% */}
        {paths.filter((p) => p.pct >= 10).map((p) => (
          <text key={p.label + 'l'} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fontWeight="700" fill="#fff"
            style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
            {p.pct}%
          </text>
        ))}
        {/* centre hole + label */}
        <circle cx={CX} cy={CY} r="32" fill="white" />
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--gray-900)">{pct}%</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9" fill="var(--gray-500)">Occupied</text>
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const [stats,    setStats]    = useState(null);
  const [slots,    setSlots]    = useState([]);
  const [sessions, setSessions] = useState([]);
  const [dests,    setDests]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  /* computed once per render — used everywhere midnight boundary is needed */
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    const mn = new Date(); mn.setHours(0, 0, 0, 0);
    if (isDemoMode()) {
      const occupied  = demoSlots.filter((s) => s.status === 'OCCUPIED').length;
      const available = demoSlots.filter((s) => s.status === 'AVAILABLE').length;
      const oos       = demoSlots.filter((s) => s.status === 'OUT_OF_SERVICE').length;
      setStats({ total: demoSlots.length, occupied, available, oos, totalToday: demoSessions.filter((s) => new Date(s.entryTime) >= mn).length });
      setSlots([...demoSlots]);
      setSessions([...demoSessions].sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime)));
      setDests(demoDestinations);
      setLoading(false);
      return;
    }
    try {
      const [slotsRes, sessRes, statsRes, destsRes] = await Promise.all([
        api.get('/api/slots'),
        api.get('/api/sessions'),
        api.get('/api/dashboard/stats'),
        api.get('/api/destinations'),
      ]);
      setSlots(slotsRes.data);
      setSessions(Array.isArray(sessRes.data) ? sessRes.data : sessRes.data.sessions || []);
      setStats(statsRes.data);
      setDests(destsRes.data);
    } catch {
      const occupied  = demoSlots.filter((s) => s.status === 'OCCUPIED').length;
      const available = demoSlots.filter((s) => s.status === 'AVAILABLE').length;
      const oos       = demoSlots.filter((s) => s.status === 'OUT_OF_SERVICE').length;
      setStats({ total: demoSlots.length, occupied, available, oos, totalToday: demoSessions.filter((s) => new Date(s.entryTime) >= mn).length });
      setSlots([...demoSlots]);
      setSessions([...demoSessions].sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime)));
      setDests(demoDestinations);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* socket live updates — surgical state updates, no full reload per event */
  useEffect(() => {
    const s = getOpSocket();

    /* slot status changed — update only that slot in state */
    const onSlotUpdated = ({ slotId, status }) => {
      setSlots((prev) => prev.map((sl) => sl.slotId === slotId ? { ...sl, status } : sl));
    };

    /* new session created — prepend to sessions, update stats counts */
    const onSessionCreated = ({ session }) => {
      if (!session) return;
      setSessions((prev) => [session, ...prev]);
      setStats((prev) => {
        if (!prev) return prev;
        return { ...prev, occupied: prev.occupied + 1, available: prev.available - 1, totalToday: prev.totalToday + 1 };
      });
    };

    /* session closed — update that session in state, update stats counts */
    const onSessionClosed = ({ sessionId, slotId }) => {
      setSessions((prev) => prev.map((s) =>
        (s._id === sessionId || s.id === sessionId)
          ? { ...s, status: 'CLOSED', exitTime: new Date().toISOString() }
          : s
      ));
      setSlots((prev) => prev.map((sl) => sl.slotId === slotId ? { ...sl, status: 'AVAILABLE' } : sl));
      setStats((prev) => {
        if (!prev) return prev;
        return { ...prev, occupied: Math.max(0, prev.occupied - 1), available: prev.available + 1 };
      });
    };

    /* stats_updated — full reload needed for accurate server-side aggregation */
    const onStatsUpdated = () => load();

    s.on('slot_updated',    onSlotUpdated);
    s.on('session_created', onSessionCreated);
    s.on('session_closed',  onSessionClosed);
    s.on('stats_updated',   onStatsUpdated);
    return () => {
      s.off('slot_updated',    onSlotUpdated);
      s.off('session_created', onSessionCreated);
      s.off('session_closed',  onSessionClosed);
      s.off('stats_updated',   onStatsUpdated);
    };
  }, [load]);

  if (loading) {
    return (
      <div className="page-content">
        <div className="skeleton skeleton-title" style={{ marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: '35%', marginBottom: 24 }} />
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {Array(4).fill(null).map((_, i) => <div key={i} className="skeleton skeleton-stat" />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
          <div className="skeleton-card"><div className="skeleton" style={{ height: 200 }} /></div>
          <div className="skeleton-card">{Array(5).fill(null).map((_, i) => <div key={i} className="skeleton skeleton-row" />)}</div>
        </div>
      </div>
    );
  }

  const { total, occupied, available, oos, totalToday } = stats;
  const pct = total ? Math.round((occupied / total) * 100) : 0;
  const recent = sessions.slice(0, 15);

  /* ── compute quick-stats once for use in stat card deltas ── */
  const todaySessions = sessions.filter((s) => new Date(s.entryTime) >= midnight);

  const hourBuckets = Array(24).fill(0);
  todaySessions.forEach((s) => { hourBuckets[new Date(s.entryTime).getHours()]++; });
  const peakHour  = hourBuckets.indexOf(Math.max(...hourBuckets));
  const peakLabel = Math.max(...hourBuckets) > 0
    ? (peakHour === 0 ? '12 AM' : peakHour < 12 ? `${peakHour} AM` : peakHour === 12 ? '12 PM' : `${peakHour - 12} PM`)
    : null;

  const zoneCounts = {};
  todaySessions.forEach((s) => { zoneCounts[s.destinationName] = (zoneCounts[s.destinationName] || 0) + 1; });
  const busiestZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0]?.[0]?.split(' ')[0] || null;

  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE');
  const longestMs = activeSessions.length
    ? Math.max(...activeSessions.map((s) => Date.now() - new Date(s.entryTime).getTime()))
    : 0;

  const closedToday = todaySessions.filter((s) => s.status === 'CLOSED' && s.exitTime);
  const avgMs = closedToday.length
    ? closedToday.reduce((sum, s) => sum + (new Date(s.exitTime) - new Date(s.entryTime)), 0) / closedToday.length
    : 0;
  const avgMin = Math.round(avgMs / 60000);

  const statCards = [
    {
      cls: 'total', label: 'Total Slots', value: total, color: 'var(--brand-primary)',
      delta: `${available} available · Peak: ${peakLabel ? peakLabel : 'no data yet'}`,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    },
    {
      cls: 'occupied', label: 'Occupied', value: occupied, color: 'var(--color-occupied)',
      delta: `${pct}% rate · Longest: ${longestMs > 0 ? `${Math.floor(longestMs/3600000)}h ${Math.floor((longestMs%3600000)/60000)}m` : '—'}`,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-occupied)" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    },
    {
      cls: 'available', label: 'Available', value: available, color: 'var(--color-available)',
      delta: `${oos} out of service · Busiest: ${busiestZone ?? '—'}`,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-available)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    },
    {
      cls: 'today', label: "Today's Entries", value: totalToday, color: 'var(--color-warning)',
      delta: `Since midnight · Avg stay: ${avgMin > 0 ? `${avgMin}m` : '—'}`,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
  ];

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div className="page-subtitle">
            {new Date().toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <span style={{ color: 'var(--gray-300)' }}>·</span>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
            Last updated {lastRefresh.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </div>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => load(true)}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ animation: refreshing ? 'spin 0.6s linear infinite' : 'none' }}
          >
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        {statCards.map(({ cls, label, value, delta, icon, color }) => (
          <div key={cls} className={`stat-card ${cls}`} style={{
            background: `linear-gradient(135deg, #ffffff 60%, ${color}08 100%)`,
          }}>
            <div className="stat-card-header">
              <div>
                <div className="stat-card-label">{label}</div>
                <div className="stat-card-value">{value}</div>
              </div>
              <div className="stat-card-icon">{icon}</div>
            </div>
            <div className="stat-card-delta" style={{ color: 'var(--gray-600)' }}>{delta}</div>
          </div>
        ))}
      </div>

      {/* ── Section divider ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div style={{ height: 1, flex: 1, background: 'var(--gray-200)' }} />
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.14em', color: 'var(--gray-400)', whiteSpace: 'nowrap',
        }}>
          Analytics
        </span>
        <div style={{ height: 1, flex: 1, background: 'var(--gray-200)' }} />
      </div>

      {/* ── Line chart — hourly traffic ── */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Hourly Traffic</div>
            <div className="card-subtitle">Vehicle entries per hour — last 12 hours</div>
          </div>
          <span className="badge badge-primary">{sessions.filter((s) => new Date(s.entryTime) >= midnight).length} today</span>
        </div>
        <div className="card-body" style={{ paddingTop: 'var(--space-2)' }}>
          <LineChart sessions={sessions} midnight={midnight} />
        </div>
      </div>

      {/* ── Donut + Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>

        {/* Occupancy donut */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Occupancy Breakdown</div>
              <div className="card-subtitle">Current slot status distribution</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
            <PieChart occupied={occupied} available={available} oos={oos} total={total} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                { color: 'var(--color-occupied)',  label: 'Occupied',       count: occupied  },
                { color: 'var(--color-available)', label: 'Available',      count: available },
                { color: 'var(--color-oos)',        label: 'Out of Service', count: oos       },
              ].map(({ color, label, count }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-900)' }}>{count} {label}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{total ? Math.round((count / total) * 100) : 0}% of total</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Activity</div>
              <div className="card-subtitle">Latest session events</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div className="live-indicator">LIVE</div>
              <a
                href="/operator/history"
                className="btn btn-ghost btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none', padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1.5px solid var(--brand-primary)', background: 'transparent', transition: 'all var(--transition-fast)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-primary-lt)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                View all sessions
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </a>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 0, maxHeight: 340, overflowY: 'auto' }}>
            {recent.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                <div className="empty-state-title">No activity yet</div>
              </div>
            ) : (() => {
              const now = Date.now();
              const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
              const todayItems    = recent.filter((s) => new Date(s.status === 'ACTIVE' ? s.entryTime : s.exitTime) >= todayMidnight);
              const earlierItems  = recent.filter((s) => new Date(s.status === 'ACTIVE' ? s.entryTime : s.exitTime) < todayMidnight);

              const renderItem = (s) => {
                const isEntry   = s.status === 'ACTIVE';
                const eventTime = isEntry ? s.entryTime : s.exitTime;
                const elapsedMs = now - new Date(s.entryTime).getTime();
                const elH = Math.floor(elapsedMs / 3600000);
                const elM = Math.floor((elapsedMs % 3600000) / 60000);
                return (
                  <div key={s._id || s.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)',
                    padding: 'var(--space-3) 0',
                    borderBottom: '1px solid var(--gray-100)',
                    position: 'relative',
                    paddingLeft: 'var(--space-4)',
                  }}>
                    {/* timeline left border */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                      background: isEntry ? 'var(--color-available)' : 'var(--color-occupied)',
                      borderRadius: 'var(--radius-full)',
                    }} />
                    {/* icon */}
                    <div style={{
                      width: 26, height: 26, borderRadius: 'var(--radius-md)', flexShrink: 0,
                      background: isEntry ? 'var(--color-available-lt)' : 'var(--color-occupied-lt)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isEntry
                        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-available)" strokeWidth="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-occupied)" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      }
                    </div>
                    {/* content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-800)', lineHeight: 1.4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--gray-900)' }}>{s.plateNumber}</span>
                        {' '}
                        <span style={{ color: isEntry ? 'var(--color-available)' : 'var(--color-occupied)', fontWeight: 600 }}>
                          {isEntry ? 'entered' : 'exited'}
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginTop: 2 }}>
                        {s.destinationName}
                        {' · '}
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', fontWeight: 600 }}>{s.slotId}</span>
                        {isEntry && <span style={{ color: 'var(--color-occupied)', marginLeft: 4 }}>{elH}h {elM}m</span>}
                      </div>
                    </div>
                    {/* time */}
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: 2 }}>
                      {formatTime(eventTime)}
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {todayItems.length > 0 && (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                        padding: 'var(--space-3) 0 var(--space-1)',
                      }}>
                        <div style={{ height: 1, flex: 1, background: 'var(--gray-100)' }} />
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>Today</span>
                        <div style={{ height: 1, flex: 1, background: 'var(--gray-100)' }} />
                      </div>
                      {todayItems.map(renderItem)}
                    </>
                  )}
                  {earlierItems.length > 0 && (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                        padding: 'var(--space-3) 0 var(--space-1)',
                      }}>
                        <div style={{ height: 1, flex: 1, background: 'var(--gray-100)' }} />
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>Earlier</span>
                        <div style={{ height: 1, flex: 1, background: 'var(--gray-100)' }} />
                      </div>
                      {earlierItems.map(renderItem)}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Section divider ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', marginTop: 'var(--space-2)' }}>
        <div style={{ height: 1, flex: 1, background: 'var(--gray-200)' }} />
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.14em', color: 'var(--gray-400)', whiteSpace: 'nowrap',
        }}>
          Performance
        </span>
        <div style={{ height: 1, flex: 1, background: 'var(--gray-200)' }} />
      </div>

      {/* ── Attendant performance + Zone bar chart row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>

        {/* Attendant performance */}
        {(() => {
          const attendants = {};
          todaySessions.forEach((s) => {
            const name = s.attendantName || 'Unknown';
            if (!attendants[name]) attendants[name] = { entries: 0, exits: 0, durations: [] };
            attendants[name].entries++;
            if (s.status === 'CLOSED' && s.exitTime) {
              attendants[name].exits++;
              attendants[name].durations.push(new Date(s.exitTime) - new Date(s.entryTime));
            }
          });
          const rows = Object.entries(attendants).map(([name, d]) => ({
            name,
            entries: d.entries,
            exits:   d.exits,
            avgMin:  d.durations.length ? Math.round(d.durations.reduce((a,b) => a+b,0) / d.durations.length / 60000) : null,
          })).sort((a,b) => b.entries - a.entries);
          const maxEntries = Math.max(...rows.map((r) => r.entries), 1);
          return (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Attendant Performance</div>
                  <div className="card-subtitle">Today’s entries &amp; avg session duration</div>
                </div>
                <span className="badge badge-info">{rows.length} on shift</span>
              </div>
              <div className="card-body" style={{ paddingTop: 0 }}>
                {rows.length === 0 ? (
                  <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                    <div className="empty-state-title">No activity today</div>
                  </div>
                ) : rows.map((r) => (
                  <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--gray-100)' }}>
                    {/* avatar */}
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand-primary-lt)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0 }}>
                      {r.name.split(' ').map((n) => n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-900)', marginBottom: 4 }}>{r.name}</div>
                      {/* mini bar */}
                      <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(r.entries / maxEntries) * 100}%`, background: 'var(--brand-primary)', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--gray-900)' }}>{r.entries} <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', fontWeight: 400 }}>entries</span></div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{r.avgMin !== null ? `avg ${r.avgMin}m` : 'no exits'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Zone vertical bar chart ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Zone Occupancy</div>
            <div className="card-subtitle">Slots occupied per destination zone</div>
          </div>
          <div className="card-body">
            {(() => {
              const BAR_H = 160;
              const zones = dests.map((dest) => {
                const destId    = dest._id || dest.id;
                const zoneSlots = slots.filter((s) => s.destinationId === destId);
                const occ       = zoneSlots.filter((s) => s.status === 'OCCUPIED').length;
                const total     = zoneSlots.length;
                const pct       = total ? Math.round((occ / total) * 100) : 0;
                const color     = pct > 80 ? 'var(--color-occupied)' : pct > 50 ? 'var(--color-warning)' : 'var(--color-available)';
                return { name: dest.name.split(' ')[0], occ, total, pct, color };
              });
              const maxPct = Math.max(...zones.map((z) => z.pct), 1);
              return (
                <div style={{ overflowX: 'auto' }}>
                  <div style={{
                    display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)',
                    height: BAR_H + 60, paddingTop: 'var(--space-4)',
                    minWidth: zones.length > 5 ? zones.length * 72 : '100%',
                  }}>
                    {zones.map(({ name, occ, total, pct, color }) => {
                      const barH = Math.max((pct / maxPct) * BAR_H, 4);
                      return (
                        <div key={name} style={{ flex: '0 0 56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--gray-700)' }}>{occ}/{total}</div>
                          <div style={{ width: 56, position: 'relative', height: BAR_H, display: 'flex', alignItems: 'flex-end' }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'var(--gray-100)', borderRadius: 'var(--radius-md)' }} />
                            <div style={{ position: 'relative', width: '100%', height: barH, background: color, borderRadius: 'var(--radius-md)', transition: 'height 0.6s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: `0 4px 12px ${color}40` }} />
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color }}>{pct}%</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', textAlign: 'center', fontWeight: 500, maxWidth: 56, wordBreak: 'break-word' }}>{name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

      </div>
    </div>
  );
}
