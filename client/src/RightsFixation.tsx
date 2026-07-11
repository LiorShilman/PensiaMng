import { useState } from 'react';
import {
  calcRightsFixation,
  UnauthorizedError,
  type PastGrant,
  type RightsFixationResult,
} from './api';

/**
 * מסך קיבוע זכויות (סעיף 9א / טופס 161ד) — סימולציית ניצול ההון הפטור.
 * המנוע מחשב; המסך משווה תרחישים זה לצד זה. כלי המחשה — לא ייעוץ מס.
 */

interface Props {
  /** שנת הפרישה הצפויה (מחישוב גיל הפרישה) */
  defaultYear: number;
  /** הקצבה החודשית הצפויה מהתחזית (תרחיש מרכזי) */
  defaultMonthlyPension: number;
  onUnauthorized: () => void;
  /** מדווח ל-App על תוצאה חדשה — לניתוח ה-AI ולדוח המודפס */
  onResult?: (r: RightsFixationResult) => void;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

export function RightsFixation(props: Props) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(props.defaultYear);
  const [pension, setPension] = useState(Math.round(props.defaultMonthlyPension));
  const [taxRate, setTaxRate] = useState(20);
  const [lumpSum, setLumpSum] = useState(0);
  const [grants, setGrants] = useState<PastGrant[]>([]);
  const [result, setResult] = useState<RightsFixationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCalc() {
    setBusy(true);
    setError(null);
    try {
      const r = await calcRightsFixation({
        eligibilityYear: year,
        expectedMonthlyPension: pension,
        marginalTaxRatePct: taxRate > 0 ? taxRate : undefined,
        desiredLumpSum: lumpSum > 0 ? lumpSum : undefined,
        pastGrants: grants.filter((g) => g.year > 0 && g.amount > 0),
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

  const setGrant = (i: number, patch: Partial<PastGrant>) =>
    setGrants(grants.map((g, ii) => (ii === i ? { ...g, ...patch } : g)));

  return (
    <section className="results fixation-section">
      <div className="whatif-head">
        <h2 className="results-title">
          📋 קיבוע זכויות — תכנון הפטור ממס בפרישה
          <span
            className="tip"
            data-tip="בגיל הזכאות (פרישה + התחלת קצבה) בוחרים בטופס 161ד איך לנצל את 'ההון הפטור': פטור על הקצבה החודשית, משיכת הון פטורה (היוון), או שילוב. הבחירה חד-פעמית וכמעט בלתי-הפיכה — הסימולציה כאן ממחישה את החלופות לפני הפגישה עם יועץ המס."
            tabIndex={0}
          >
            ⓘ
          </span>
        </h2>
        <button className="calc-btn" onClick={() => setOpen(!open)}>
          {open ? 'סגור' : 'פתח סימולציה'}
        </button>
      </div>

      {open && (
        <div className="card fixation-card">
          <div className="fixation-form">
            <label className="field">
              <span className="field-label">
                שנת גיל הזכאות
                <span
                  className="tip"
                  data-tip="השנה שבה תגיע לגיל הפרישה החוקי ותתחיל לקבל קצבה — קובעת את תקרת הקצבה המזכה ואת אחוז הפטור (67% מ-2025)."
                  tabIndex={0}
                >
                  ⓘ
                </span>
              </span>
              <input
                type="number"
                value={year}
                min={2012}
                max={2075}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span className="field-label">קצבה חודשית צפויה (ברוטו)</span>
              <div className="input-wrap has-unit">
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={pension === 0 ? '' : pension.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setPension(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">
                שיעור מס שולי צפוי
                <span
                  className="tip"
                  data-tip="שיעור המס שתשלם על הקצבה החייבת — להערכת החיסכון הכספי בלבד. רוב הפורשים: 14%–31%."
                  tabIndex={0}
                >
                  ⓘ
                </span>
              </span>
              <div className="input-wrap has-unit">
                <input
                  type="number"
                  value={taxRate}
                  min={0}
                  max={50}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                />
                <span className="unit">%</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">
                היוון פטור מבוקש (לתרחיש שילוב)
                <span
                  className="tip"
                  data-tip="סכום הון שתרצה למשוך בפטור ממס ביום הפרישה — למשל לסגירת משכנתא או עזרה לילדים. 0 = ללא תרחיש שילוב."
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
                  value={lumpSum === 0 ? '' : lumpSum.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setLumpSum(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
          </div>

          <div className="bens fixation-grants">
            <span className="bens-label">
              מענקי פיצויים פטורים שמשכת בעבר
              <span
                className="tip"
                data-tip="פיצויים שמשכת בפטור ממס ב-32 השנים שלפני הפרישה פוגעים בהון הפטור (מוכפלים ב-1.35 בנוסחת הקיזוז). הסכומים צריכים להיות צמודים למדד — מופיעים בטופסי 161 שקיבלת ממעסיקים קודמים."
                tabIndex={0}
              >
                ⓘ
              </span>
            </span>
            {grants.map((g, i) => (
              <span key={i} className="ben-chip">
                <input
                  type="number"
                  className="grant-year"
                  placeholder="שנה"
                  value={g.year || ''}
                  onChange={(e) => setGrant(i, { year: Number(e.target.value) })}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="סכום"
                  value={g.amount === 0 ? '' : g.amount.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setGrant(i, { amount: digits === '' ? 0 : Number(digits) });
                  }}
                />
                <span className="ben-unit">₪</span>
                <button
                  className="chip-remove"
                  title="הסר מענק"
                  onClick={() => setGrants(grants.filter((_, ii) => ii !== i))}
                >
                  ✕
                </button>
              </span>
            ))}
            <button
              className="add-chip small"
              onClick={() => setGrants([...grants, { year: 0, amount: 0 }])}
            >
              + מענק
            </button>
          </div>

          <button className="calc-btn fixation-calc" onClick={onCalc} disabled={busy}>
            {busy ? 'מחשב…' : 'חשב תרחישי קיבוע'}
          </button>
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className="fixation-summary">
                <div className="scenario-stat">
                  <div className="stat-value">{nis(result.exemptCapitalCeiling)}</div>
                  <div className="stat-label">
                    ההון הפטור המלא ({result.params.exemptionPct}% × {nis(result.params.annuityCeilingMonthly)} × {result.params.factor})
                  </div>
                </div>
                {result.grantOffset > 0 && (
                  <div className="scenario-stat">
                    <div className="stat-value excess">−{nis(result.grantOffset)}</div>
                    <div className="stat-label">
                      קיזוז מענקי עבר ({nis(result.countedGrantsTotal)} × {result.params.offsetMultiplier})
                    </div>
                  </div>
                )}
                <div className="scenario-stat">
                  <div className="stat-value good">{nis(result.remainingExemptCapital)}</div>
                  <div className="stat-label">היתרה הפטורה לניצול</div>
                </div>
              </div>

              <div className="fixation-scenarios">
                {result.scenarios.map((s) => (
                  <div key={s.key} className={`card fixation-scenario ${s.key}`}>
                    <h4>{s.label}</h4>
                    <dl>
                      <dt>היוון פטור (הון מיידי)</dt>
                      <dd>{nis(s.lumpSum)}</dd>
                      <dt>פטור חודשי על הקצבה</dt>
                      <dd>{nis(s.monthlyExemption)}</dd>
                      <dt>קצבה חייבת במס</dt>
                      <dd>{nis(s.taxableMonthlyPension)}</dd>
                      {s.estMonthlyTaxSaved !== null && (
                        <>
                          <dt>חיסכון מס חודשי מוערך</dt>
                          <dd className="good">{nis(s.estMonthlyTaxSaved)}</dd>
                        </>
                      )}
                    </dl>
                    <p className="fixation-detail">{s.detail}</p>
                  </div>
                ))}
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
