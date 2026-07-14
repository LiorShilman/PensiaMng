import { useEffect, useState } from 'react';
import {
  calcFundLoan,
  UnauthorizedError,
  type FundLoanFormInput,
  type FundLoanResult,
} from './api';
import { IconHandCoin } from './icons';

/**
 * הלוואה מקרן הפנסיה מול הלוואה חלופית — משווה עלות ריבית כוללת, ובנוסף
 * (אם הסכום המשועבד מפסיק לצבור תשואה) את עלות ההזדמנות של חסימתו.
 */

interface Props {
  defaultReturnPct: number;
  onUnauthorized: () => void;
  onResult?: (r: FundLoanResult) => void;
  initial?: FundLoanFormInput;
  onInput?: (s: FundLoanFormInput) => void;
  initialResult?: FundLoanResult;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

export function FundLoan(props: Props) {
  const [open, setOpen] = useState(!!props.initialResult);
  const [loanAmount, setLoanAmount] = useState(props.initial?.loanAmount ?? 50_000);
  const [months, setMonths] = useState(props.initial?.months ?? 36);
  const [fundRate, setFundRate] = useState(props.initial?.fundLoanAnnualRatePct ?? 4);
  const [altRate, setAltRate] = useState(props.initial?.alternativeAnnualRatePct ?? 7);
  const [collateralFrozen, setCollateralFrozen] = useState(props.initial?.collateralFrozen ?? true);

  useEffect(() => {
    props.onInput?.({
      loanAmount,
      months,
      fundLoanAnnualRatePct: fundRate,
      alternativeAnnualRatePct: altRate,
      collateralFrozen,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanAmount, months, fundRate, altRate, collateralFrozen]);

  const [result, setResult] = useState<FundLoanResult | null>(props.initialResult ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCalc() {
    setBusy(true);
    setError(null);
    try {
      const r = await calcFundLoan({
        loanAmount,
        months,
        fundLoanAnnualRatePct: fundRate,
        alternativeAnnualRatePct: altRate,
        collateralFrozen,
        annualReturnPct: props.defaultReturnPct,
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
    <section className="results fixation-section" data-tour="fundloan-section">
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
          {IconHandCoin}
          הלוואה מקרן הפנסיה — כדאי?
          <span
            className="tip"
            data-tip="לא כל מוצר פנסיוני מאפשר הלוואה — בדוק מול הגוף המנהל. משווה את עלות הריבית הכוללת מול הלוואה חלופית, ובמידה שהסכום המשועבד מפסיק לצבור תשואה בזמן ההלוואה — גם את עלות ההזדמנות הזו."
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
              <span className="field-label">סכום ההלוואה</span>
              <div className="input-wrap has-unit">
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={loanAmount === 0 ? '' : loanAmount.toLocaleString('en-US')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setLoanAmount(digits === '' ? 0 : Number(digits));
                  }}
                />
                <span className="unit">₪</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">תקופת ההלוואה (חודשים)</span>
              <input type="number" min={1} value={months} onChange={(e) => setMonths(Number(e.target.value))} />
            </label>
            <label className="field">
              <span className="field-label">ריבית שנתית — הלוואת הקרן</span>
              <div className="input-wrap has-unit">
                <input type="number" step={0.1} min={0} value={fundRate} onChange={(e) => setFundRate(Number(e.target.value))} />
                <span className="unit">%</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">ריבית שנתית — הלוואה חלופית</span>
              <div className="input-wrap has-unit">
                <input type="number" step={0.1} min={0} value={altRate} onChange={(e) => setAltRate(Number(e.target.value))} />
                <span className="unit">%</span>
              </div>
            </label>
          </div>

          <label className="waiver-row">
            <input type="checkbox" checked={collateralFrozen} onChange={(e) => setCollateralFrozen(e.target.checked)} />
            <span>הסכום המשועבד מפסיק לצבור תשואה בזמן ההלוואה</span>
          </label>

          <button className="calc-btn fixation-calc" onClick={onCalc} disabled={busy}>
            {busy ? 'משווה…' : 'השווה הלוואות'}
          </button>
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className="fixation-scenarios">
                <div className="card fixation-scenario custom">
                  <h4>הלוואת הקרן</h4>
                  <dl>
                    <dt>תשלום חודשי</dt>
                    <dd>{nis(result.fundLoan.monthlyPayment)}</dd>
                    <dt>סך ריבית</dt>
                    <dd>{nis(result.fundLoan.totalInterest)}</dd>
                    {result.fundLoan.opportunityCost > 0 && (
                      <>
                        <dt>עלות הזדמנות (תשואה שאבדה)</dt>
                        <dd className="excess">{nis(result.fundLoan.opportunityCost)}</dd>
                      </>
                    )}
                    <dt>עלות כוללת</dt>
                    <dd className={result.totalCostGap <= 0 ? 'good' : 'excess'}>
                      {nis(result.fundLoan.totalCost)}
                    </dd>
                  </dl>
                </div>
                <div className="card fixation-scenario custom">
                  <h4>הלוואה חלופית</h4>
                  <dl>
                    <dt>תשלום חודשי</dt>
                    <dd>{nis(result.alternativeLoan.monthlyPayment)}</dd>
                    <dt>עלות כוללת (= סך הריבית, אין עלות הזדמנות)</dt>
                    <dd className={result.totalCostGap >= 0 ? 'good' : 'excess'}>
                      {nis(result.alternativeLoan.totalInterest)}
                    </dd>
                  </dl>
                </div>
              </div>

              <div className="fixation-summary">
                <div className="scenario-stat">
                  <div className={`stat-value ${result.totalCostGap <= 0 ? 'good' : 'excess'}`}>
                    {result.totalCostGap >= 0 ? '+' : ''}
                    {nis(result.totalCostGap)}
                  </div>
                  <div className="stat-label">
                    {result.totalCostGap <= 0 ? 'הלוואת הקרן זולה יותר בסה"כ ב-' : 'הלוואת הקרן יקרה יותר בסה"כ ב-'}
                  </div>
                </div>
              </div>

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
