import { useState } from 'react';
import {
  calcLifePath,
  UnauthorizedError,
  type LifePathEvent,
  type LifePathEventType,
  type LifePathResult,
} from './api';
import { IconMilestones } from './icons';

/**
 * סימולטור מסלול חיים — לא עוד מחשבון בודד לתרחיש אחד, אלא ציר זמן
 * שמריץ רצף אירועי חיים (עזיבת עבודה, אבטלה, חופשת לידה, שינוי שכר)
 * על התיק *האמיתי* של המשתמש עד הפרישה, ומשווה לתחזית ללא האירועים.
 */

interface Props {
  defaultBalance: number;
  defaultMonthlyDeposit: number;
  feeFromDepositPct: number;
  feeFromBalancePct: number;
  defaultReturnPct: number;
  defaultSalaryGrowthPct: number;
  /** חודשים עד הפרישה */
  months: number;
  conversionFactor: number;
  onUnauthorized: () => void;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

const EVENT_LABELS: Record<LifePathEventType, string> = {
  JOB_EXIT_WITHDRAW: 'עזיבת עבודה — משיכת פיצויים',
  UNEMPLOYMENT_GAP: 'תקופת אבטלה',
  PARENTAL_LEAVE: 'חופשת לידה',
  SALARY_CHANGE: 'שינוי שכר / הפקדה',
};

let idCounter = 0;
const nextId = () => `lp-event-${++idCounter}-${Date.now()}`;

function newEvent(type: LifePathEventType): LifePathEvent {
  switch (type) {
    case 'JOB_EXIT_WITHDRAW':
      return {
        id: nextId(),
        type,
        atMonth: 12,
        severanceWithdrawn: 100_000,
        yearsOfServiceAtExit: 5,
        lastMonthlySalaryAtExit: 15_000,
        marginalTaxRatePct: 30,
      };
    case 'UNEMPLOYMENT_GAP':
      return { id: nextId(), type, atMonth: 12, durationMonths: 6, depositDuringPct: 0 };
    case 'PARENTAL_LEAVE':
      return { id: nextId(), type, atMonth: 12, durationMonths: 4, depositDuringPct: 0 };
    case 'SALARY_CHANGE':
      return { id: nextId(), type, atMonth: 12, newMonthlyDeposit: 0 };
  }
}

export function LifePath(props: Props) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<LifePathEvent[]>([]);
  const [result, setResult] = useState<LifePathResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addEvent(type: LifePathEventType) {
    setEvents((es) => [...es, newEvent(type)]);
  }
  function updateEvent(id: string, patch: Partial<LifePathEvent>) {
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function removeEvent(id: string) {
    setEvents((es) => es.filter((e) => e.id !== id));
  }

  async function onCalc() {
    setBusy(true);
    setError(null);
    try {
      const r = await calcLifePath({
        currentBalance: props.defaultBalance,
        monthlyDeposit: props.defaultMonthlyDeposit,
        feeFromDepositPct: props.feeFromDepositPct,
        feeFromBalancePct: props.feeFromBalancePct,
        annualReturnPct: props.defaultReturnPct,
        annualSalaryGrowthPct: props.defaultSalaryGrowthPct,
        months: props.months,
        conversionFactor: props.conversionFactor,
        events,
      });
      setResult(r);
    } catch (e) {
      if (e instanceof UnauthorizedError) return props.onUnauthorized();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="results fixation-section" data-tour="lifepath-section">
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
          {IconMilestones}
          סימולטור מסלול חיים — התיק שלך דרך אירועי חיים אמיתיים
          <span
            className="tip"
            data-tip="במקום מחשבון בודד לתרחיש אחד — מוסיפים אירועי חיים (עזיבת עבודה, אבטלה, חופשת לידה, שינוי שכר) על ציר הזמן עד הפרישה, והמערכת מריצה את התיק שלכם — לא דוגמה גנרית — דרך הרצף המדויק הזה ומשווה לתחזית הרגילה."
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
          {events.length === 0 && (
            <p className="hint">אין עדיין אירועים על הציר. הוסיפו אחד מהכפתורים למטה.</p>
          )}

          {events.map((ev) => (
            <div key={ev.id} className="transfer-card" style={{ marginBottom: 10 }}>
              <div className="transfer-card-head">
                <span className="bens-label">{EVENT_LABELS[ev.type]}</span>
                <button
                  className="remove-btn"
                  onClick={() => removeEvent(ev.id)}
                  title="הסר אירוע"
                >
                  ✕
                </button>
              </div>
              <div className="fixation-form">
                <label className="field">
                  <span className="field-label">בעוד כמה חודשים מהיום</span>
                  <input
                    type="number"
                    min={0}
                    max={props.months}
                    value={ev.atMonth}
                    onChange={(e) => updateEvent(ev.id, { atMonth: Number(e.target.value) })}
                  />
                </label>

                {ev.type === 'JOB_EXIT_WITHDRAW' && (
                  <>
                    <label className="field">
                      <span className="field-label">סכום פיצויים שנמשך</span>
                      <div className="input-wrap has-unit">
                        <input
                          type="number"
                          min={0}
                          value={ev.severanceWithdrawn ?? 0}
                          onChange={(e) =>
                            updateEvent(ev.id, { severanceWithdrawn: Number(e.target.value) })
                          }
                        />
                        <span className="unit">₪</span>
                      </div>
                    </label>
                    <label className="field">
                      <span className="field-label">שנות ותק אצל המעסיק</span>
                      <input
                        type="number"
                        min={0}
                        value={ev.yearsOfServiceAtExit ?? 0}
                        onChange={(e) =>
                          updateEvent(ev.id, { yearsOfServiceAtExit: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">שכר חודשי אחרון</span>
                      <div className="input-wrap has-unit">
                        <input
                          type="number"
                          min={0}
                          value={ev.lastMonthlySalaryAtExit ?? 0}
                          onChange={(e) =>
                            updateEvent(ev.id, {
                              lastMonthlySalaryAtExit: Number(e.target.value),
                            })
                          }
                        />
                        <span className="unit">₪</span>
                      </div>
                    </label>
                    <label className="field">
                      <span className="field-label">מס שולי</span>
                      <div className="input-wrap has-unit">
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={ev.marginalTaxRatePct ?? 0}
                          onChange={(e) =>
                            updateEvent(ev.id, { marginalTaxRatePct: Number(e.target.value) })
                          }
                        />
                        <span className="unit">%</span>
                      </div>
                    </label>
                  </>
                )}

                {(ev.type === 'UNEMPLOYMENT_GAP' || ev.type === 'PARENTAL_LEAVE') && (
                  <>
                    <label className="field">
                      <span className="field-label">משך (חודשים)</span>
                      <input
                        type="number"
                        min={1}
                        value={ev.durationMonths ?? 0}
                        onChange={(e) =>
                          updateEvent(ev.id, { durationMonths: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">% הפקדה שממשיך במהלך התקופה</span>
                      <div className="input-wrap has-unit">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={ev.depositDuringPct ?? 0}
                          onChange={(e) =>
                            updateEvent(ev.id, { depositDuringPct: Number(e.target.value) })
                          }
                        />
                        <span className="unit">%</span>
                      </div>
                    </label>
                  </>
                )}

                {ev.type === 'SALARY_CHANGE' && (
                  <label className="field">
                    <span className="field-label">הפקדה חודשית חדשה מרגע זה</span>
                    <div className="input-wrap has-unit">
                      <input
                        type="number"
                        min={0}
                        value={ev.newMonthlyDeposit ?? 0}
                        onChange={(e) =>
                          updateEvent(ev.id, { newMonthlyDeposit: Number(e.target.value) })
                        }
                      />
                      <span className="unit">₪</span>
                    </div>
                  </label>
                )}
              </div>
            </div>
          ))}

          <div className="ai-panel-actions">
            <button className="save-btn" onClick={() => addEvent('JOB_EXIT_WITHDRAW')}>
              + עזיבת עבודה
            </button>
            <button className="save-btn" onClick={() => addEvent('UNEMPLOYMENT_GAP')}>
              + אבטלה
            </button>
            <button className="save-btn" onClick={() => addEvent('PARENTAL_LEAVE')}>
              + חופשת לידה
            </button>
            <button className="save-btn" onClick={() => addEvent('SALARY_CHANGE')}>
              + שינוי שכר
            </button>
          </div>

          <button
            className="calc-btn fixation-calc"
            onClick={onCalc}
            disabled={busy || events.length === 0}
          >
            {busy ? 'מריץ סימולציה…' : 'הרץ סימולציה על התיק שלי'}
          </button>
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className="fixation-summary">
                <div className="scenario-stat">
                  <div className="stat-value">{nis(result.baselineFinalBalance)}</div>
                  <div className="stat-label">צבירה בפרישה — ללא האירועים</div>
                </div>
                <div className="scenario-stat">
                  <div className={`stat-value ${result.totalImpact < 0 ? 'excess' : 'good'}`}>
                    {nis(result.finalBalance)}
                  </div>
                  <div className="stat-label">צבירה בפרישה — עם התרחיש שלך</div>
                </div>
                <div className="scenario-stat">
                  <div className={`stat-value ${result.totalImpact < 0 ? 'excess' : 'good'}`}>
                    {result.totalImpact >= 0 ? '+' : ''}
                    {nis(result.totalImpact)}
                  </div>
                  <div className="stat-label">הפרש כולל בצבירה</div>
                </div>
              </div>

              {result.events.length > 0 && (
                <div className="fixation-scenarios">
                  {result.events.map((ev) => (
                    <div key={ev.id} className="card fixation-scenario custom">
                      <h4>
                        {ev.label} — חודש {ev.monthOccurred}
                      </h4>
                      <p className="fixation-detail">{ev.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {result.warnings.length > 0 && (
                <div className="warnings" style={{ marginTop: 16 }}>
                  {result.warnings.map((w, i) => (
                    <div key={i} className="warning-item">
                      ⚠ {w}
                    </div>
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
