import { useState } from 'react';
import { login, register, storeSession, type AuthUser } from './api';

export function AuthScreen(props: { onAuthed: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result =
        mode === 'login'
          ? await login(email, password)
          : await register(email, password, fullName);
      storeSession(result.token, result.user);
      props.onAuthed(result.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
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
