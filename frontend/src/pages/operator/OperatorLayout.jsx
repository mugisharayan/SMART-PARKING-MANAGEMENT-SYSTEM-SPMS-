import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useCallback, useRef } from 'react';
import useAuthStore from '../../store/authStore';
import api from '../../lib/api';
import { io } from 'socket.io-client';

let _opSocket = null;

export function getOpSocket() {
  if (!_opSocket) {
    _opSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      autoConnect: false,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }
  return _opSocket;
}

export default function OperatorLayout() {
  const { user, clearAuth } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [clock, setClock] = useState('');
  const socketInitRef = useRef(false);

  const initials = user
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  /* clock */
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* socket — connect once */
  useEffect(() => {
    if (socketInitRef.current) return;
    socketInitRef.current = true;
    const s = getOpSocket();
    if (!s.connected) s.connect();
    return () => { /* don't disconnect on re-render */ };
  }, []);

  const handleLogout = useCallback(() => {
    api.post('/api/auth/logout').catch(() => {});
    if (_opSocket) { _opSocket.disconnect(); _opSocket = null; }
    clearAuth();
    navigate('/login', { replace: true });
  }, [clearAuth, navigate]);

  const topbarTitles = {
    '/operator':              'Operator Dashboard',
    '/operator/destinations': 'Destination Management',
    '/operator/slots':        'Slot Layout Management',
    '/operator/history':      'Session History',
    '/operator/barrier-log':  'Barrier Log',
  };
  const title = topbarTitles[location.pathname] || 'Operator';

  const navItems = [
    {
      to: '/operator', end: true, label: 'Dashboard',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    },
    {
      to: '/operator/destinations', label: 'Destinations',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    },
    {
      to: '/operator/slots', label: 'Slot Layout',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>,
    },
    {
      to: '/operator/history', label: 'Session History',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    },
    {
      to: '/operator/barrier-log', label: 'Barrier Log',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    },
  ];

  return (
    <div className="app-shell">
      {/* Sidebar */}
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
            <span className="brand-sub">Operator</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Management</div>
          {navItems.map(({ to, end, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              {icon}<span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">Operator</div>
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

      {/* Main */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">{title}</div>
            <div className="live-indicator">LIVE</div>
          </div>
          <div className="topbar-right">
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{clock}</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/attendant')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              </svg>
              Live Map
            </button>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
