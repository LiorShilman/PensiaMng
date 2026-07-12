import { useState } from 'react';
import { calcDecumulation, UnauthorizedError, type DecumulationResult } from './api';
import { IconSunset } from './icons';

/**
 * משיכה הדרגתית בפרישה (Decumulation) — ניהול ההון הנזיל לצד הקצבה:
 * כמה אפשר למשוך בבטחה עד גיל היעד, ומתי ההון אוזל בקצב מבוקש.
 */

interface Props {
  /** ההון הנזיל הצפוי בפרישה (מהתחזית המרכזית) */
  defaultCapital: number;
  retirementAge: number;
  onUnauthorized: () => void;
  onResult?: (r: DecumulationResult) => void;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

export function Decumulation(props: Props) {
  const [open, setOpen] = useState(false);
  const [capital, setCapital] = useState(Math.round(props.defaultCapital));
  const [withdrawal, setWithdrawal] = useState(0);
  const [targetAge, setTargetAge] = useState(90);
  const [returnPct, setReturnPct] = useState(2.5);
  const [result, setResult] = useState<DecumulationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCalc() {
    setBusy(true);
    setError(null);
    try {
      const r = await calcDecumulation({
        capitalAtRetirement: capital,
        retirementAge: props.retirementAge,
        annualReturnPct: returnPct,
        monthlyWithdrawal: withdrawal > 0 ? withdrawal : undefined,
        targetAge,
      });
      setResult(r);
      props.onResult?.(r);
    } catch (e) {
      if (e instanceof UnauthorizedError) return props.onUnauthorized();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="results fixation-section">
      <div
        className={`whatif-head acc-head ${open ? 'open' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <h2 className="results-title">
          {IconSunset}
          משיכה הדרגתית בפרישה — כמה זמן יחזיק ההון הנזיל?
          <span
            className="tip"
            data-tip="ההון הנזיל (השתלמות, גמל להשקעה, IRA) משלים את הקצבה בפרישה. המחשבון מראה כמה אפשר למשוך בכל חודש כך שההון יחזיק עד גיל היעד — ומתי הוא אוזל אם מושכים יותר."
            tabIndex={0}
          >
            ⓘ
          </span>
        </h2>
        <span className="acc-indicator" aria-hidden="true">
          ▾
        </span>
      </div>

      {open && (
        <div className="card fixation-card">
          <div className="fixation-form">
            <label className="field">
              <span className="field-label">הון נזיל בפרישה</span>
              <div className="input-wrap has-unit">
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={capital === 0 ? '' : capital.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setCapital(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">
                משיכה חודשית מבוקשת
                <span
                  className="tip"
                  data-tip="ריק = בדוק את המשיכה בת-הקיימא (זו שמחזיקה בדיוק עד גיל היעד)."
                  tabIndex={0}
                >
                  ⓘ
                </span>
              </span>
              <div className="input-wrap has-unit">
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="אוטומטי"
                  value={withdrawal === 0 ? '' : withdrawal.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setWithdrawal(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">ההון צריך להחזיק עד גיל</span>
              <input
                type="number"
                min={props.retirementAge + 1}
                max={110}
                value={targetAge}
                onChange={(e) => setTargetAge(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span className="field-label">
                תשואה ריאלית בפרישה
                <span
                  className="tip"
                  data-tip="בפרישה נהוג להשקיע שמרני יותר — 1.5%–3% ריאלי הוא טווח סביר."
                  tabIndex={0}
                >
                  ⓘ
                </span>
              </span>
              <div className="input-wrap has-unit">
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={6}
                  value={returnPct}
                  onChange={(e) => setReturnPct(Number(e.target.value))}
                />
                <span className="unit">%</span>
              </div>
            </label>
          </div>

          <button className="calc-btn fixation-calc" onClick={onCalc} disabled={busy}>
            {busy ? 'מחשב…' : 'חשב תוכנית משיכה'}
          </button>
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className="fixation-summary">
                {result.sustainableMonthly !== null && (
                  <div className="scenario-stat">
                    <div className="stat-value good">
                      {nis(result.sustainableMonthly)}
                    </div>
                    <div className="stat-label">
                      משיכה חודשית בת-קיימא — מחזיקה עד גיל {result.targetAge}
                    </div>
                  </div>
                )}
                <div className="scenario-stat">
                  <div
                    className={`stat-value ${
                      result.depletionAge !== null && result.depletionAge < result.targetAge
                        ? 'excess'
                        : 'good'
                    }`}
                  >
                    {result.depletionAge !== null ? `גיל ${result.depletionAge}` : 'לא אוזל'}
                  </div>
                  <div className="stat-label">מתי ההון אוזל בקצב שנבדק</div>
                </div>
                <div className="scenario-stat">
                  <div className="stat-value">{nis(result.totalWithdrawn)}</div>
                  <div className="stat-label">סך המשיכות לאורך הדרך</div>
                </div>
              </div>

              {result.warnings.length > 0 && (
                <div className="warnings">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="warning-item">⚠ {w}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
