import { useEffect, useState } from 'react';
import {
  calcSimulatedPension,
  UnauthorizedError,
  type SimPensionFormInput,
  type SimulatedPensionResult,
} from './api';
import { IconHourglass } from './icons';

/**
 * פרישה מדומה — הפעלת קצבה מגיל 60 תוך המשך עבודה.
 * המנוע משווה הפעלה מוקדמת מול המתנה לגיל החוקי ומחשב נקודת איזון.
 */

interface Props {
  /** גיל נוכחי (מתאריך הלידה) */
  currentAge: number;
  /** גיל הפרישה החוקי */
  legalRetirementAge: number;
  /** צבירה נוכחית במוצרים הקצבתיים — ברירת מחדל לסכום ההפעלה */
  defaultBalance: number;
  /** הפקדה חודשית כוללת למוצרים הקצבתיים */
  defaultMonthlyDeposit: number;
  /** הנחת התשואה של התיק */
  defaultReturnPct: number;
  onUnauthorized: () => void;
  onResult?: (r: SimulatedPensionResult) => void;
  /** קלט שמור מהתיק — משחזר את הטופס אחרי התחברות מחדש */
  initial?: SimPensionFormInput;
  /** מדווח ל-App על שינוי קלט — נשמר עם התיק בלחיצת "שמור" */
  onInput?: (s: SimPensionFormInput) => void;
  /** תוצאה שמורה מהחישוב האחרון — הפאנל נפתח אוטומטית ומציג אותה במקום להתחיל ריק */
  initialResult?: SimulatedPensionResult;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

export function SimulatedPension(props: Props) {
  const [open, setOpen] = useState(!!props.initialResult);
  const [startAge, setStartAge] = useState(
    props.initial?.startAge ?? Math.max(60, Math.ceil(props.currentAge)),
  );
  const [balance, setBalance] = useState(
    props.initial?.balance ?? Math.round(props.defaultBalance),
  );
  const [deposit, setDeposit] = useState(
    props.initial?.deposit ?? Math.round(props.defaultMonthlyDeposit),
  );
  const [factorStart, setFactorStart] = useState(props.initial?.factorStart ?? 200);
  const [factorLegal, setFactorLegal] = useState(props.initial?.factorLegal ?? 185);
  const [taxRate, setTaxRate] = useState(props.initial?.taxRate ?? 35);

  // דיווח קלט ל-App — נשמר עם התיק בלחיצת "שמור תיק"
  useEffect(() => {
    props.onInput?.({ startAge, balance, deposit, factorStart, factorLegal, taxRate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAge, balance, deposit, factorStart, factorLegal, taxRate]);

  const [result, setResult] = useState<SimulatedPensionResult | null>(
    props.initialResult ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCalc() {
    setBusy(true);
    setError(null);
    try {
      const r = await calcSimulatedPension({
        currentAge: props.currentAge,
        startAge,
        legalRetirementAge: props.legalRetirementAge,
        balanceNow: balance,
        monthlyDeposit: deposit,
        annualReturnPct: props.defaultReturnPct,
        conversionFactorAtStart: factorStart,
        conversionFactorAtLegal: factorLegal,
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
    <section className="results fixation-section" data-tour="simpension-section">
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
          {IconHourglass}
          פרישה מדומה — קצבה מגיל 60 תוך המשך עבודה
          <span
            className="tip"
            data-tip="מגיל 60 ניתן להפעיל קצבה מהחיסכון הפנסיוני גם בלי להפסיק לעבוד. הקצבה מתווספת לשכר וחייבת במס שולי, אבל פטורה מדמי ביטוח לאומי. המחיר: מקדם המרה גרוע יותר וקצבה קטנה יותר לכל החיים. הסימולציה משווה ומחשבת את גיל נקודת האיזון."
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
              <span className="field-label">גיל הפעלת הקצבה</span>
              <input
                type="number"
                min={60}
                max={Math.floor(props.legalRetirementAge) - 1}
                value={startAge}
                onChange={(e) => setStartAge(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span className="field-label">
                צבירה להפעלה
                <span
                  className="tip"
                  data-tip="הצבירה במוצרים הקצבתיים שתפעיל מוקדם. ברירת המחדל: סך הצבירה הקצבתית בתיק — אפשר להפעיל גם חלק."
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
                  value={balance === 0 ? '' : balance.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setBalance(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">הפקדה חודשית (עד ההפעלה)</span>
              <div className="input-wrap has-unit">
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={deposit === 0 ? '' : deposit.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setDeposit(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">
                מקדם בגיל ההפעלה
                <span
                  className="tip"
                  data-tip="מקדם ההמרה אם תפעיל את הקצבה בגיל שבחרת — גבוה יותר (גרוע יותר) מהמקדם בגיל החוקי כי הקצבה משולמת יותר שנים. איפה למצוא: תקנון הקרן או שירות הלקוחות."
                  tabIndex={0}
                >
                  ⓘ
                </span>
              </span>
              <input
                type="number"
                step={0.1}
                value={factorStart}
                onChange={(e) => setFactorStart(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span className="field-label">מקדם בגיל החוקי</span>
              <input
                type="number"
                step={0.1}
                value={factorLegal}
                onChange={(e) => setFactorLegal(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span className="field-label">מס שולי בזמן העבודה</span>
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
            {busy ? 'מחשב…' : 'השווה הפעלה מוקדמת מול המתנה'}
          </button>
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className="fixation-scenarios">
                <div className="card fixation-scenario custom">
                  <h4>הפעלה בגיל {startAge} (מדומה)</h4>
                  <dl>
                    <dt>צבירה בהפעלה</dt>
                    <dd>{nis(result.balanceAtStart)}</dd>
                    <dt>קצבה ברוטו לכל החיים</dt>
                    <dd>{nis(result.earlyMonthlyGross)}</dd>
                    <dt>נטו בזמן העבודה (אחרי מס שולי)</dt>
                    <dd>{nis(result.earlyMonthlyNetWhileWorking)}</dd>
                    <dt>סה"כ נטו עד הגיל החוקי</dt>
                    <dd className="good">{nis(result.totalNetDuringWindow)}</dd>
                  </dl>
                </div>
                <div className="card fixation-scenario full_pension">
                  <h4>המתנה לגיל {props.legalRetirementAge}</h4>
                  <dl>
                    <dt>צבירה בגיל החוקי</dt>
                    <dd>{nis(result.balanceAtLegal)}</dd>
                    <dt>קצבה ברוטו לכל החיים</dt>
                    <dd>{nis(result.waitMonthlyGross)}</dd>
                    <dt>יתרון חודשי על ההפעלה המוקדמת</dt>
                    <dd className="good">+{nis(result.monthlyLossAfterLegal)}</dd>
                  </dl>
                </div>
              </div>

              {result.breakEvenAge !== null && (
                <div className="fixation-summary">
                  <div className="scenario-stat">
                    <div className="stat-value">גיל {result.breakEvenAge}</div>
                    <div className="stat-label">
                      נקודת האיזון (ברוטו) — מעבר לגיל זה ההמתנה משתלמת יותר במצטבר
                    </div>
                  </div>
                </div>
              )}

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
