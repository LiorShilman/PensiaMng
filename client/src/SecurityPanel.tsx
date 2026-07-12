import { useEffect, useState } from 'react';
import {
  getAuditLog,
  twoFaDisable,
  twoFaEnable,
  twoFaSetup,
  twoFaStatus,
  UnauthorizedError,
  type AuditEntry,
  type TwoFaSetup,
  type TwoFaStatus,
} from './api';

const ACTION_LABELS: Record<string, string> = {
  REGISTER: 'הרשמה',
  LOGIN_SUCCESS: 'התחברות',
  LOGIN_FAILED: 'ניסיון התחברות כושל',
  LOGIN_PASSWORD_OK_2FA_PENDING: 'סיסמה אושרה — ממתין לקוד 2FA',
  TWOFA_ENABLED: 'הפעלת 2FA',
  TWOFA_DISABLED: 'ביטול 2FA',
  TWOFA_VERIFY_FAILED: 'קוד 2FA שגוי',
  PORTFOLIO_SAVED: 'שמירת תיק',
  AI_SETTINGS_SAVED: 'עדכון הגדרות AI',
};

export function SecurityPanel(props: { onClose: () => void; onUnauthorized: () => void }) {
  const [status, setStatus] = useState<TwoFaStatus | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [setup, setSetup] = useState<TwoFaSetup | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function load() {
    twoFaStatus()
      .then(setStatus)
      .catch((e) => {
        if (e instanceof UnauthorizedError) props.onUnauthorized();
      });
    getAuditLog()
      .then(setAudit)
      .catch(() => {});
  }

  useEffect(load, []);

  async function onStartSetup() {
    setBusy(true);
    setError(null);
    try {
      const s = await twoFaSetup();
      setSetup(s);
      setBackupCodes(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onEnable(e: { preventDefault: () => void }) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { backupCodes: codes } = await twoFaEnable(code);
      setBackupCodes(codes);
      setSetup(null);
      setCode('');
      setInfo('אימות דו-שלבי הופעל בהצלחה — שמור את קודי הגיבוי במקום בטוח');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDisable(e: { preventDefault: () => void }) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await twoFaDisable(disableCode);
      setDisableCode('');
      setInfo('אימות דו-שלבי בוטל');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card ai-panel">
      <div className="ai-panel-head">
        <h2 className="card-title">אבטחה — אימות דו-שלבי ויומן גישה</h2>
        <button className="remove-btn" onClick={props.onClose} title="סגור">
          ✕
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {info && <p className="ai-status good">{info}</p>}

      {status?.enabled ? (
        <>
          <p className="hint">
            אימות דו-שלבי פעיל מאז{' '}
            {status.enabledAt &&
              new Date(status.enabledAt).toLocaleDateString('he-IL')}
            . נותרו {status.backupCodesRemaining} קודי גיבוי.
          </p>
          <form onSubmit={onDisable} className="auth-form" style={{ maxWidth: 320 }}>
            <label className="field">
              <span>לביטול — הזן קוד נוכחי מהאפליקציה או קוד גיבוי</span>
              <input
                type="text"
                dir="ltr"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                required
              />
            </label>
            <button className="save-btn" type="submit" disabled={busy}>
              בטל אימות דו-שלבי
            </button>
          </form>
        </>
      ) : backupCodes ? (
        <div>
          <p className="hint">
            קודי הגיבוי מוצגים פעם אחת בלבד — שמור אותם במקום בטוח. כל קוד ניתן
            לשימוש חד-פעמי במקום קוד האפליקציה.
          </p>
          <div className="backup-codes" dir="ltr">
            {backupCodes.map((c) => (
              <code key={c}>{c}</code>
            ))}
          </div>
        </div>
      ) : setup ? (
        <form onSubmit={onEnable} className="auth-form" style={{ maxWidth: 320 }}>
          <p className="hint">
            סרוק את קוד ה-QR באפליקציית אימות (Google Authenticator, Authy וכד') ואז
            הזן את הקוד בן 6 הספרות שהיא מציגה.
          </p>
          <img src={setup.qrDataUrl} alt="QR קוד להגדרת 2FA" width={180} height={180} />
          <p className="hint" dir="ltr">
            סוד ידני: <code>{setup.secret}</code>
          </p>
          <label className="field">
            <span>קוד אימות</span>
            <input
              type="text"
              dir="ltr"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              required
            />
          </label>
          <button className="calc-btn" type="submit" disabled={busy}>
            הפעל אימות דו-שלבי
          </button>
        </form>
      ) : (
        <>
          <p className="hint">
            אימות דו-שלבי (2FA) מוסיף שכבת הגנה נוספת — בנוסף לסיסמה תידרש להזין קוד
            מתחלף מאפליקציית אימות בכל התחברות.
          </p>
          <button className="calc-btn" onClick={onStartSetup} disabled={busy}>
            הפעל אימות דו-שלבי
          </button>
        </>
      )}

      {audit.length > 0 && (
        <details className="ai-usage-log" style={{ marginTop: 16 }}>
          <summary>יומן גישה ופעולות ({audit.length})</summary>
          <ul>
            {audit.map((a, i) => (
              <li key={i}>
                {new Date(a.createdAt).toLocaleString('he-IL', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {ACTION_LABELS[a.action] ?? a.action}
                {!a.success && ' · נכשל'}
                {a.detail && ` · ${a.detail}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
