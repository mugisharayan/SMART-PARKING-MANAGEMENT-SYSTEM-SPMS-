import { useState } from 'react';
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

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState('');
  const [lockoutMsg, setLockoutMsg]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [showPw, setShowPw]           = useState(false);

  const { register, handleSubmit, setValue, clearErrors, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setServerError(''); setLockoutMsg(''); setLoading(true);
    try {
      const res = await api.post('/api/auth/login', data);
      const { token, user } = res.data;
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
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: 'var(--space-12)', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(145deg, #0f172a 0%, #1e3a5f 50%, #1a56db 100%)'
      }} className="login-left">

        {/* Decorative circles */}
        <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'rgba(26,86,219,0.15)', top:-200, right:-200 }} />
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'rgba(255,255,255,0.04)', bottom:-100, left:-100 }} />

        {/* Brand */}
        <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', gap:'var(--space-3)' }}>
          <div style={{ width:48, height:48, background:'var(--brand-primary)', borderRadius:'var(--radius-xl)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px rgba(26,86,219,0.5)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <rect x="1" y="3" width="15" height="13" rx="2"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:'var(--text-xl)', fontWeight:'var(--weight-bold)', color:'#fff', letterSpacing:'-0.02em' }}>Lugogo Mall PMS</div>
            <div style={{ fontSize:'var(--text-xs)', color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'0.1em' }}>Parking Management System</div>
          </div>
        </div>

        {/* Hero */}
        <div style={{ position:'relative', zIndex:1 }}>
          <h1 style={{ fontSize:'2.75rem', fontWeight:'var(--weight-extrabold)', color:'#fff', lineHeight:1.15, letterSpacing:'-0.03em', marginBottom:'var(--space-4)' }}>
            Smart Parking<br/>for <span style={{ color:'var(--brand-accent)' }}>Lugogo Mall</span>
          </h1>
          <p style={{ fontSize:'var(--text-base)', color:'rgba(255,255,255,0.6)', lineHeight:'var(--leading-relaxed)', maxWidth:380 }}>
            Real-time slot management, automatic plate capture, and instant driver notifications — all in one system.
          </p>
        </div>

        {/* Stats */}
        <div style={{ position:'relative', zIndex:1, display:'flex', gap:'var(--space-6)' }}>
          {[['30','Total Slots'],['5','Zones'],['2','Entry Gates'],['24/7','Monitoring']].map(([val, label]) => (
            <div key={label}>
              <div style={{ fontSize:'var(--text-2xl)', fontWeight:'var(--weight-extrabold)', color:'#fff', letterSpacing:'-0.03em' }}>{val}</div>
              <div style={{ fontSize:'var(--text-xs)', color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ width:480, display:'flex', flexDirection:'column', justifyContent:'center', padding:'var(--space-12) var(--space-10)', background:'var(--surface-card)', boxShadow:'-8px 0 40px rgba(0,0,0,0.08)' }}>

        <div style={{ marginBottom:'var(--space-8)' }}>
          <h2 style={{ fontSize:'var(--text-3xl)', fontWeight:'var(--weight-extrabold)', color:'var(--gray-900)', letterSpacing:'-0.03em', marginBottom:'var(--space-2)' }}>Welcome back</h2>
          <p style={{ fontSize:'var(--text-sm)', color:'var(--gray-500)' }}>Sign in to access the Parking Management System</p>
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
          Lugogo Mall Parking Management System &copy; 2025
        </div>
      </div>

      {/* Hide left panel on small screens */}
      <style>{`.login-left { display: flex; } @media(max-width:900px){ .login-left{ display:none; } }`}</style>
    </div>
  );
}
