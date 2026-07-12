import { useState } from 'react';
import {
  login,
  register,
  storeSession,
  twoFaVerify,
  type AuthUser,
} from './api';
import { IconLock } from './icons';

export function AuthScreen(props: { onAuthed: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  async function onSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result =
        mode === 'login'
          ? await login(email, password)
          : await register(email, password, fullName);
      if ('requires2fa' in result) {
        setTempToken(result.tempToken);
        return;
      }
      storeSession(result.token, result.user);
      props.onAuthed(result.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitCode(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!tempToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await twoFaVerify(tempToken, code);
      storeSession(result.token, result.user);
      props.onAuthed(result.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (tempToken) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <div className="logo-row auth-logo">
            <div className="logo-mark">{IconLock}</div>
            <h1 className="logo-text">אימות דו-שלבי</h1>
          </div>
          <p className="auth-subtitle">
            הזן את הקוד מאפליקציית האימות שלך, או קוד גיבוי
          </p>

          <form onSubmit={onSubmitCode} className="auth-form">
            <label className="field">
              <span>קוד אימות</span>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                dir="ltr"
                autoFocus
                autoComplete="one-time-code"
                required
              />
            </label>

            {error && <div className="error">{error}</div>}

            <button className="calc-btn auth-submit" type="submit" disabled={loading}>
              {loading ? 'רק רגע…' : 'אימות'}
            </button>
          </form>

          <button
            className="trace-toggle auth-switch"
            onClick={() => {
              setTempToken(null);
              setCode('');
              setError(null);
            }}
          >
            חזרה להתחברות
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="logo-row auth-logo">
          <div className="logo-mark">₪</div>
          <h1 className="logo-text">PensiaMng</h1>
        </div>
        <p className="auth-subtitle">
          {mode === 'login' ? 'התחברות למערכת' : 'פתיחת חשבון חדש'}
        </p>

        <form onSubmit={onSubmit} className="auth-form">
          {mode === 'register' && (
            <label className="field">
              <span>שם מלא</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}
          <label className="field">
            <span>אימייל</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              dir="ltr"
              required
            />
          </label>
          <label className="field">
            <span>סיסמה {mode === 'register' && '(6 תווים לפחות)'}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              dir="ltr"
              minLength={6}
              required
            />
          </label>

          {error && <div className="error">{error}</div>}

          <button className="calc-btn auth-submit" type="submit" disabled={loading}>
            {loading ? 'רק רגע…' : mode === 'login' ? 'כניסה' : 'הרשמה'}
          </button>
        </form>

        <button
          className="trace-toggle auth-switch"
          onClick={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'));
            setError(null);
          }}
        >
          {mode === 'login' ? 'אין לך חשבון? הירשם כאן' : 'כבר רשום? התחבר כאן'}
        </button>
      </div>

      <p className="footer">הנתונים נשמרים במסד נתונים מקומי במחשב שלך בלבד.</p>
    </div>
  );
}
