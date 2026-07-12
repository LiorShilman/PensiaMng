import { useEffect, useState } from 'react';
import {
  calcTaxBenefits,
  UnauthorizedError,
  type TaxBenefitsResult,
  type TaxFormInput,
} from './api';
import { IconCoins } from './icons';

/**
 * הטבות מס בהפקדה (מפרט 6.1) — "כמה מס חסכת השנה וכמה נשאר לנצל".
 * המנוע מחשב; המסך מציג. כלי המחשה — לא ייעוץ מס.
 */

interface Props {
  /** ברירת מחדל מהשכר המבוטח בפרופיל */
  defaultMonthlyIncome: number;
  onUnauthorized: () => void;
  onResult?: (r: TaxBenefitsResult) => void;
  /** קלט שמור מהתיק — משחזר את הטופס אחרי התחברות מחדש */
  initial?: TaxFormInput;
  /** מדווח ל-App על שינוי קלט — נשמר עם התיק בלחיצת "שמור" */
  onInput?: (s: TaxFormInput) => void;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

export function TaxBenefits(props: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'EMPLOYEE' | 'SELF_EMPLOYED'>(
    props.initial?.status ?? 'EMPLOYEE',
  );
  const [income, setIncome] = useState(
    props.initial?.income ?? Math.round(props.defaultMonthlyIncome),
  );
  const [deposits, setDeposits] = useState(props.initial?.deposits ?? 0);
  const [taxRate, setTaxRate] = useState(props.initial?.taxRate ?? 35);

  // דיווח קלט ל-App — נשמר עם התיק בלחיצת "שמור תיק"
  useEffect(() => {
    props.onInput?.({ status, income, deposits, taxRate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, income, deposits, taxRate]);
  const [result, setResult] = useState<TaxBenefitsResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  async function onCalc() {
    setBusy(true);
    setError(null);
    try {
      const r = await calcTaxBenefits({
        employmentStatus: status,
        monthlyIncome: income,
        annualOwnDeposits: deposits,
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
          {IconCoins}
          הטבות מס בהפקדה — כמה חסכת השנה?
          <span
            className="tip"
            data-tip="הפקדות לפנסיה מזכות בהטבות מס: שכיר מקבל זיכוי של 35% על הפקדותיו (עד 7% מההכנסה המזכה); עצמאי משלב זיכוי וניכוי. המחשבון מראה כמה חסכת וכמה עוד אפשר לנצל עד סוף שנת המס."
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
              <span className="field-label">מעמד</span>
              <select
                className="field-select"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'EMPLOYEE' | 'SELF_EMPLOYED')
                }
              >
                <option value="EMPLOYEE">שכיר</option>
                <option value="SELF_EMPLOYED">עצמאי</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">
                {status === 'EMPLOYEE' ? 'שכר ברוטו חודשי' : 'הכנסה חודשית ממוצעת'}
              </span>
              <div className="input-wrap has-unit">
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={income === 0 ? '' : income.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setIncome(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">
                {status === 'EMPLOYEE'
                  ? 'הפקדות עובד שנתיות (תגמולי עובד)'
                  : 'הפקדות שנתיות לפנסיה/גמל'}
                <span
                  className="tip"
                  data-tip={
                    status === 'EMPLOYEE'
                      ? 'רק החלק שאתה מפקיד לפנסיה/גמל/ביטוח מנהלים (בדרך כלל 6-7% מהשכר) — לא חלק המעסיק, ולא קרן השתלמות (לה מסלול הטבה נפרד: הפקדת המעסיק פטורה משווי והרווחים פטורים ממס — ללא זיכוי על חלק העובד). איפה למצוא: תלוש השכר, שורת "תגמולי עובד".'
                      : 'סך ההפקדות שהפקדת השנה לקופת גמל / קרן פנסיה כעצמאי — לא כולל קרן השתלמות (ניכוי ההשתלמות לעצמאי יתווסף בשלב הבא).'
                  }
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
                  value={deposits === 0 ? '' : deposits.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setDeposits(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            {status === 'SELF_EMPLOYED' && (
              <label className="field">
                <span className="field-label">
                  מס שולי
                  <span
                    className="tip"
                    data-tip="שיעור המס על השקל האחרון של הכנסתך — קובע את שווי הניכוי. מדרגות 2025: 31% מ-~21.7 אלף לחודש, 35% מ-~45 אלף, 47% מעל ~58 אלף."
                    tabIndex={0}
                  >
                    ⓘ
                  </span>
                </span>
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
            )}
          </div>

          <p className="hint tax-hint">
            המחשבון מתייחס להפקדות <strong>קצבתיות בלבד</strong> (פנסיה, גמל, ביטוח
            מנהלים). קרן השתלמות אינה נכללת — לה מסלול הטבה נפרד: הפקדת המעסיק פטורה
            ממס בידיך (עד שכר 15,712 ₪) והרווחים פטורים ממס רווח הון; על הפקדת העובד
            אין זיכוי. ניכוי השתלמות לעצמאי — יתווסף בשלב הבא.
          </p>

          <button className="calc-btn fixation-calc" onClick={onCalc} disabled={busy}>
            {busy ? 'מחשב…' : 'חשב הטבות מס'}
          </button>
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className="fixation-summary">
                <div className="scenario-stat">
                  <div className="stat-value good">{nis(result.totalAnnualSaving)}</div>
                  <div className="stat-label">
                    חיסכון המס השנתי שלך
                    {result.deductionValue > 0 &&
                      ` (זיכוי ${nis(result.taxCredit)} + ניכוי ${nis(result.deductionValue)})`}
                  </div>
                </div>
                <div className="scenario-stat">
                  <div className="stat-value">{nis(result.remainingDepositAllowance)}</div>
                  <div className="stat-label">תקרה שנותרה לניצול השנה</div>
                </div>
                {result.potentialExtraSaving > 0 && (
                  <div className="scenario-stat">
                    <div className="stat-value ni">
                      +{nis(result.potentialExtraSaving)}
                    </div>
                    <div className="stat-label">חיסכון מס נוסף אם תנצל את המלוא</div>
                  </div>
                )}
              </div>

              <button className="trace-toggle" onClick={() => setShowSteps(!showSteps)}>
                {showSteps ? 'הסתר את החישוב' : 'איך חושב? — צעד אחר צעד'}
              </button>

              {showSteps && (
                <ol className="calc-steps">
                  {status === 'EMPLOYEE' ? (
                    <>
                      <li>
                        <strong>ההכנסה המזכה:</strong>{' '}
                        {income > result.params.qualifyingIncomeEmployeeMonthly ? (
                          <>
                            השכר שלך ({nis(income)}) גבוה מתקרת ההכנסה המזכה (
                            {nis(result.params.qualifyingIncomeEmployeeMonthly)}/חודש) —
                            ההטבה מחושבת עד התקרה בלבד:{' '}
                            {nis(result.params.qualifyingIncomeEmployeeMonthly)} × 12 ={' '}
                            <strong>{nis(result.qualifyingIncomeAnnual)}</strong> בשנה
                          </>
                        ) : (
                          <>
                            {nis(income)} × 12 ={' '}
                            <strong>{nis(result.qualifyingIncomeAnnual)}</strong> בשנה
                            (מתחת לתקרה — כל השכר מזכה)
                          </>
                        )}
                      </li>
                      <li>
                        <strong>תקרת ההפקדה שמזכה בהטבה:</strong>{' '}
                        {result.params.employeeCreditDepositPct}% ×{' '}
                        {nis(result.qualifyingIncomeAnnual)} ={' '}
                        <strong>{nis(result.maxBenefitedDeposits)}</strong> בשנה
                      </li>
                      <li>
                        <strong>ההפקדות שלך:</strong> {nis(deposits)}
                        {result.benefitedDeposits < deposits ? (
                          <>
                            {' '}
                            — אבל רק <strong>{nis(result.benefitedDeposits)}</strong>{' '}
                            מתוכן מזכות (השאר מעל התקרה, ללא הטבה במסלול זה)
                          </>
                        ) : (
                          <> — כולן בתוך התקרה ומזכות</>
                        )}
                      </li>
                      <li>
                        <strong>הזיכוי:</strong> {result.params.creditRatePct}% ×{' '}
                        {nis(result.benefitedDeposits)} ={' '}
                        <strong className="good-text">{nis(result.taxCredit)}</strong>{' '}
                        לשנה — מגולם אוטומטית בחישוב המס בתלוש
                      </li>
                    </>
                  ) : (
                    <>
                      <li>
                        <strong>ההכנסה המזכה:</strong> ההכנסה השנתית (
                        {nis(income * 12)}) עד התקרה (
                        {nis(result.params.qualifyingIncomeSelfAnnual)}) ={' '}
                        <strong>{nis(result.qualifyingIncomeAnnual)}</strong>
                      </li>
                      <li>
                        <strong>מסלול הזיכוי:</strong> {result.params.creditRatePct}% על
                        הפקדות עד {result.params.selfCreditPct}% מההכנסה המזכה →{' '}
                        <strong className="good-text">{nis(result.taxCredit)}</strong>
                      </li>
                      <li>
                        <strong>מסלול הניכוי:</strong> הפקדות נוספות עד{' '}
                        {result.params.selfDeductionPct}% מקטינות את ההכנסה החייבת —
                        שווי לפי המס השולי ({taxRate}%) →{' '}
                        <strong className="good-text">{nis(result.deductionValue)}</strong>
                      </li>
                      <li>
                        <strong>סה"כ חיסכון שנתי:</strong>{' '}
                        <strong className="good-text">
                          {nis(result.totalAnnualSaving)}
                        </strong>{' '}
                        — נדרש דיווח בדוח השנתי למס הכנסה
                      </li>
                    </>
                  )}
                </ol>
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
