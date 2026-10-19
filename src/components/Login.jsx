import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError('Kullanıcı adı ve şifre gereklidir.'); return; }
    setLoading(true);
    setError('');
    const result = await login(username, password);
    setLoading(false);
    if (!result.success) setError(result.message || 'Giriş başarısız.');
  };

  return (
    <div style={s.root}>
      {/* Background Ambient Glow Orbs */}
      <div style={s.glowTopLeft} />
      <div style={s.glowBottomRight} />

      {/* Main Glass Card */}
      <div style={s.glassCard}>
        {/* Top Tech Badge */}
        <div style={s.badge}>
          <span style={s.badgeDot} />
          <span style={s.badgeText}>IT SERVICE & ASSET PORTAL</span>
        </div>

        {/* Brand Logo & Header */}
        <div style={s.brandSection}>
          <div style={s.logoContainer}>
            <img src={logo} alt="Logo" style={s.logoImg} />
          </div>
          <h1 style={s.mainTitle}>Servis & Toner Takip</h1>
          <p style={s.subTitle}>Devam etmek için oturum açın</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} autoComplete="on" style={s.form}>
          <div style={s.inputGroup}>
            <label style={s.inputLabel}>Kullanıcı Adı</label>
            <div style={s.inputFieldWrapper}>
              <span style={s.inputIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                type="text"
                style={s.inputControl}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Kullanıcı adınızı giriniz"
                autoFocus
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          <div style={s.inputGroup}>
            <label style={s.inputLabel}>Şifre</label>
            <div style={s.inputFieldWrapper}>
              <span style={s.inputIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                style={s.inputControl}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Şifrenizi giriniz"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                style={s.passwordToggleBtn}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                title={showPassword ? "Gizle" : "Göster"}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div style={s.errorAlert}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} style={{ ...s.primarySubmitBtn, ...(loading ? s.submitDisabled : {}) }}>
            {loading ? (
              <>
                <span style={s.loadingSpinner} />
                Doğrulanıyor...
              </>
            ) : (
              <>
                Sisteme Giriş Yap
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={s.cardFooter}>
          <div style={s.statusPill}>
            <span style={s.statusDot} />
            <span>Created by <strong>Open Source Community</strong> &bull; v2.3.2</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  root: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: '"Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: '#090d16',
    overflow: 'hidden',
    userSelect: 'none',
  },
  glowTopLeft: {
    position: 'absolute',
    top: '-15%',
    left: '-10%',
    width: '50vw',
    height: '50vw',
    maxWidth: 600,
    maxHeight: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, rgba(99, 102, 241, 0) 70%)',
    pointerEvents: 'none',
  },
  glowBottomRight: {
    position: 'absolute',
    bottom: '-15%',
    right: '-10%',
    width: '50vw',
    height: '50vw',
    maxWidth: 600,
    maxHeight: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, rgba(14, 165, 233, 0) 70%)',
    pointerEvents: 'none',
  },
  glassCard: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    maxWidth: 400,
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: '36px 36px 28px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 12px',
    borderRadius: 20,
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    marginBottom: 24,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#818cf8',
    boxShadow: '0 0 8px #818cf8',
  },
  badgeText: {
    color: '#a5b4fc',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  brandSection: {
    textAlign: 'center',
    marginBottom: 28,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 16,
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  mainTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#f8fafc',
    letterSpacing: '-0.4px',
  },
  subTitle: {
    margin: '6px 0 0',
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: 400,
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    marginLeft: 2,
  },
  inputFieldWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  inputControl: {
    width: '100%',
    padding: '12px 40px 12px 42px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    color: '#f8fafc',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
  },
  passwordToggleBtn: {
    position: 'absolute',
    right: 12,
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    transition: 'color 0.2s',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#f87171',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 500,
  },
  primarySubmitBtn: {
    marginTop: 6,
    width: '100%',
    padding: '13px 18px',
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.4)',
  },
  submitDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  loadingSpinner: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  cardFooter: {
    marginTop: 28,
    paddingTop: 18,
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 11,
    color: '#64748b',
    fontWeight: 500,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#10b981',
    boxShadow: '0 0 6px #10b981',
  },
};
