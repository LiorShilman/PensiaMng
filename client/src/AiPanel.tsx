import { useEffect, useState } from 'react';
import {
  getAiModels,
  getAiSettings,
  getAiUsage,
  saveAiSettings,
  type AiModelInfo,
  type AiProvider,
  type AiSettingsView,
  type AiUsageView,
} from './api';

/** ברירות מחדל — הדגמים המתקדמים בכל ספק */
const DEFAULT_MODEL: Record<AiProvider, string> = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-5.1',
};

export function AiPanel(props: {
  onConfigured: (configured: boolean) => void;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<AiSettingsView | null>(null);
  const [provider, setProvider] = useState<AiProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL.anthropic);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [budget, setBudget] = useState<number | ''>('');
  const [usage, setUsage] = useState<AiUsageView | null>(null);

  useEffect(() => {
    getAiSettings()
      .then((s) => {
        if (s) {
          setSettings(s);
          setProvider(s.provider);
          setModel(s.model);
          setBudget(s.monthlyBudgetUsd ?? '');
          props.onConfigured(true);
        }
      })
      .catch(() => {});
    getAiUsage().then(setUsage).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeProvider(p: AiProvider) {
    setProvider(p);
    setModel(settings?.provider === p ? settings.model : DEFAULT_MODEL[p]);
    setModels([]);
    setStatus(null);
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const saved = await saveAiSettings({
        provider,
        apiKey: apiKey || undefined,
        model,
        monthlyBudgetUsd: budget === '' ? null : budget,
      });
      setSettings(saved);
      setApiKey('');
      props.onConfigured(true);
      setStatus('נשמר ✓');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    setBusy(true);
    setError(null);
    setStatus('בודק חיבור…');
    try {
      // מפתח חדש שהוקלד ולא נשמר — נשמר אוטומטית לפני הבדיקה
      if (apiKey) {
        const saved = await saveAiSettings({ provider, apiKey, model });
        setSettings(saved);
        setApiKey('');
        props.onConfigured(true);
      }
      const list = await getAiModels();
      setModels(list);
      setStatus(`מחובר ✓ — ${list.length} מודלים זמינים`);
    } catch (e) {
      setStatus(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card ai-panel">
      <div className="ai-panel-head">
        <h2 className="card-title">הגדרות AI — ניתוח והמלצות חכמות</h2>
        <button className="remove-btn" onClick={props.onClose} title="סגור">
          ✕
        </button>
      </div>

      <div className="assumptions-grid">
        <label className="field">
          <span>ספק AI</span>
          <select
            className="field-select"
            value={provider}
            onChange={(e) => changeProvider(e.target.value as AiProvider)}
          >
            <option value="anthropic">Claude (Anthropic)</option>
            <option value="openai">ChatGPT (OpenAI)</option>
          </select>
        </label>

        <label className="field">
          <span>
            מפתח API{' '}
            {settings?.keyMask && <em className="key-mask">(שמור: {settings.keyMask})</em>}
          </span>
          <input
            type="password"
            dir="ltr"
            placeholder={settings?.hasKey ? 'להשארת המפתח הקיים — השאר ריק' : 'sk-...'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>מודל</span>
          {models.length > 0 ? (
            <select
              className="field-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              dir="ltr"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          )}
        </label>

        <label className="field">
          <span className="field-label">
            תקציב חודשי ($)
            <span
              className="tip"
              data-tip="תקרת הוצאה חודשית מוערכת לקריאות ה-AI. בהגעה ל-100% הקריאות נחסמות עד תחילת החודש הבא. ריק = ללא הגבלה. האומדן לפי מחירוני הספקים — לא חיוב בפועל."
              tabIndex={0}
            >
              ⓘ
            </span>
          </span>
          <input
            type="number"
            dir="ltr"
            min={0}
            step={1}
            placeholder="ללא הגבלה"
            value={budget}
            onChange={(e) =>
              setBudget(e.target.value === '' ? '' : Number(e.target.value))
            }
          />
        </label>
      </div>

      {usage && (
        <div className="ai-usage">
          <div className="ai-usage-head">
            <span>
              שימוש החודש: <strong>${usage.monthCostUsd.toFixed(2)}</strong>
              {usage.budgetUsd !== null && <> מתוך ${usage.budgetUsd}</>}
              {' · '}
              {(usage.monthInputTokens + usage.monthOutputTokens).toLocaleString('he-IL')}{' '}
              טוקנים
            </span>
            {usage.usagePct !== null && (
              <span
                className={`ai-usage-pct ${
                  usage.usagePct >= 100 ? 'over' : usage.usagePct >= 80 ? 'warn' : ''
                }`}
              >
                {usage.usagePct}%
              </span>
            )}
          </div>
          {usage.usagePct !== null && (
            <div className="ai-usage-bar">
              <div
                className={`ai-usage-fill ${
                  usage.usagePct >= 100 ? 'over' : usage.usagePct >= 80 ? 'warn' : ''
                }`}
                style={{ width: `${Math.min(100, usage.usagePct)}%` }}
              />
            </div>
          )}
          {usage.entries.length > 0 && (
            <details className="ai-usage-log">
              <summary>יומן הקריאות האחרון ({usage.entries.length})</summary>
              <ul>
                {usage.entries.map((e, i) => (
                  <li key={i}>
                    {new Date(e.createdAt).toLocaleString('he-IL', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {e.capability} · {e.model} ·{' '}
                    {(e.inputTokens + e.outputTokens).toLocaleString('he-IL')} טוקנים · $
                    {e.costUsd.toFixed(4)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="ai-panel-actions">
        <button className="calc-btn ai-save" onClick={onSave} disabled={busy}>
          שמור הגדרות
        </button>
        <button
          className="save-btn"
          onClick={onTest}
          disabled={busy || (!settings?.hasKey && !apiKey)}
          title="שומר תחילה אם הוזן מפתח חדש"
        >
          בדוק חיבור וטען מודלים
        </button>
        {status && <span className="ai-status good">{status}</span>}
        {error && <div className="error">{error}</div>}
      </div>

      <p className="hint">
        המפתח נשמר מוצפן (AES-256) במסד המקומי שלך ואינו נשלח לשום מקום מלבד ספק ה-AI
        שבחרת. הנתונים שנשלחים לניתוח: נתוני התיק והתחזיות — ללא שם, אימייל או ת&quot;ז.
      </p>
    </section>
  );
}
