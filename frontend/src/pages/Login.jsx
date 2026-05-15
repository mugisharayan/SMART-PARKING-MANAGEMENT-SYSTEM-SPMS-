import { useState, useEffect } from 'react';
import pngwingImg from '../pngwing.com (1).png';
import roadImg from '../road.png';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../lib/api';

// Modern professional fonts
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap';
if (!document.head.querySelector('[href*="Plus+Jakarta"]')) document.head.appendChild(fontLink);

/* ─────────────────────────────────────────────
   Inline SVG icon helpers (no extra deps)
───────────────────────────────────────────── */
const IconUser = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const IconLock = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconEye = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const IconArrow = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const IconAlert = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
const IconCheck = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconX = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const REMEMBER_KEY = 'pms_remember_me';

const CYCLING_WORDS = ['Simple...', 'Easy...', 'Quick...'];

const CAR_SVG = (
  <svg width="72" height="34" viewBox="0 0 48 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="8" width="36" height="11" rx="3" fill="#1a56db" opacity="0.9"/>
    <path d="M12 8 L16 2 H32 L36 8Z" fill="#60a5fa" opacity="0.85"/>
    <circle cx="14" cy="20" r="3" fill="#fff" opacity="0.9"/>
    <circle cx="34" cy="20" r="3" fill="#fff" opacity="0.9"/>
    <rect x="34" y="10" width="6" height="4" rx="1" fill="#fff" opacity="0.4"/>
    <rect x="8" y="10" width="5" height="3" rx="1" fill="#93c5fd" opacity="0.6"/>
  </svg>
);

// Count up hook
function useCountUp(target, duration = 1500, delay = 600) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const steps = 40;
      const increment = target / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) { setCount(target); clearInterval(timer); }
        else setCount(Math.floor(current));
      }, duration / steps);
      return () => clearInterval(timer);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return count;
}

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState('');
  const [lockoutMsg, setLockoutMsg]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [showPw, setShowPw]           = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);
  const [wordIndex, setWordIndex]     = useState(0);
  const [wordPhase, setWordPhase]     = useState('visible'); // 'visible' | 'car-out' | 'car-in'
  const [shake, setShake]             = useState(false);
  const [authOverlay, setAuthOverlay] = useState(false);

  // Real stats from database
  const [liveStats, setLiveStats] = useState({ slots: 0, zones: 0, gates: 2 });
  useEffect(() => {
    Promise.all([
      api.get('/api/slots').catch(() => ({ data: [] })),
      api.get('/api/destinations').catch(() => ({ data: [] })),
      api.get('/api/landmarks').catch(() => ({ data: [] })),
    ]).then(([slotsRes, destsRes, lmRes]) => {
      const gates = (lmRes.data || []).filter(
        (l) => l.type === 'ENTRY_GATE' || l.type === 'EXIT_GATE'
      ).length;
      setLiveStats({
        slots: (slotsRes.data || []).length,
        zones: (destsRes.data || []).length,
        gates: gates || 2,
      });
    });
  }, []);

  // Count up values — animate to real numbers
  const slots = useCountUp(liveStats.slots);
  const zones = useCountUp(liveStats.zones);
  const gates = useCountUp(liveStats.gates);

  // Cycle words with car animation
  useEffect(() => {
    const cycle = setInterval(() => {
      setWordPhase('car-out');
      setTimeout(() => {
        setWordIndex(i => (i + 1) % CYCLING_WORDS.length);
        setWordPhase('car-in');
        setTimeout(() => setWordPhase('visible'), 700);
      }, 700);
    }, 3200);
    return () => clearInterval(cycle);
  }, []);
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
    setServerError(''); setLockoutMsg(''); setLoading(true); setAuthOverlay(true);
    try {
      let token, user;
      try {
        const res = await api.post('/api/auth/login', data);
        token = res.data.token;
        user  = res.data.user;
      } catch (apiErr) {
        /* ── Demo / offline fallback ── */
        const DEMO_USERS = [
          { id: 'u1', username: 'admin',      password: 'Admin@1234',  role: 'OPERATOR',  name: 'Sarah Nakato',    failedAttempts: 0, lockedUntil: null },
          { id: 'u2', username: 'attendant1', password: 'Attend@123', role: 'ATTENDANT', name: 'James Okello',    failedAttempts: 0, lockedUntil: null },
          { id: 'u3', username: 'attendant2', password: 'Attend@123', role: 'ATTENDANT', name: 'Grace Achieng',   failedAttempts: 0, lockedUntil: null },
          { id: 'u4', username: 'operator2',  password: 'Oper@1234',  role: 'OPERATOR',  name: 'David Ssemakula', failedAttempts: 0, lockedUntil: null },
        ];
        const match = DEMO_USERS.find(
          (u) => u.username === data.username && u.password === data.password
        );
        if (!match) throw new Error('Invalid username or password.');
        token = 'demo-token-' + match.id;
        user  = { id: match.id, username: match.username, role: match.role, name: match.name };
      }
      if (rememberMe) localStorage.setItem(REMEMBER_KEY, data.username);
      else localStorage.removeItem(REMEMBER_KEY);
      setAuth(token, user);
      navigate(user.role === 'OPERATOR' ? '/operator' : '/attendant', { replace: true });
    } catch (err) {
      const msg = err.message || err.response?.data?.message || 'Invalid username or password.';
      if (msg.toLowerCase().includes('lock')) setLockoutMsg(msg);
      else setServerError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false); setAuthOverlay(false);
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
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:'var(--font-sans)', position:'relative', overflow:'hidden' }}>

      {/* ── Background ── */}
      <div style={{ position:'fixed', inset:0, background:'linear-gradient(135deg, #1a56db 0%, #1342b0 50%, #0f2d7a 100%)', zIndex:0 }} />

      {/* ── pngwing background image ── */}
      <img
        src={pngwingImg}
        alt=""
        style={{
          position:'fixed', top:'20%', left:'20%',
          width:'60%', height:'60%',
          objectFit:'cover',
          zIndex:3,
          opacity:1,
          pointerEvents:'none',
        }}
      />

      {/* ── road image below car ── */}
      <img
        src={roadImg}
        alt=""
        style={{
          position:'fixed', top:'73%', left:'20%',
          width:'60%', height:'28%',
          objectFit:'cover',
          zIndex:2,
          pointerEvents:'none',
        }}
      />

      {/* ── Left panel ── */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between',
        padding:'28px 5% 28px 6%', position:'relative', gap:0, zIndex:4,
      }} className="login-left">

        {/* ── Logo ── */}
        <div style={{ position:'relative', zIndex:4, display:'flex', alignItems:'center', gap:16, animation:'slideInLeft 0.7s cubic-bezier(0.22,1,0.36,1) both' }}>
          <div style={{ position:'relative', width:56, height:56, flexShrink:0 }}>
            <div style={{
              width:56, height:56, borderRadius:'50%',
              background:'linear-gradient(135deg, #1a3a6e 0%, #0d1f3c 100%)',
              border:'1.5px solid rgba(96,165,250,0.5)',
              boxShadow:'0 0 0 4px rgba(26,86,219,0.15), 0 8px 24px rgba(0,0,0,0.4)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <span style={{ fontSize:'1.6rem', fontWeight:900, color:'#60a5fa', letterSpacing:'-0.02em', lineHeight:1, textShadow:'0 0 16px rgba(96,165,250,0.6)', fontFamily:'"Plus Jakarta Sans", "Inter", sans-serif' }}>P</span>
            </div>
            <span style={{ position:'absolute', bottom:2, right:2, width:12, height:12, borderRadius:'50%', background:'#4ade80', border:'2px solid #0a0f1e', boxShadow:'0 0 8px rgba(74,222,128,0.8)', animation:'livePulse 2s ease-in-out infinite' }} />
          </div>

          {/* Brand text + location on same line */}
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:'1.25rem', fontWeight:900, color:'#ffffff', letterSpacing:'0.06em', lineHeight:1, textShadow:'0 2px 8px rgba(0,0,0,0.5)' }}>LUGOGO</span>
              <span style={{ fontSize:'1.25rem', fontWeight:300, color:'#93c5fd', letterSpacing:'0.06em', lineHeight:1, textShadow:'0 2px 8px rgba(0,0,0,0.5), 0 0 16px rgba(96,165,250,0.4)' }}>SPMS</span>
              <span style={{ width:1, height:16, background:'rgba(96,165,250,0.35)', display:'inline-block' }} />
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 6px #4ade80', flexShrink:0, animation:'livePulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize:'0.65rem', fontWeight:700, color:'rgba(255,255,255,0.75)', letterSpacing:'0.14em', textTransform:'uppercase' }}>Lugogo Mall · Kampala</span>
              </div>
            </div>
            <span style={{ fontSize:'0.6rem', fontWeight:600, color:'rgba(147,197,253,0.7)', letterSpacing:'0.22em', textTransform:'uppercase' }}>Smart Parking Management System</span>
          </div>
        </div>

        {/* ── Hero Content ── */}
        <div style={{ position:'relative', zIndex:4, display:'flex', flexDirection:'column', gap:14, flex:1, justifyContent:'center', paddingTop:'8%' }}>

          {/* Main heading — calligraphic style */}
          <h1 style={{ margin:0, padding:0, lineHeight:1.05, display:'flex', flexDirection:'column', gap:4 }}>
            <span style={{
              fontSize:'clamp(2rem, 3.8vw, 3.2rem)', fontWeight:900, color:'#ffffff',
              letterSpacing:'-0.03em',
              fontFamily:'"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
              textShadow:'0 2px 12px rgba(0,0,0,0.6), 0 4px 32px rgba(0,0,0,0.4)',
              animation:'slideInLeft 0.8s cubic-bezier(0.22,1,0.36,1) both',
              display:'block', whiteSpace:'nowrap',
            }}>Intelligent Parking</span>
            <span style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'nowrap' }}>
              <span style={{
                fontSize:'clamp(2rem, 3.8vw, 3.2rem)', fontWeight:900,
                fontFamily:'"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
                letterSpacing:'-0.03em',
                background:'linear-gradient(90deg, #60a5fa 0%, #93c5fd 45%, #3b82f6 75%, #60a5fa 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                filter:'drop-shadow(0 2px 6px rgba(96,165,250,0.35))',
                animation:'slideInLeft 0.8s 0.2s cubic-bezier(0.22,1,0.36,1) both',
                whiteSpace:'nowrap',
              }}>Made</span>
              <span style={{
                fontSize:'clamp(2rem, 3.8vw, 3.2rem)', fontWeight:900,
                fontFamily:'"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
                letterSpacing:'-0.03em', color:'#ffffff',
                display:'inline-flex', alignItems:'center', minWidth:'clamp(120px, 14vw, 200px)', overflow:'hidden',
                position:'relative', whiteSpace:'nowrap',
              }}>
                <span style={{
                  display: wordPhase === 'visible' ? 'inline' : 'none',
                  animation: wordPhase === 'visible' ? 'wordFadeIn 0.6s cubic-bezier(0.25,0.1,0.25,1) both' : 'none',
                  textShadow:'0 0 30px rgba(255,255,255,0.25), 0 2px 12px rgba(0,0,0,0.5)',
                }}>{CYCLING_WORDS[wordIndex]}</span>
                {wordPhase === 'car-out' && (
                  <span style={{ display:'inline-flex', alignItems:'center', animation:'carDriveOut 0.7s cubic-bezier(0.25,0.1,0.25,1) both' }}>{CAR_SVG}</span>
                )}
                {wordPhase === 'car-in' && (
                  <span style={{ display:'inline-flex', alignItems:'center', animation:'carDriveIn 0.7s cubic-bezier(0.25,0.1,0.25,1) both' }}>{CAR_SVG}</span>
                )}
              </span>
            </span>
          </h1>

          {/* Single clean description line */}
          <p style={{ margin:0, fontSize:'0.9rem', color:'rgba(255,255,255,0.8)', lineHeight:1.6, fontWeight:400, textShadow:'0 1px 8px rgba(0,0,0,0.6)', animation:'slideInLeft 0.7s 0.35s cubic-bezier(0.22,1,0.36,1) both', fontFamily:'"Inter", system-ui, sans-serif' }}>
            Real-time slots, plate recognition &amp; instant alerts — all from one screen.
          </p>

          {/* ── Feature cards 2×2 grid ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, animation:'slideInLeft 0.7s 0.45s cubic-bezier(0.22,1,0.36,1) both', marginTop:'auto', paddingTop:16, columnGap:12, marginBottom:16 }}>
            {[
              {
                color:'#60a5fa', glow:'rgba(96,165,250,0.25)', delay:'0.5s',
                badge:'LIVE', badgeBg:'rgba(96,165,250,0.18)', badgeColor:'#93c5fd',
                icon:(
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                ),
                label:'Real-time Slots', desc:'Live visibility across all zones',
              },
              {
                color:'#60a5fa', glow:'rgba(96,165,250,0.25)', delay:'0.6s',
                badge:'AUTO', badgeBg:'rgba(96,165,250,0.18)', badgeColor:'#93c5fd',
                icon:(
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="10" rx="2"/>
                    <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>
                    <line x1="12" y1="12" x2="12.01" y2="12" strokeWidth="3"/>
                  </svg>
                ),
                label:'Plate Recognition', desc:'Automated number plate capture',
              },
              {
                color:'#34d399', glow:'rgba(52,211,153,0.25)', delay:'0.7s',
                badge:'INSTANT', badgeBg:'rgba(52,211,153,0.18)', badgeColor:'#6ee7b7',
                icon:(
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                ),
                label:'Driver Alerts', desc:'Instant operator notifications',
              },
              {
                color:'#a78bfa', glow:'rgba(167,139,250,0.25)', delay:'0.8s',
                badge:'24/7', badgeBg:'rgba(167,139,250,0.18)', badgeColor:'#c4b5fd',
                icon:(
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                ),
                label:'Live Analytics', desc:'Occupancy reports & insights',
              },
            ].map(({ color, glow, delay, badge, badgeBg, badgeColor, icon, label, desc }) => (
              <div key={label}
                style={{
                  position:'relative', padding:'8px 9px 7px',
                  background:'rgba(255,255,255,0.05)',
                  border:`1px solid rgba(255,255,255,0.09)`,
                  borderRadius:10,
                  backdropFilter:'blur(12px)',
                  display:'flex', flexDirection:'column', gap:5,
                  animation:`featureCardIn 0.55s ${delay} cubic-bezier(0.22,1,0.36,1) both`,
                  transition:'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  cursor:'default', overflow:'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform='translateY(-2px)';
                  e.currentTarget.style.boxShadow=`0 6px 20px ${glow}, 0 2px 6px rgba(0,0,0,0.3)`;
                  e.currentTarget.style.borderColor=`${color}55`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform='translateY(0)';
                  e.currentTarget.style.boxShadow='none';
                  e.currentTarget.style.borderColor='rgba(255,255,255,0.1)';
                }}
              >
                {/* Top accent line */}
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, transparent, ${color}, transparent)`, borderRadius:'12px 12px 0 0' }} />

                {/* Icon + badge row */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{
                    width:26, height:26, borderRadius:7,
                    background:`${color}18`,
                    border:`1px solid ${color}40`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    flexShrink:0,
                  }}>{icon}</div>
                  <span style={{
                    fontSize:'0.5rem', fontWeight:700, letterSpacing:'0.07em',
                    color: badgeColor, background: badgeBg,
                    border:`1px solid ${color}30`,
                    padding:'2px 4px', borderRadius:20,
                    textTransform:'uppercase',
                  }}>{badge}</span>
                </div>

                {/* Text */}
                <div>
                  <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#ffffff', lineHeight:1.2, letterSpacing:'-0.01em', fontFamily:'"Plus Jakarta Sans", sans-serif' }}>{label}</div>
                  <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.4)', marginTop:1, lineHeight:1.3 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div style={{
          position:'relative', zIndex:4,
          display:'flex',
          background:'rgba(255,255,255,0.06)',
          border:'1px solid rgba(255,255,255,0.12)',
          borderRadius:16,
          backdropFilter:'blur(20px)',
          overflow:'hidden',
          boxShadow:'0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
          animation:'slideInUp 0.7s 0.55s cubic-bezier(0.22,1,0.36,1) both',
        }}>
          {[
            { val: slots,  label:'Total Slots', color:'#60a5fa',  icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
            { val: zones,  label:'Zones',       color:'#60a5fa',  icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
            { val: gates,  label:'Gates',       color:'#34d399',  icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> },
            { val:'24/7',  label:'Uptime',      color:'#a78bfa',  icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
          ].map(({ val, label, color, icon }, i) => (
            <div key={label} style={{
              flex:1,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              padding:'10px 6px',
              borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              position:'relative',
              gap:4,
            }}>
              {/* Colored glow dot at top */}
              <div style={{
                position:'absolute', top:0, left:'50%', transform:'translateX(-50%)',
                width:40, height:2,
                background:`linear-gradient(90deg, transparent, ${color}, transparent)`,
                borderRadius:2,
              }} />
              {/* Icon */}
              <span style={{ color, opacity:0.9, filter:`drop-shadow(0 0 6px ${color})` }}>{icon}</span>
              {/* Value */}
              <div style={{
                fontSize:'1.2rem', fontWeight:900, color:'#ffffff',
                letterSpacing:'-0.04em', lineHeight:1,
                textShadow:`0 2px 8px rgba(0,0,0,0.5), 0 0 20px rgba(255,255,255,0.15)`,
              }}>{val}</div>
              {/* Label */}
              <div style={{
                fontSize:'0.58rem', color:'rgba(147,197,253,0.8)',
                textTransform:'uppercase', letterSpacing:'0.14em', fontWeight:700,
                textShadow:'0 1px 4px rgba(0,0,0,0.5)',
              }}>{label}</div>
            </div>
          ))}
        </div>


      </div>

      {/* ── Right panel — Glassmorphism card ── */}
      <div style={{
        display:'flex',
        flexDirection:'column',
        alignItems:'center',
        justifyContent:'center',
        padding:'140px 32px 40px',
        position:'relative',
        zIndex:4,
        gap:0,
      }}>

        <div style={{
          width:360,
          display:'flex',
          flexDirection:'column',
          justifyContent:'center',
          alignItems:'center',
          padding:'28px 28px',
          background:'rgba(255,255,255,0.08)',
          backdropFilter:'blur(32px)',
          WebkitBackdropFilter:'blur(32px)',
          border:'1px solid rgba(255,255,255,0.18)',
          borderTop:'3px solid rgba(26,86,219,0.8)',
          borderRadius:24,
          boxShadow:'0 8px 48px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
          animation: shake ? 'shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97)' : 'none',
          position:'relative',
          overflow:'hidden',
        }}>
          {/* Auth overlay spinner */}
          {authOverlay && (
            <div style={{ position:'absolute', inset:0, background:'rgba(10,15,30,0.6)', backdropFilter:'blur(4px)', borderRadius:24, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:10, gap:14 }}>
              <div style={{ width:44, height:44, border:'3px solid rgba(96,165,250,0.2)', borderTop:'3px solid #60a5fa', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
              <span style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.7)', fontWeight:600, letterSpacing:'0.05em' }}>Authenticating...</span>
            </div>
          )}
        {/* Centered form container */}
        <div style={{ width:'100%', maxWidth:360, display:'flex', flexDirection:'column', gap:0 }}>

          {/* Lock icon + heading */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:20, textAlign:'center' }}>
            <div style={{
              width:44, height:44, borderRadius:14,
              background:'linear-gradient(135deg, rgba(26,86,219,0.5) 0%, rgba(14,165,233,0.4) 100%)',
              border:'1px solid rgba(96,165,250,0.4)',
              display:'flex', alignItems:'center', justifyContent:'center',
              marginBottom:12,
              boxShadow:'0 8px 24px rgba(0,0,0,0.3), 0 0 20px rgba(26,86,219,0.2)',
              backdropFilter:'blur(8px)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.2">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 style={{ fontSize:'1.35rem', fontWeight:800, color:'#ffffff', letterSpacing:'-0.03em', margin:0, marginBottom:4, textShadow:'0 2px 12px rgba(0,0,0,0.4)' }}>Sign In</h2>
            <p style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.7)', margin:0, lineHeight:1.5 }}>Access the Lugogo Smart Parking System</p>
          </div>

          {/* Server error */}
          {serverError && (
            <div style={{
              background:'rgba(248,113,113,0.15)', border:'1px solid rgba(248,113,113,0.4)',
              borderRadius:10, padding:'10px 14px',
              fontSize:'0.83rem', color:'#fca5a5',
              display:'flex', alignItems:'center', gap:8, marginBottom:16,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {serverError}
            </div>
          )}

          {/* Lockout */}
          {lockoutMsg && (
            <div style={{
              background:'#fffbeb', border:'1px solid #fde68a',
              borderRadius:10, padding:'12px 14px',
              fontSize:'0.83rem', color:'#92400e',
              display:'flex', alignItems:'flex-start', gap:10,
              marginBottom:16,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0,marginTop:1}}>
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <div>
                <div style={{fontWeight:600, marginBottom:2}}>Account Locked</div>
                <div>{lockoutMsg}</div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Username */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:'0.8rem', fontWeight:600, color:'rgba(255,255,255,0.8)' }}>
                Username <span style={{color:'#f87171'}}>*</span>
              </label>
              <div style={{ position:'relative' }}>
                <svg style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.4)', pointerEvents:'none' }}
                  width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input {...register('username')} type="text" placeholder="Enter your username"
                  autoComplete="username"
                  style={{
                    width:'100%', padding:'11px 14px 11px 38px',
                    fontSize:'0.875rem', color:'#ffffff',
                    background:'rgba(255,255,255,0.08)',
                    border:`1.5px solid ${errors.username ? '#f87171' : 'rgba(255,255,255,0.18)'}`,
                    borderRadius:10, outline:'none',
                    transition:'all 0.15s ease',
                    boxSizing:'border-box',
                    backdropFilter:'blur(8px)',
                  }}
                  onFocus={e => { e.target.style.borderColor='#60a5fa'; e.target.style.background='rgba(255,255,255,0.12)'; e.target.style.boxShadow='0 0 0 3px rgba(96,165,250,0.2)'; }}
                  onBlur={e => { e.target.style.borderColor=errors.username?'#f87171':'rgba(255,255,255,0.18)'; e.target.style.background='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; }}
                />
              </div>
              {errors.username && <span style={{fontSize:'0.75rem', color:'#f87171'}}>{errors.username.message}</span>}
            </div>

            {/* Password */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:'0.8rem', fontWeight:600, color:'rgba(255,255,255,0.8)' }}>
                Password <span style={{color:'#f87171'}}>*</span>
              </label>
              <div style={{ position:'relative' }}>
                <svg style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,0.4)', pointerEvents:'none' }}
                  width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input {...register('password')} type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password" autoComplete="current-password"
                  style={{
                    width:'100%', padding:'11px 42px 11px 38px',
                    fontSize:'0.875rem', color:'#ffffff',
                    background:'rgba(255,255,255,0.08)',
                    border:`1.5px solid ${errors.password ? '#f87171' : 'rgba(255,255,255,0.18)'}`,
                    borderRadius:10, outline:'none',
                    transition:'all 0.15s ease',
                    boxSizing:'border-box',
                    backdropFilter:'blur(8px)',
                  }}
                  onFocus={e => { e.target.style.borderColor='#60a5fa'; e.target.style.background='rgba(255,255,255,0.12)'; e.target.style.boxShadow='0 0 0 3px rgba(96,165,250,0.2)'; }}
                  onBlur={e => { e.target.style.borderColor=errors.password?'#f87171':'rgba(255,255,255,0.18)'; e.target.style.background='rgba(255,255,255,0.08)'; e.target.style.boxShadow='none'; }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.5)', padding:2, display:'flex' }}>
                  {showPw
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              {errors.password && <span style={{fontSize:'0.75rem', color:'#f87171'}}>{errors.password.message}</span>}
            </div>

            {/* Remember me + Forgot */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:'0.82rem', color:'rgba(255,255,255,0.7)', userSelect:'none' }}>
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  style={{ width:15, height:15, accentColor:'#60a5fa', cursor:'pointer' }} />
                Remember me
              </label>
              <button type="button"
                onClick={() => { setShowForgot(true); setForgotUsername(''); setForgotStatus(null); setForgotMsg(''); }}
                style={{ background:'none', border:'none', padding:0, fontSize:'0.82rem', color:'#93c5fd', cursor:'pointer', fontWeight:500 }}>
                Forgot password?
              </button>
            </div>

            {/* Submit button — gradient */}
            <button type="submit" disabled={loading}
              style={{
                width:'100%', padding:'13px',
                fontSize:'0.9rem', fontWeight:700, color:'#ffffff',
                background: loading ? 'rgba(26,86,219,0.4)' : 'linear-gradient(135deg, #1a56db 0%, #3b82f6 50%, #1a56db 100%)',
                border:'none', borderRadius:10, cursor: loading ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow: loading ? 'none' : '0 4px 20px rgba(26,86,219,0.5)',
                transition:'all 0.2s ease', marginTop:4,
                letterSpacing:'0.02em',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow='0 6px 28px rgba(26,86,219,0.65)'; e.currentTarget.style.transform='translateY(-1px)'; }}}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='0 4px 20px rgba(26,86,219,0.5)'; e.currentTarget.style.transform='translateY(0)'; }}
            >
              {loading ? (
                <><span className="btn-spinner" /> Authenticating...</>
              ) : (
                <><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Sign In</>
              )}
            </button>
          </form>

          {/* Dev tools — collapsible demo credentials */}
          <details style={{ marginTop:20 }}>
            <summary style={{
              fontSize:'0.72rem', fontWeight:600, color:'rgba(255,255,255,0.35)',
              textTransform:'uppercase', letterSpacing:'0.08em',
              cursor:'pointer', userSelect:'none', listStyle:'none',
              display:'flex', alignItems:'center', gap:6,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              Dev Tools — Demo Credentials
            </summary>
            <div style={{ marginTop:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, overflow:'hidden', backdropFilter:'blur(8px)' }}>
              {[
                { role:'Operator',  username:'admin',      password:'Admin@1234' },
                { role:'Attendant', username:'attendant1', password:'Attend@123' },
                { role:'Attendant', username:'attendant2', password:'Attend@123' },
              ].map(({ role, username, password }, i) => (
                <div key={username} onClick={() => fillCreds(username, password)}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'9px 12px',
                    borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    cursor:'pointer', transition:'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  <div>
                    <div style={{ fontSize:'0.75rem', fontWeight:600, color:'rgba(255,255,255,0.8)' }}>{role}</div>
                    <div style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.4)', fontFamily:'monospace' }}>{username} / {password}</div>
                  </div>
                  <span style={{ fontSize:'0.72rem', color:'#60a5fa', fontWeight:600 }}>Fill ↗</span>
                </div>
              ))}
            </div>
          </details>

          <div style={{ marginTop:24, textAlign:'center', fontSize:'0.7rem', color:'rgba(147,197,253,0.45)' }}>
            Smart Parking Management System &copy; 2025
          </div>
        </div>
        </div>

      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeForgot(); }}
          style={{
            position:'fixed', inset:0, zIndex:1000,
            background:'rgba(10,15,30,0.6)',
            backdropFilter:'blur(8px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:16,
            animation:'fadeIn 0.15s ease',
          }}
        >
          <div style={{
            background:'#ffffff',
            borderRadius:20,
            padding:'36px 32px',
            width:'100%', maxWidth:400,
            boxShadow:'0 24px 64px rgba(0,0,0,0.25)',
            position:'relative',
            animation:'scaleIn 0.2s ease',
          }}>

            {/* Close button */}
            <button onClick={closeForgot} style={{
              position:'absolute', top:16, right:16,
              width:32, height:32, borderRadius:8,
              background:'#f1f5f9', border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#64748b', transition:'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background='#e2e8f0'; e.currentTarget.style.color='#0f172a'; }}
              onMouseLeave={e => { e.currentTarget.style.background='#f1f5f9'; e.currentTarget.style.color='#64748b'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            {/* Icon */}
            <div style={{
              width:48, height:48, borderRadius:14,
              background:'linear-gradient(135deg, #1a56db 0%, #0ea5e9 100%)',
              display:'flex', alignItems:'center', justifyContent:'center',
              marginBottom:16,
              boxShadow:'0 6px 20px rgba(26,86,219,0.3)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>

            <h3 style={{ fontSize:'1.25rem', fontWeight:800, color:'#0f172a', marginBottom:6, letterSpacing:'-0.02em' }}>
              Reset Password
            </h3>
            <p style={{ fontSize:'0.83rem', color:'#64748b', marginBottom:24, lineHeight:1.6 }}>
              Enter your username and we'll send a reset link to the associated email address.
            </p>

            {/* Success state */}
            {forgotStatus === 'success' && (
              <div style={{
                background:'#f0fdf4', border:'1px solid #86efac',
                borderRadius:10, padding:'12px 14px',
                fontSize:'0.83rem', color:'#166534',
                display:'flex', gap:8, alignItems:'flex-start',
                marginBottom:20,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{flexShrink:0,marginTop:1}}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {forgotMsg}
              </div>
            )}

            {/* Error state */}
            {forgotStatus === 'error' && (
              <div style={{
                background:'#fef2f2', border:'1px solid #fecaca',
                borderRadius:10, padding:'10px 14px',
                fontSize:'0.83rem', color:'#991b1b',
                display:'flex', gap:8, alignItems:'center',
                marginBottom:20,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {forgotMsg}
              </div>
            )}

            {forgotStatus !== 'success' ? (
              <>
                {/* Username input */}
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
                  <label style={{ fontSize:'0.8rem', fontWeight:600, color:'#374151' }}>Username</label>
                  <div style={{ position:'relative' }}>
                    <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', pointerEvents:'none' }}
                      width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <input
                      type="text" value={forgotUsername}
                      onChange={e => { setForgotUsername(e.target.value); setForgotStatus(null); }}
                      onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                      placeholder="Enter your username"
                      autoFocus
                      style={{
                        width:'100%', padding:'12px 14px 12px 36px',
                        fontSize:'0.875rem', color:'#111827',
                        background:'#f8fafc', border:'1.5px solid #e2e8f0',
                        borderRadius:10, outline:'none',
                        boxSizing:'border-box', transition:'all 0.15s',
                      }}
                      onFocus={e => { e.target.style.borderColor='#1a56db'; e.target.style.background='#fff'; e.target.style.boxShadow='0 0 0 3px rgba(26,86,219,0.1)'; }}
                      onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.background='#f8fafc'; e.target.style.boxShadow='none'; }}
                    />
                  </div>
                </div>

                {/* Send button */}
                <button onClick={handleForgotPassword} disabled={forgotLoading}
                  style={{
                    width:'100%', padding:'12px',
                    fontSize:'0.875rem', fontWeight:700, color:'#fff',
                    background: forgotLoading ? '#93c5fd' : 'linear-gradient(135deg, #1a56db 0%, #0ea5e9 100%)',
                    border:'none', borderRadius:10,
                    cursor: forgotLoading ? 'not-allowed' : 'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    boxShadow: forgotLoading ? 'none' : '0 4px 14px rgba(26,86,219,0.3)',
                    transition:'all 0.2s',
                  }}>
                  {forgotLoading
                    ? <><span className="btn-spinner" /> Sending...</>
                    : 'Send Reset Link'
                  }
                </button>
              </>
            ) : (
              <button onClick={closeForgot}
                style={{
                  width:'100%', padding:'12px',
                  fontSize:'0.875rem', fontWeight:700, color:'#fff',
                  background:'linear-gradient(135deg, #1a56db 0%, #0ea5e9 100%)',
                  border:'none', borderRadius:10, cursor:'pointer',
                  boxShadow:'0 4px 14px rgba(26,86,219,0.3)',
                }}>
                Back to Sign In
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        .login-left { display: flex; }
        @media(max-width:960px){ .login-left{ display:none; } }
        input::placeholder { color: rgba(255,255,255,0.3) !important; }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
        @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes scaleIn   { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        @keyframes slideInLeft {
          from { opacity:0; transform:translateX(-32px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes slideInUp {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes slideToRight {
          from { opacity:0; transform:translateX(-40px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes featureCardIn {
          from { opacity:0; transform:translateY(20px) scale(0.96); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes spin {
          to { transform:rotate(360deg); }
        }
        @keyframes shake {
          0%,100% { transform:translateX(0); }
          15%     { transform:translateX(-8px); }
          30%     { transform:translateX(8px); }
          45%     { transform:translateX(-6px); }
          60%     { transform:translateX(6px); }
          75%     { transform:translateX(-3px); }
          90%     { transform:translateX(3px); }
        }
        @keyframes carDriveOut {
          0%   { opacity:1; transform:translateX(0) scaleX(1); }
          30%  { opacity:1; transform:translateX(20px) scaleX(1.05); }
          80%  { opacity:0.6; transform:translateX(120px) scaleX(1.12); }
          100% { opacity:0; transform:translateX(220px) scaleX(1.15); }
        }
        @keyframes carDriveIn {
          0%   { opacity:0; transform:translateX(-220px) scaleX(1.15); }
          20%  { opacity:0.6; transform:translateX(-120px) scaleX(1.1); }
          70%  { opacity:1; transform:translateX(-10px) scaleX(1.02); }
          85%  { transform:translateX(4px) scaleX(0.99); }
          100% { opacity:1; transform:translateX(0) scaleX(1); }
        }
        @keyframes wordFadeIn {
          0%   { opacity:0; transform:translateY(8px) scale(0.95); }
          60%  { opacity:1; transform:translateY(-2px) scale(1.02); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
