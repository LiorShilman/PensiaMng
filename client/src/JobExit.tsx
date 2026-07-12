import { useState } from 'react';
import { calcJobExit, UnauthorizedError, type JobExitResult } from './api';
import { IconDoorOpen } from './icons';

/**
 * עזיבת עבודה (מפרט 5.4) — משיכת רכיב הפיצויים היום מול השארתו
 * ברצף קצבה. מציג את שלושת מחירי המשיכה: מס, אובדן קצבה, פגיעה בקיבוע.
 */

interface Props {
  /** שכר מבוטח מהפרופיל — ברירת מחדל לשכר האחרון */
  defaultSalary: number;
  yearsToRetirement: number;
  defaultReturnPct: number;
  onUnauthorized: () => void;
  onResult?: (r: JobExitResult) => void;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

export function JobExit(props: Props) {
  const [open, setOpen] = useState(false);
  const [severance, setSeverance] = useState(0);
  const [years, setYears] = useState(10);
  const [salary, setSalary] = useState(Math.round(props.defaultSalary));
  const [factor, setFactor] = useState(200);
  const [taxRate, setTaxRate] = useState(35);
  const [result, setResult] = useState<JobExitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCalc() {
    setBusy(true);
    setError(null);
    try {
      const r = await calcJobExit({
        severanceBalance: severance,
        yearsOfService: years,
        lastMonthlySalary: salary,
        yearsToRetirement: props.yearsToRetirement,
        annualReturnPct: props.defaultReturnPct,
        conversionFactor: factor,
        marginalTaxRatePct: taxRate,
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
    <section className="results fixation-section" data-tour="jobexit-section">
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
          {IconDoorOpen}
          עזיבת עבודה — למשוך פיצויים או להשאיר?
          <span
            className="tip"
            data-tip="בעזיבת עבודה מתפנה רכיב הפיצויים. משיכה נותנת כסף נזיל היום — אבל עולה שלושה מחירים: מס על החלק שמעל התקרה, אובדן עד ~40% מהקצבה העתידית, ופגיעה בפטור ממס בפרישה (נוסחת הקיזוז ×1.35). רצף קצבה (ברירת המחדל) שומר הכל."
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
              <span className="field-label">
                יתרת רכיב הפיצויים
                <span
                  className="tip"
                  data-tip='הרכיב "פיצויים" בדוח השנתי של הקרן — לא כל הצבירה. מופיע בפירוט היתרות.'
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
                  value={severance === 0 ? '' : severance.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setSeverance(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">שנות ותק אצל המעסיק</span>
              <input
                type="number"
                min={1}
                max={50}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span className="field-label">שכר חודשי אחרון (ברוטו)</span>
              <div className="input-wrap has-unit">
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={salary === 0 ? '' : salary.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setSalary(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">מקדם המרה בפרישה</span>
              <input
                type="number"
                step={0.1}
                value={factor}
                onChange={(e) => setFactor(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span className="field-label">מס שולי</span>
              <div className="input-wrap has-unit">
                <input
                  type="number"
                  min={10}
                  max={50}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                />
                <span className="unit">%</span>
              </div>
            </label>
          </div>

          <button className="calc-btn fixation-calc" onClick={onCalc} disabled={busy}>
            {busy ? 'מחשב…' : 'השווה משיכה מול רצף קצבה'}
          </button>
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className="fixation-scenarios">
                <div className="card fixation-scenario max_lump_sum">
                  <h4>משיכה היום</h4>
                  <dl>
                    <dt>חלק פטור ממס</dt>
                    <dd>{nis(result.exemptAmount)}</dd>
                    <dt>חלק חייב במס</dt>
                    <dd>{nis(result.taxableAmount)}</dd>
                    <dt>מס מוערך</dt>
                    <dd>−{nis(result.taxOnTaxable)}</dd>
                    <dt>נטו ביד</dt>
                    <dd className="good">{nis(result.netToday)}</dd>
                  </dl>
                </div>
                <div className="card fixation-scenario full_pension">
                  <h4>רצף קצבה (השארה)</h4>
                  <dl>
                    <dt>צבירה בפרישה</dt>
                    <dd>{nis(result.balanceAtRetirement)}</dd>
                    <dt>תוספת קצבה חודשית</dt>
                    <dd className="good">+{nis(result.monthlyAnnuityLoss)}</dd>
                    <dt>הפטור בקיבוע נשמר</dt>
                    <dd className="good">+{nis(result.kibuaMonthlyExemptionLoss)}/ח'</dd>
                  </dl>
                </div>
              </div>

              <div className="fixation-summary">
                <div className="scenario-stat">
                  <div className="stat-value excess">
                    −{nis(result.monthlyAnnuityLoss)}
                  </div>
                  <div className="stat-label">קצבה חודשית שנמחקת במשיכה — לכל החיים</div>
                </div>
                <div className="scenario-stat">
                  <div className="stat-value excess">
                    −{nis(result.kibuaExemptCapitalLoss)}
                  </div>
                  <div className="stat-label">
                    פגיעה בהון הפטור בקיבוע הזכויות (×1.35)
                  </div>
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
