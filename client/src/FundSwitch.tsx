import { useEffect, useState } from 'react';
import {
  calcFundSwitch,
  UnauthorizedError,
  type FundSwitchFormInput,
  type FundSwitchResult,
} from './api';
import { IconRepeat } from './icons';

/**
 * "כדאי לעבור קרן?" — משווה המשך במוצר הנוכחי מול מעבר למוצר מועמד:
 * הפרש צבירה וקצבה בפרישה מדמי ניהול שונים, בתוספת אזהרות על מה שעלול
 * ללכת לאיבוד במעבר (מקדם מובטח, תקופת אכשרה) שאינן חלק מהחישוב הנומרי.
 */

interface Props {
  defaultBalance: number;
  defaultMonthlyDeposit: number;
  defaultReturnPct: number;
  defaultSalaryGrowthPct: number;
  months: number;
  currentFeeFromDepositPct: number;
  currentFeeFromBalancePct: number;
  currentConversionFactor?: number;
  onUnauthorized: () => void;
  onResult?: (r: FundSwitchResult) => void;
  initial?: FundSwitchFormInput;
  onInput?: (s: FundSwitchFormInput) => void;
  initialResult?: FundSwitchResult;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

export function FundSwitch(props: Props) {
  const [open, setOpen] = useState(!!props.initialResult);
  const [currentBalance, setCurrentBalance] = useState(
    props.initial?.currentBalance ?? Math.round(props.defaultBalance),
  );
  const [monthlyDeposit, setMonthlyDeposit] = useState(
    props.initial?.monthlyDeposit ?? Math.round(props.defaultMonthlyDeposit),
  );
  const [months, setMonths] = useState(props.initial?.months ?? props.months);
  const [currentFeeDeposit, setCurrentFeeDeposit] = useState(
    props.initial?.current.feeFromDepositPct ?? props.currentFeeFromDepositPct,
  );
  const [currentFeeBalance, setCurrentFeeBalance] = useState(
    props.initial?.current.feeFromBalancePct ?? props.currentFeeFromBalancePct,
  );
  const [currentFactor, setCurrentFactor] = useState(
    props.initial?.current.conversionFactor ?? props.currentConversionFactor ?? 200,
  );
  const [candidateName, setCandidateName] = useState(props.initial?.candidateName ?? 'קרן ברירת מחדל');
  const [candidateFeeDeposit, setCandidateFeeDeposit] = useState(
    props.initial?.candidate.feeFromDepositPct ?? 1,
  );
  const [candidateFeeBalance, setCandidateFeeBalance] = useState(
    props.initial?.candidate.feeFromBalancePct ?? 0.22,
  );
  const [candidateFactor, setCandidateFactor] = useState(
    props.initial?.candidate.conversionFactor ?? props.currentConversionFactor ?? 200,
  );
  const [hasGuaranteedFactor, setHasGuaranteedFactor] = useState(
    props.initial?.currentHasGuaranteedFactor ?? false,
  );
  const [resetsQualifying, setResetsQualifying] = useState(
    props.initial?.resetsQualifyingPeriod ?? false,
  );

  useEffect(() => {
    props.onInput?.({
      currentBalance,
      monthlyDeposit,
      months,
      current: { feeFromDepositPct: currentFeeDeposit, feeFromBalancePct: currentFeeBalance, conversionFactor: currentFactor },
      candidateName,
      candidate: { feeFromDepositPct: candidateFeeDeposit, feeFromBalancePct: candidateFeeBalance, conversionFactor: candidateFactor },
      currentHasGuaranteedFactor: hasGuaranteedFactor,
      resetsQualifyingPeriod: resetsQualifying,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentBalance,
    monthlyDeposit,
    months,
    currentFeeDeposit,
    currentFeeBalance,
    currentFactor,
    candidateName,
    candidateFeeDeposit,
    candidateFeeBalance,
    candidateFactor,
    hasGuaranteedFactor,
    resetsQualifying,
  ]);

  const [result, setResult] = useState<FundSwitchResult | null>(props.initialResult ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCalc() {
    setBusy(true);
    setError(null);
    try {
      const r = await calcFundSwitch({
        currentBalance,
        monthlyDeposit,
        monthlyCoverageCost: 0,
        annualReturnPct: props.defaultReturnPct,
        annualSalaryGrowthPct: props.defaultSalaryGrowthPct,
        months,
        current: { feeFromDepositPct: currentFeeDeposit, feeFromBalancePct: currentFeeBalance, conversionFactor: currentFactor },
        candidateName,
        candidate: { feeFromDepositPct: candidateFeeDeposit, feeFromBalancePct: candidateFeeBalance, conversionFactor: candidateFactor },
        currentHasGuaranteedFactor: hasGuaranteedFactor,
        resetsQualifyingPeriod: resetsQualifying,
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
    <section className="results fixation-section" data-tour="fundswitch-section">
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
          {IconRepeat}
          כדאי לעבור קרן? — השוואת המשך מול מעבר
          <span
            className="tip"
            data-tip="משווה בין המשך בקרן הנוכחית לבין מעבר לקרן מועמדת, לפי דמי ניהול ומקדם המרה. שים לב: המחשבון לא כולל את הסיכונים הנלווים למעבר בפועל (אובדן מקדם מובטח, אכשרה מחדש) — אלה מוצגים כאזהרה נפרדת."
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
              <span className="field-label">צבירה נוכחית</span>
              <div className="input-wrap has-unit">
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={currentBalance === 0 ? '' : currentBalance.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setCurrentBalance(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">הפקדה חודשית</span>
              <div className="input-wrap has-unit">
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={monthlyDeposit === 0 ? '' : monthlyDeposit.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setMonthlyDeposit(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">חודשים עד הפרישה</span>
              <input type="number" min={1} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
            </label>
          </div>

          <div className="transfer-card" style={{ marginBottom: 10 }}>
            <div className="transfer-card-head">
              <span className="bens-label">המוצר הנוכחי</span>
            </div>
            <div className="fixation-form">
              <label className="field">
                <span className="field-label">ד"נ מהפקדה</span>
                <div className="input-wrap has-unit">
                  <input type="number" step={0.01} value={currentFeeDeposit} onChange={(e) => setCurrentFeeDeposit(Number(e.target.value))} />
                  <span className="unit">%</span>
                </div>
              </label>
              <label className="field">
                <span className="field-label">ד"נ מצבירה</span>
                <div className="input-wrap has-unit">
                  <input type="number" step={0.01} value={currentFeeBalance} onChange={(e) => setCurrentFeeBalance(Number(e.target.value))} />
                  <span className="unit">%</span>
                </div>
              </label>
              <label className="field">
                <span className="field-label">מקדם המרה</span>
                <input type="number" step={0.1} value={currentFactor} onChange={(e) => setCurrentFactor(Number(e.target.value))} />
              </label>
            </div>
            <label className="waiver-row" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={hasGuaranteedFactor} onChange={(e) => setHasGuaranteedFactor(e.target.checked)} />
              <span>מקדם ההמרה הנוכחי מובטח (ביטוח מנהלים ישן)</span>
            </label>
          </div>

          <div className="transfer-card" style={{ marginBottom: 10 }}>
            <div className="transfer-card-head">
              <span className="bens-label">המוצר המועמד</span>
            </div>
            <div className="fixation-form">
              <label className="field">
                <span className="field-label">שם המוצר המועמד</span>
                <input type="text" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">ד"נ מהפקדה</span>
                <div className="input-wrap has-unit">
                  <input type="number" step={0.01} value={candidateFeeDeposit} onChange={(e) => setCandidateFeeDeposit(Number(e.target.value))} />
                  <span className="unit">%</span>
                </div>
              </label>
              <label className="field">
                <span className="field-label">ד"נ מצבירה</span>
                <div className="input-wrap has-unit">
                  <input type="number" step={0.01} value={candidateFeeBalance} onChange={(e) => setCandidateFeeBalance(Number(e.target.value))} />
                  <span className="unit">%</span>
                </div>
              </label>
              <label className="field">
                <span className="field-label">מקדם המרה</span>
                <input type="number" step={0.1} value={candidateFactor} onChange={(e) => setCandidateFactor(Number(e.target.value))} />
              </label>
            </div>
            <label className="waiver-row" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={resetsQualifying} onChange={(e) => setResetsQualifying(e.target.checked)} />
              <span>המעבר הוא לגוף מנהל אחר (לא רק שינוי מסלול) — עלול לאפס תקופת אכשרה</span>
            </label>
          </div>

          <button className="calc-btn fixation-calc" onClick={onCalc} disabled={busy}>
            {busy ? 'משווה…' : 'השווה נשארים מול מעבר'}
          </button>
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className="fixation-summary">
                <div className="scenario-stat">
                  <div className="stat-value">{nis(result.currentBalanceAtRetirement)}</div>
                  <div className="stat-label">צבירה בפרישה — נשארים במוצר הנוכחי</div>
                </div>
                <div className="scenario-stat">
                  <div className="stat-value">{nis(result.candidateBalanceAtRetirement)}</div>
                  <div className="stat-label">צבירה בפרישה — עוברים ל{candidateName}</div>
                </div>
                <div className="scenario-stat">
                  <div className={`stat-value ${result.balanceGap >= 0 ? 'good' : 'excess'}`}>
                    {result.balanceGap >= 0 ? '+' : ''}
                    {nis(result.balanceGap)}
                  </div>
                  <div className="stat-label">הפרש צבירה מהמעבר</div>
                </div>
              </div>

              {result.annuityGap !== null && (
                <div className="fixation-summary" style={{ marginTop: 12 }}>
                  <div className="scenario-stat">
                    <div className={`stat-value ${result.annuityGap >= 0 ? 'good' : 'excess'}`}>
                      {result.annuityGap >= 0 ? '+' : ''}
                      {nis(result.annuityGap)}
                    </div>
                    <div className="stat-label">הפרש קצבה חודשית מהמעבר</div>
                  </div>
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
