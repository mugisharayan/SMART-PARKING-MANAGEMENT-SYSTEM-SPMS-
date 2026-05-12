import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useCallback, useRef } from 'react';
import useAuthStore from '../../store/authStore';
import api from '../../lib/api';
import { io } from 'socket.io-client';
import { isDemoMode, demoSlots, demoSessions } from '../../lib/demo';

let _socket = null;

export function getSocket() {
  if (!_socket) {
    _socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      autoConnect: false,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }
  return _socket;
}

export default function AttendantLayout() {
  const { user, clearAuth }           = useAuthStore();
  const navigate                      = useNavigate();
  const location                      = useLocation();
  const [parkingFull, setParkingFull] = useState(false);
  const [clock, setClock]             = useState('');
  const [connected, setConnected]     = useState(false);
  const [shiftCount, setShiftCount]   = useState(0);   // entries this attendant processed today
  const socketInitRef                 = useRef(false);

  const initials = user
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  /* clock — HH:MM only, updates every minute */
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: true }));
    tick();
    /* align to the next minute boundary so it always shows the correct minute */
    const msToNextMinute = 60000 - (Date.now() % 60000);
    const alignTimer = setTimeout(() => { tick(); const id = setInterval(tick, 60000); return () => clearInterval(id); }, msToNextMinute);
    return () => clearTimeout(alignTimer);
  }, []);

  /* shift count — sessions created by this attendant today */
  useEffect(() => {
    if (!user) return;
    if (isDemoMode()) {
      const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
      const count = demoSessions.filter(
        (s) => (s.attendantId === user.id || s.attendantName === user.name) && new Date(s.entryTime) >= midnight
      ).length;
      setShiftCount(count);
      return;
    }
    api.get('/api/sessions?attendant=me&status=today').then(({ data }) => {
      setShiftCount(Array.isArray(data) ? data.length : data.total || 0);
    }).catch(() => {});
  }, [user]);

  /* socket */
  useEffect(() => {
    if (socketInitRef.current) return;
    socketInitRef.current = true;

    const s = getSocket();
    if (!s.connected) s.connect();

    s.on('connect',    () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    if (s.connected) setConnected(true);

    const onFull = ({ full }) => setParkingFull(full);
    s.on('parking_full', onFull);

    /* increment shift count when this attendant creates a session */
    const onSessionCreated = ({ session }) => {
      if (session?.attendantId === user?.id || session?.attendantName === user?.name) {
        setShiftCount((c) => c + 1);
      }
    };
    s.on('session_created', onSessionCreated);

    if (isDemoMode()) {
      const avail = demoSlots.filter((sl) => sl.status === 'AVAILABLE').length;
      setParkingFull(avail === 0);
      setConnected(true); // demo = always "connected"
    } else {
      api.get('/api/slots').then(({ data }) => {
        setParkingFull(data.filter((sl) => sl.status === 'AVAILABLE').length === 0);
      }).catch(() => {});
    }

    return () => {
      s.off('parking_full',    onFull);
      s.off('session_created', onSessionCreated);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = useCallback(() => {
    api.post('/api/auth/logout').catch(() => {});
    if (_socket) { _socket.disconnect(); _socket = null; }
    clearAuth();
    navigate('/login', { replace: true });
  }, [clearAuth, navigate]);

  const topbarTitles = {
    '/attendant':         'Live Parking Map',
    '/attendant/entry':   'New Vehicle Entry',
    '/attendant/exit':    'Process Vehicle Exit',
    '/attendant/history': 'Session History',
  };
  const title = topbarTitles[location.pathname] || 'Attendant';

  const navItems = [
    {
      to: '/attendant', end: true, label: 'Live Map',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>,
    },
    {
      to: '/attendant/entry', label: 'New Entry', disabled: parkingFull,
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>,
    },
    {
      to: '/attendant/exit', label: 'Process Exit',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    },
    {
      to: '/attendant/history', label: 'Session History',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    },
  ];

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1a3a6e 0%, #0d1f3c 100%)',
              border: '1.5px solid rgba(212,175,55,0.5)',
              boxShadow: '0 0 0 3px rgba(212,175,55,0.08), 0 4px 12px rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#D4AF37', letterSpacing: '-0.02em', lineHeight: 1, textShadow: '0 0 10px rgba(212,175,55,0.6)', fontFamily: 'Inter, sans-serif' }}>P</span>
            </div>
            <span style={{ position: 'absolute', bottom: 1, right: 1, width: 8, height: 8, borderRadius: '50%', background: '#4ade80', border: '1.5px solid rgba(30,64,175,0.8)', boxShadow: '0 0 6px rgba(74,222,128,0.8)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
          </div>
          <div className="sidebar-logo-text">
            <span className="brand-name">Lugogo PMS</span>
            <span className="brand-sub">Attendant</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Operations</div>
          {navItems.map(({ to, end, label, icon, disabled }) =>
            disabled ? (
              <div key={to} className="nav-item" style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                {icon}<span>{label}</span>
              </div>
            ) : (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                {icon}<span>{label}</span>
              </NavLink>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              {/* shift summary */}
              <div className="sidebar-user-role" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  title={connected ? 'Live — connected' : 'Reconnecting...'}
                  style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: connected ? 'var(--color-available)' : 'var(--color-warning)',
                    animation: connected ? 'pulse-dot 2s ease-in-out infinite' : 'none',
                  }}
                />
                {shiftCount} entr{shiftCount === 1 ? 'y' : 'ies'} today
              </div>
            </div>
            <button className="btn-ghost btn-icon btn-sm" onClick={handleLogout} title="Logout">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">{title}</div>
            {/* LIVE on all pages */}
            <div className="live-indicator">LIVE</div>
          </div>
          <div className="topbar-right">
            {parkingFull && (
              <span
                className="badge badge-occupied"
                style={{
                  fontSize: 'var(--text-xs)', padding: '0.3rem 0.8rem',
                  animation: 'parkingFullPulse 0.6s ease-in-out 3',
                }}
              >
                ⚠ PARKING FULL
              </span>
            )}
            <style>{`
              @keyframes parkingFullPulse {
                0%,100% { transform: scale(1);   opacity: 1; }
                50%      { transform: scale(1.08); opacity: 0.75; }
              }
            `}</style>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                title={connected ? 'Live — connected' : 'Reconnecting...'}
                style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: connected ? 'var(--color-available)' : 'var(--color-warning)',
                  boxShadow: connected ? '0 0 0 2px rgba(22,163,74,0.2)' : '0 0 0 2px rgba(217,119,6,0.2)',
                  animation: connected ? 'pulse-dot 2s ease-in-out infinite' : 'none',
                }}
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', fontVariantNumeric: 'tabular-nums' }}>
                {clock}
              </span>
            </span>
            <button
              className="btn btn-primary btn-sm"
              disabled={parkingFull}
              onClick={() => navigate('/attendant/entry')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Entry
            </button>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
