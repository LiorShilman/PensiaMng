import { useEffect, useState } from 'react';
import {
  calcSection190,
  UnauthorizedError,
  type Section190FormInput,
  type Section190Result,
} from './api';
import { IconCoins } from './icons';

/**
 * תיקון 190 — משיכה הונית (15% מס על הרווח הריאלי בלבד) מול "קצבה
 * מוכרת" (פטורה ממס לחלוטין). ראו section190.ts בשרת — מודל מפושט,
 * לא בודק תנאי זכאות מלאים.
 */

interface Props {
  defaultBalance: number;
  defaultAge: number;
  defaultReturnPct: number;
  onUnauthorized: () => void;
  onResult?: (r: Section190Result) => void;
  initial?: Section190FormInput;
  onInput?: (s: Section190FormInput) => void;
  initialResult?: Section190Result;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

export function Section190(props: Props) {
  const [open, setOpen] = useState(!!props.initialResult);
  const [balance, setBalance] = useState(props.initial?.balance ?? Math.round(props.defaultBalance));
  const [realGainPct, setRealGainPct] = useState(props.initial?.realGainPct ?? 40);
  const [conversionFactor, setConversionFactor] = useState(props.initial?.conversionFactor ?? 200);
  const [currentAge, setCurrentAge] = useState(props.initial?.currentAge ?? Math.max(60, props.defaultAge));
  const [lifeExpectancyAge, setLifeExpectancyAge] = useState(props.initial?.lifeExpectancyAge ?? 85);

  useEffect(() => {
    props.onInput?.({ balance, realGainPct, conversionFactor, currentAge, lifeExpectancyAge });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, realGainPct, conversionFactor, currentAge, lifeExpectancyAge]);

  const [result, setResult] = useState<Section190Result | null>(props.initialResult ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCalc() {
    setBusy(true);
    setError(null);
    try {
      const r = await calcSection190({
        balance,
        realGainPct,
        conversionFactor,
        currentAge,
        lifeExpectancyAge,
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
    <section className="results fixation-section" data-tour="section190-section">
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
          תיקון 190 — משיכה הונית מול קצבה מוכרת
          <span
            className="tip"
            data-tip="כספי גמל שהופקדו במסלול תיקון 190 (בד״כ אחרי גיל 60) ניתנים למשיכה הונית במס מופחת של 15% על הרווח הריאלי בלבד, או כ'קצבה מוכרת' — קצבה חודשית הפטורה ממס לחלוטין. מודל מפושט להשוואה, לא בדיקת זכאות."
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
              <span className="field-label">צבירה במסלול תיקון 190</span>
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
              <span className="field-label">
                % מהצבירה שהוא רווח ריאלי
                <span className="tip" data-tip="הרווח שנצבר מעל ההפקדות עצמן — מופיע בדוח השנתי או ניתן להעריך גס." tabIndex={0}>ⓘ</span>
              </span>
              <div className="input-wrap has-unit">
                <input type="number" min={0} max={100} value={realGainPct} onChange={(e) => setRealGainPct(Number(e.target.value))} />
                <span className="unit">%</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">מקדם המרה לקצבה מוכרת</span>
              <input type="number" step={0.1} value={conversionFactor} onChange={(e) => setConversionFactor(Number(e.target.value))} />
            </label>
            <label className="field">
              <span className="field-label">גיל נוכחי</span>
              <input type="number" min={18} max={100} value={currentAge} onChange={(e) => setCurrentAge(Number(e.target.value))} />
            </label>
            <label className="field">
              <span className="field-label">גיל תוחלת חיים משוער</span>
              <input
                type="number"
                min={currentAge + 1}
                max={110}
                value={lifeExpectancyAge}
                onChange={(e) => setLifeExpectancyAge(Number(e.target.value))}
              />
            </label>
          </div>

          <button className="calc-btn fixation-calc" onClick={onCalc} disabled={busy}>
            {busy ? 'משווה…' : 'השווה הונית מול קצבה מוכרת'}
          </button>
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className="fixation-scenarios">
                <div className="card fixation-scenario max_lump_sum">
                  <h4>משיכה הונית</h4>
                  <dl>
                    <dt>רווח חייב במס</dt>
                    <dd>{nis(result.lumpSum.taxableGain)}</dd>
                    <dt>מס (15%)</dt>
                    <dd className="excess">−{nis(result.lumpSum.tax)}</dd>
                    <dt>נטו ביד</dt>
                    <dd className="good">{nis(result.lumpSum.netAmount)}</dd>
                    <dt>ערך עתידי בגיל {lifeExpectancyAge}</dt>
                    <dd>{nis(result.lumpSum.projectedValueAtLifeExpectancy)}</dd>
                  </dl>
                  <div className="warnings" style={{ marginTop: 10 }}>
                    <div className="warning-item">
                      ⚠ "ערך עתידי" מבוסס על הנחת תשואה ריאלית {props.defaultReturnPct}% (מ"הנחות התכנון" למעלה בעמוד) — מניח שהסכום נטו מושקע ולא נגוע עד גיל {lifeExpectancyAge}. שינוי ההנחה שם ישנה את המספר הזה.
                    </div>
                  </div>
                </div>
                <div className="card fixation-scenario full_pension">
                  <h4>קצבה מוכרת</h4>
                  <dl>
                    <dt>קצבה חודשית (פטורה ממס)</dt>
                    <dd className="good">{nis(result.recognizedPension.monthlyAmount)}</dd>
                    <dt>מספר חודשי תשלום</dt>
                    <dd>{result.recognizedPension.totalMonths}</dd>
                    <dt>סך הכנסה עד גיל {lifeExpectancyAge}</dt>
                    <dd>{nis(result.recognizedPension.totalIncomeToLifeExpectancy)}</dd>
                  </dl>
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
