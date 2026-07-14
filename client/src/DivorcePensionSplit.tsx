import { useEffect, useState } from 'react';
import {
  calcDivorcePensionSplit,
  UnauthorizedError,
  type DivorcePensionSplitResult,
  type DivorceSplitFormInput,
  type DivorceSplitProductInput,
} from './api';
import { DateField } from './DateField';
import { IconSplit } from './icons';

/**
 * חלוקת זכויות פנסיה בגירושין — נוסחת "יחס הזמנים" (חוק לחלוקת חיסכון
 * פנסיוני בין בני זוג שנפרדו, תשע"ד-2014). כלי המחשה בלבד, לא ייעוץ משפטי.
 * ראו divorce-pension-split.ts בשרת למקורות ולפירוט הנוסחה.
 */

interface Props {
  onUnauthorized: () => void;
  onResult?: (r: DivorcePensionSplitResult) => void;
  initial?: DivorceSplitFormInput;
  onInput?: (s: DivorceSplitFormInput) => void;
  initialResult?: DivorcePensionSplitResult;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

let idCounter = 0;
const nextId = () => `divorce-prod-${++idCounter}-${Date.now()}`;

export function DivorcePensionSplit(props: Props) {
  const [open, setOpen] = useState(!!props.initialResult);
  const [marriageDate, setMarriageDate] = useState(props.initial?.marriageDate ?? '');
  const [breakDate, setBreakDate] = useState(props.initial?.breakDate ?? '');
  const [retirementDate, setRetirementDate] = useState(props.initial?.retirementDate ?? '');
  const [awardedPct, setAwardedPct] = useState(props.initial?.awardedPct ?? 50);
  const [products, setProducts] = useState<DivorceSplitProductInput[]>(
    props.initial?.products ?? [],
  );

  useEffect(() => {
    props.onInput?.({ marriageDate, breakDate, retirementDate, awardedPct, products });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marriageDate, breakDate, retirementDate, awardedPct, products]);

  const [result, setResult] = useState<DivorcePensionSplitResult | null>(
    props.initialResult ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validProducts = products.filter(
    (p) => p.name.trim() && p.joinDate && p.balanceAtBreakDate > 0,
  );

  async function onCalc() {
    if (!marriageDate || !breakDate || !retirementDate || validProducts.length === 0) {
      setError('יש למלא את שלושת התאריכים ולפחות מוצר אחד עם שם, תאריך הצטרפות ויתרה');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await calcDivorcePensionSplit({
        marriageDate,
        breakDate,
        retirementDate,
        awardedPct,
        products: validProducts,
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

  const setProduct = (i: number, patch: Partial<DivorceSplitProductInput>) =>
    setProducts(products.map((p, ii) => (ii === i ? { ...p, ...patch } : p)));

  return (
    <section className="results fixation-section" data-tour="divorce-split-section">
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
          {IconSplit}
          חלוקת זכויות פנסיה בגירושין
          <span
            className="tip"
            data-tip="נוסחת 'יחס הזמנים' לפי חוק חלוקת חיסכון פנסיוני בין בני זוג שנפרדו (תשע״ד-2014): החלק היחסי של תקופת הנישואין מתוך כלל תקופת הצבירה בקרן, מוכפל באחוז שהוסכם. כלי המחשה בלבד — לא ייעוץ משפטי, והחלוקה בפועל נקבעת בהסכם או פסק דין."
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
              <span className="field-label">תאריך נישואין</span>
              <DateField value={marriageDate} onChange={setMarriageDate} />
            </label>
            <label className="field">
              <span className="field-label">
                מועד הקרע
                <span
                  className="tip"
                  data-tip="התאריך הקובע לסיום השיתוף הכלכלי — בד״כ הגשת תביעת הגירושין או הפירוד הפיזי. רק זכויות שנצברו עד תאריך זה נכנסות לחלוקה."
                  tabIndex={0}
                >
                  ⓘ
                </span>
              </span>
              <DateField value={breakDate} onChange={setBreakDate} />
            </label>
            <label className="field">
              <span className="field-label">תאריך פרישה (בפועל/מתוכנן)</span>
              <DateField value={retirementDate} onChange={setRetirementDate} />
            </label>
            <label className="field">
              <span className="field-label">
                אחוז שהוסכם/נפסק לבן/בת הזוג
                <span
                  className="tip"
                  data-tip="ברירת המחדל 50% היא התקרה המקובלת בפסיקה על החלק היחסי — לא בהכרח מה שייקבע במקרה הספציפי. תלוי בהסכם גירושין או פסק דין."
                  tabIndex={0}
                >
                  ⓘ
                </span>
              </span>
              <div className="input-wrap has-unit">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={awardedPct}
                  onChange={(e) => setAwardedPct(Number(e.target.value))}
                />
                <span className="unit">%</span>
              </div>
            </label>
          </div>

          <div className="bens fixation-grants">
            <span className="bens-label">
              מוצרי פנסיה שנכנסים לחלוקה
              <span
                className="tip"
                data-tip="לכל מוצר: תאריך הצטרפות לקרן, והיתרה נכון למועד הקרע בדיוק (לא היתרה היום!) — מתקבלת באישור רשמי מהגוף המנהל ('אישור זכויות למועד הקרע'). מתאים לפנסיה צוברת בלבד (יתרה כספית) — לא לפנסיה תקציבית."
                tabIndex={0}
              >
                ⓘ
              </span>
            </span>
            {products.map((p, i) => (
              <div key={p.id} className="transfer-card">
                <div className="transfer-card-head">
                  <input
                    type="text"
                    placeholder="שם המוצר"
                    value={p.name}
                    onChange={(e) => setProduct(i, { name: e.target.value })}
                  />
                  <button
                    className="chip-remove"
                    title="הסר מוצר"
                    onClick={() => setProducts(products.filter((_, ii) => ii !== i))}
                  >
                    ✕
                  </button>
                </div>
                <label className="field">
                  <span className="field-label">תאריך הצטרפות לקרן</span>
                  <DateField
                    value={p.joinDate}
                    onChange={(v) => setProduct(i, { joinDate: v })}
                  />
                </label>
                <label className="field">
                  <span className="field-label">יתרה נכון למועד הקרע</span>
                  <div className="input-wrap has-unit">
                    <input
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      value={
                        p.balanceAtBreakDate === 0
                          ? ''
                          : p.balanceAtBreakDate.toLocaleString('en-US')
                      }
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^\d]/g, '');
                        setProduct(i, {
                          balanceAtBreakDate: digits === '' ? 0 : Number(digits),
                        });
                      }}
                    />
                    <span className="unit">₪</span>
                  </div>
                </label>
              </div>
            ))}
            <button
              className="add-chip small"
              onClick={() =>
                setProducts([
                  ...products,
                  { id: nextId(), name: '', joinDate: '', balanceAtBreakDate: 0 },
                ])
              }
            >
              + מוצר
            </button>
          </div>

          <button className="calc-btn fixation-calc" onClick={onCalc} disabled={busy}>
            {busy ? 'מחשב…' : 'חשב חלוקה'}
          </button>
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <table>
                <thead>
                  <tr>
                    <th>מוצר</th>
                    <th>יחס זמנים</th>
                    <th>חלק בן/בת הזוג</th>
                    <th>נשאר לעמית/ה</th>
                  </tr>
                </thead>
                <tbody>
                  {result.products.map((p) => (
                    <tr key={p.id}>
                      <td className="strong">{p.name}</td>
                      <td className="num">{p.maritalFractionPct}%</td>
                      <td className="num good">{nis(p.spouseShare)}</td>
                      <td className="num">{nis(p.remainingForMember)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="fixation-summary">
                <div className="scenario-stat">
                  <div className="stat-value">{nis(result.totalBalanceAtBreakDate)}</div>
                  <div className="stat-label">סך היתרות למועד הקרע</div>
                </div>
                <div className="scenario-stat">
                  <div className="stat-value good">{nis(result.totalSpouseShare)}</div>
                  <div className="stat-label">סה"כ חלק בן/בת הזוג</div>
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
