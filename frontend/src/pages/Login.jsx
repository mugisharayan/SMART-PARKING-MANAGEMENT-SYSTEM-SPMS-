import { useState, useEffect } from 'react';
import parkingBg from '../parking-bg.mp4';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../lib/api';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const REMEMBER_KEY = 'pms_remember_me';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState('');
  const [lockoutMsg, setLockoutMsg]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [showPw, setShowPw]           = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);

  // Forgot password modal state
  const [showForgot, setShowForgot]       = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotStatus, setForgotStatus]   = useState(null); // 'success' | 'error'
  const [forgotMsg, setForgotMsg]         = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const { register, handleSubmit, setValue, clearErrors, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  // Restore remembered username on mount
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setValue('username', saved);
      setRememberMe(true);
    }
  }, [setValue]);

  const onSubmit = async (data) => {
    setServerError(''); setLockoutMsg(''); setLoading(true);
    try {
      const res = await api.post('/api/auth/login', data);
      const { token, user } = res.data;
      if (rememberMe) localStorage.setItem(REMEMBER_KEY, data.username);
      else localStorage.removeItem(REMEMBER_KEY);
      setAuth(token, user);
      navigate(user.role === 'OPERATOR' ? '/operator' : '/attendant', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid username or password.';
      if (msg.toLowerCase().includes('lock')) setLockoutMsg(msg);
      else setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotUsername.trim()) {
      setForgotStatus('error'); setForgotMsg('Please enter your username.'); return;
    }
    setForgotLoading(true); setForgotStatus(null);
    try {
      await api.post('/api/auth/forgot-password', { username: forgotUsername.trim() });
      setForgotStatus('success');
      setForgotMsg('If that username exists, a password reset link has been sent to the associated email.');
    } catch (err) {
      setForgotStatus('error');
      setForgotMsg(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgot = () => {
    setShowForgot(false); setForgotUsername(''); setForgotStatus(null); setForgotMsg('');
  };

  const fillCreds = (username, password) => {
    setValue('username', username);
    setValue('password', password);
    setServerError(''); setLockoutMsg('');
    clearErrors();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'var(--font-sans)' }}>

      {/* ── Left panel ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px 52px', position: 'relative', overflow: 'hidden', gap: 36,
      }} className="login-left">

        {/* Background video */}
        <video autoPlay muted loop playsInline
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0 }}
          src={parkingBg}
        />
        {/* Dark overlay */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(170deg, rgba(10,15,30,0.88) 0%, rgba(15,42,74,0.80) 60%, rgba(10,15,30,0.92) 100%)', zIndex:1 }} />

        {/* ── Logo ── */}
        <div style={{ position:'relative', zIndex:2, display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ position:'relative', width:62, height:62, flexShrink:0 }}>
            <svg width="62" height="62" viewBox="0 0 62 62" fill="none">
              <defs>
                <linearGradient id="lgGrad" x1="0" y1="0" x2="62" y2="62" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1e3a8a"/>
                  <stop offset="100%" stopColor="#0f172a"/>
                </linearGradient>
              </defs>
              <circle cx="31" cy="31" r="30" stroke="rgba(212,175,55,0.5)" strokeWidth="1.8"/>
              <circle cx="31" cy="31" r="27" fill="url(#lgGrad)"/>
              <rect x="13" y="28" width="36" height="16" rx="1.5" fill="rgba(255,255,255,0.1)" stroke="rgba(212,175,55,0.6)" strokeWidth="1"/>
              <rect x="14" y="20" width="10" height="24" rx="1" fill="rgba(255,255,255,0.12)" stroke="rgba(212,175,55,0.5)" strokeWidth="1"/>
              <rect x="38" y="20" width="10" height="24" rx="1" fill="rgba(255,255,255,0.12)" stroke="rgba(212,175,55,0.5)" strokeWidth="1"/>
              <path d="M26 44 L26 36 Q31 31 36 36 L36 44Z" fill="rgba(212,175,55,0.2)" stroke="rgba(212,175,55,0.6)" strokeWidth="0.8"/>
              <text x="16.5" y="32" fontFamily="Inter,sans-serif" fontSize="8" fontWeight="900" fill="#D4AF37">P</text>
              <text x="40.5" y="32" fontFamily="Inter,sans-serif" fontSize="8" fontWeight="900" fill="#D4AF37">P</text>
              <line x1="13" y1="28" x2="49" y2="28" stroke="#D4AF37" strokeWidth="1.5"/>
              <circle cx="31" cy="15" r="3.5" fill="#D4AF37" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
              <line x1="31" y1="18.5" x2="31" y2="22" stroke="#D4AF37" strokeWidth="1.2"/>
            </svg>
            <span style={{ position:'absolute', top:1, right:1, width:11, height:11, borderRadius:'50%', background:'#4ade80', border:'2px solid rgba(15,23,42,0.9)', boxShadow:'0 0 10px #4ade80', animation:'livePulse 2s ease-in-out infinite' }} />
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
              <span style={{ fontSize:'1.35rem', fontWeight:900, color:'#D4AF37', letterSpacing:'0.04em', lineHeight:1, textShadow:'0 0 20px rgba(212,175,55,0.4)' }}>LUGOGO</span>
              <span style={{ width:1, height:18, background:'rgba(212,175,55,0.4)', display:'inline-block' }} />
              <span style={{ fontSize:'1.1rem', fontWeight:300, color:'rgba(255,255,255,0.75)', letterSpacing:'0.08em', lineHeight:1 }}>SPMS</span>
            </div>
            <div style={{ fontSize:'0.65rem', color:'rgba(212,175,55,0.6)', letterSpacing:'0.2em', textTransform:'uppercase', fontWeight:600 }}>Smart Parking Management System</div>
          </div>
        </div>

        {/* ── Hero Content ── */}
        <div style={{ position:'relative', zIndex:2, display:'flex', flexDirection:'column', gap:18 }}>

          {/* Eyebrow tag */}
          <div style={{ display:'inline-flex', alignSelf:'flex-start', alignItems:'center', gap:8, background:'rgba(212,175,55,0.08)', border:'1px solid rgba(212,175,55,0.35)', borderRadius:100, padding:'6px 18px' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 8px #4ade80', flexShrink:0, animation:'livePulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize:'0.68rem', fontWeight:700, color:'#D4AF37', letterSpacing:'0.16em', textTransform:'uppercase' }}>Lugogo Mall · Kampala, Uganda</span>
          </div>

          {/* Main heading */}
          <div>
            <div style={{ fontSize:'0.78rem', fontWeight:400, color:'rgba(255,255,255,0.5)', letterSpacing:'0.22em', textTransform:'uppercase', marginBottom:8 }}>Welcome to</div>
            <h1 style={{ margin:0, padding:0, lineHeight:1.1 }}>
              <span style={{ display:'block', fontSize:'2.6rem', fontWeight:900, color:'#ffffff', letterSpacing:'-0.02em' }}>Lugogo Smart</span>
              <span style={{ display:'block', fontSize:'2.6rem', fontWeight:900, letterSpacing:'-0.02em', background:'linear-gradient(95deg, #D4AF37 0%, #FDE68A 45%, #D4AF37 75%, #B8860B 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Parking System</span>
            </h1>
          </div>

          {/* Sub text */}
          <p style={{ margin:0, fontSize:'0.88rem', color:'rgba(255,255,255,0.62)', lineHeight:1.9, maxWidth:400, fontWeight:400, borderLeft:'2px solid rgba(212,175,55,0.45)', paddingLeft:14 }}>
            Full command over slot availability, vehicle entry, automated plate recognition and real-time monitoring — all from one screen.
          </p>

          {/* Feature rows */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { color:'#D4AF37', icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label:'Real-time slot visibility across all zones' },
              { color:'#60a5fa', icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="3" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="21" y2="12"/></svg>, label:'Automated number plate recognition' },
              { color:'#34d399', icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label:'Instant driver & operator notifications' },
              { color:'#a78bfa', icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, label:'Live analytics & occupancy reports' },
            ].map(({ color, icon, label }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:30, height:30, borderRadius:8, background:`${color}18`, border:`1px solid ${color}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{icon}</div>
                <span style={{ fontSize:'0.83rem', color:'rgba(255,255,255,0.82)', fontWeight:500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div style={{ position:'relative', zIndex:2, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:'rgba(212,175,55,0.15)', border:'1px solid rgba(212,175,55,0.25)', borderRadius:16, overflow:'hidden', backdropFilter:'blur(12px)' }}>
          {[
            { val:'30',   label:'Total Slots', color:'#D4AF37' },
            { val:'5',    label:'Zones',       color:'#60a5fa' },
            { val:'2',    label:'Entry Gates', color:'#34d399' },
            { val:'24/7', label:'Uptime',      color:'#a78bfa' },
          ].map(({ val, label, color }, i) => (
            <div key={label} style={{ textAlign:'center', padding:'16px 8px', background:'rgba(10,18,40,0.55)', borderRight: i < 3 ? '1px solid rgba(212,175,55,0.15)' : 'none' }}>
              <div style={{ fontSize:'1.8rem', fontWeight:900, color, letterSpacing:'-0.04em', lineHeight:1, textShadow:`0 0 16px ${color}60` }}>{val}</div>
              <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.14em', marginTop:7, fontWeight:700 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ width:480, display:'flex', flexDirection:'column', justifyContent:'center', padding:'var(--space-12) var(--space-10)', background:'var(--surface-card)', boxShadow:'-8px 0 40px rgba(0,0,0,0.08)' }}>

        <div style={{ marginBottom:'var(--space-8)' }}>
          <h2 style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-extrabold)', color:'var(--gray-900)', letterSpacing:'-0.03em', marginBottom:'var(--space-2)' }}>Welcome back</h2>
          <p style={{ fontSize:'var(--text-sm)', color:'var(--gray-500)' }}>Sign in to access the Smart Parking Management System</p>
        </div>

        {/* Server error */}
        {serverError && (
          <div style={{ background:'var(--color-occupied-lt)', border:'1px solid #fca5a5', borderRadius:'var(--radius-lg)', padding:'var(--space-3) var(--space-4)', fontSize:'var(--text-sm)', color:'#991b1b', display:'flex', alignItems:'center', gap:'var(--space-2)', marginBottom:'var(--space-4)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {serverError}
          </div>
        )}

        {/* Lockout */}
        {lockoutMsg && (
          <div style={{ background:'var(--color-warning-lt)', border:'1px solid #fcd34d', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', fontSize:'var(--text-sm)', color:'#92400e', display:'flex', alignItems:'flex-start', gap:'var(--space-3)', marginBottom:'var(--space-4)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div>
              <div style={{ fontWeight:'var(--weight-semibold)', marginBottom:2 }}>Account Locked</div>
              <div>{lockoutMsg}</div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} style={{ display:'flex', flexDirection:'column', gap:'var(--space-5)' }}>

          {/* Username */}
          <div className="form-group">
            <label className="form-label">Username <span className="required">*</span></label>
            <div className="input-wrapper">
              <svg className="input-icon-left" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input {...register('username')} type="text" placeholder="Enter your username" autoComplete="username"
                className={`input has-icon-left${errors.username ? ' error' : ''}`} />
            </div>
            {errors.username && <span className="form-error">{errors.username.message}</span>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password <span className="required">*</span></label>
            <div className="input-wrapper">
              <svg className="input-icon-left" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input {...register('password')} type={showPw ? 'text' : 'password'} placeholder="Enter your password"
                autoComplete="current-password" style={{ paddingRight:'2.8rem' }}
                className={`input has-icon-left${errors.password ? ' error' : ''}`} />
              <button type="button" className="input-icon-right" onClick={() => setShowPw(!showPw)}>
                {showPw
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {errors.password && <span className="form-error">{errors.password.message}</span>}
          </div>

          {/* Remember Me + Forgot Password row */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <label style={{ display:'flex', alignItems:'center', gap:'var(--space-2)', cursor:'pointer', fontSize:'var(--text-sm)', color:'var(--gray-600)', userSelect:'none' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{ width:16, height:16, accentColor:'var(--brand-primary)', cursor:'pointer' }}
              />
              Remember me
            </label>
            <button type="button"
              onClick={() => { setShowForgot(true); setForgotUsername(''); setForgotStatus(null); setForgotMsg(''); }}
              style={{ background:'none', border:'none', padding:0, fontSize:'var(--text-sm)', color:'var(--brand-primary)', cursor:'pointer', fontWeight:'var(--weight-medium)' }}>
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block">
            {loading
              ? <><span className="btn-spinner" /> Signing in...</>
              : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Sign In</>
            }
          </button>
        </form>

        {/* Demo credentials */}
        <div style={{ marginTop:'var(--space-6)', background:'var(--gray-50)', border:'1px solid var(--gray-200)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)' }}>
          <div style={{ fontSize:'var(--text-xs)', fontWeight:'var(--weight-semibold)', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--gray-500)', marginBottom:'var(--space-3)' }}>
            Demo Credentials — click to fill
          </div>
          {[
            { role:'Operator',  username:'admin',      password:'Admin@1234'  },
            { role:'Attendant', username:'attendant1', password:'Attend@123'  },
            { role:'Attendant', username:'attendant2', password:'Attend@123'  },
          ].map(({ role, username, password }) => (
            <div key={username} onClick={() => fillCreds(username, password)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'var(--space-2) var(--space-2)', borderBottom:'1px solid var(--gray-200)', cursor:'pointer', borderRadius:'var(--radius-sm)', transition:'background var(--transition-fast)' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--gray-100)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <div>
                <div style={{ fontSize:'var(--text-xs)', fontWeight:'var(--weight-semibold)', color:'var(--gray-700)' }}>{role}</div>
                <div style={{ fontSize:'var(--text-xs)', color:'var(--gray-500)', fontFamily:'var(--font-mono)' }}>{username} / {password}</div>
              </div>
              <div style={{ fontSize:'var(--text-xs)', color:'var(--brand-primary)', fontWeight:'var(--weight-medium)' }}>Fill</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop:'var(--space-6)', textAlign:'center', fontSize:'var(--text-xs)', color:'var(--gray-400)' }}>
          Smart Parking Management System &copy; 2025
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={e => { if (e.target === e.currentTarget) closeForgot(); }}>
          <div style={{ background:'var(--surface-card)', borderRadius:'var(--radius-xl)', padding:'var(--space-8)', width:420, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', position:'relative' }}>

            {/* Close */}
            <button onClick={closeForgot} style={{ position:'absolute', top:'var(--space-4)', right:'var(--space-4)', background:'none', border:'none', cursor:'pointer', color:'var(--gray-400)', padding:4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {/* Icon */}
            <div style={{ width:48, height:48, background:'rgba(26,86,219,0.1)', borderRadius:'var(--radius-xl)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'var(--space-4)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>

            <h3 style={{ fontSize:'var(--text-xl)', fontWeight:'var(--weight-bold)', color:'var(--gray-900)', marginBottom:'var(--space-1)' }}>Reset Password</h3>
            <p style={{ fontSize:'var(--text-sm)', color:'var(--gray-500)', marginBottom:'var(--space-5)' }}>Enter your username and we'll send a reset link to the associated email.</p>

            {/* Feedback */}
            {forgotStatus === 'success' && (
              <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'var(--radius-lg)', padding:'var(--space-3) var(--space-4)', fontSize:'var(--text-sm)', color:'#166534', display:'flex', gap:'var(--space-2)', alignItems:'flex-start', marginBottom:'var(--space-4)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink:0, marginTop:1 }}><polyline points="20 6 9 17 4 12"/></svg>
                {forgotMsg}
              </div>
            )}
            {forgotStatus === 'error' && (
              <div style={{ background:'var(--color-occupied-lt)', border:'1px solid #fca5a5', borderRadius:'var(--radius-lg)', padding:'var(--space-3) var(--space-4)', fontSize:'var(--text-sm)', color:'#991b1b', display:'flex', gap:'var(--space-2)', alignItems:'center', marginBottom:'var(--space-4)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {forgotMsg}
              </div>
            )}

            {forgotStatus !== 'success' && (
              <>
                <div className="form-group" style={{ marginBottom:'var(--space-4)' }}>
                  <label className="form-label">Username</label>
                  <div className="input-wrapper">
                    <svg className="input-icon-left" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <input
                      type="text" value={forgotUsername}
                      onChange={e => { setForgotUsername(e.target.value); setForgotStatus(null); }}
                      onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                      placeholder="Enter your username"
                      className="input has-icon-left"
                      autoFocus
                    />
                  </div>
                </div>
                <button onClick={handleForgotPassword} disabled={forgotLoading}
                  className="btn btn-primary btn-lg btn-block">
                  {forgotLoading ? <><span className="btn-spinner" /> Sending...</> : 'Send Reset Link'}
                </button>
              </>
            )}

            {forgotStatus === 'success' && (
              <button onClick={closeForgot} className="btn btn-primary btn-lg btn-block">Back to Sign In</button>
            )}
          </div>
        </div>
      )}

      <style>{`
        .login-left { display: flex; }
        @media(max-width:960px){ .login-left{ display:none; } }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
      `}</style>
    </div>
  );
}
