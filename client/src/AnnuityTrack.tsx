import { useEffect, useState } from 'react';
import {
  calcAnnuityTrack,
  UnauthorizedError,
  type AnnuityTrackFormInput,
  type AnnuityTrackOption,
  type AnnuityTrackResult,
} from './api';
import { IconScales } from './icons';

/**
 * בחירת מסלול קצבה (מפרט 4.3 + 5.2) — השוואת כמה מסלולי קצבה (כל אחד עם
 * מקדם המרה, % קצבת שאיר וחודשי הבטחת תשלומים משלו, כפי שהקרן שולחת
 * לקראת הפרישה) ואיתור נקודת האיזון: מגיל כמה מסלול נדיב יותר לשאירים
 * "משתלם" בסך הכול לעומת המסלול הראשון ברשימה.
 */

interface Props {
  defaultBalance: number;
  defaultRetirementAge: number;
  hasSpouse: boolean;
  defaultSpouseAgeAtRetirement?: number;
  onUnauthorized: () => void;
  onResult?: (r: AnnuityTrackResult) => void;
  initial?: AnnuityTrackFormInput;
  onInput?: (s: AnnuityTrackFormInput) => void;
  initialResult?: AnnuityTrackResult;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

let idCounter = 0;
const nextId = () => `track-${++idCounter}-${Date.now()}`;

/**
 * שמות מסלול נפוצים — נבחרים מרשימה, לא מוקצים אוטומטית לפי המספר הסידורי.
 * בחירת שם מציבה גם את % קצבת השאיר התואם (ניתן עדיין לערוך ידנית אחרי הבחירה).
 */
const NAME_PRESET_SURVIVOR_PCT: Record<string, number> = {
  'ללא שאירים / מקסימום קצבה': 0,
  '50% קצבת שאיר': 50,
  '60% קצבת שאיר': 60,
  '75% קצבת שאיר': 75,
  '100% קצבת שאירים': 100,
};
const NAME_PRESETS = Object.keys(NAME_PRESET_SURVIVOR_PCT);

function defaultOptions(): AnnuityTrackOption[] {
  return [
    { id: nextId(), label: NAME_PRESETS[0], conversionFactor: 200, survivorPct: 0, guaranteedMonths: 60 },
    { id: nextId(), label: NAME_PRESETS[4], conversionFactor: 225, survivorPct: 100, guaranteedMonths: 60 },
  ];
}

export function AnnuityTrack(props: Props) {
  const [open, setOpen] = useState(!!props.initialResult);
  const [balance, setBalance] = useState(props.initial?.balance ?? Math.round(props.defaultBalance));
  const [retirementAge, setRetirementAge] = useState(
    props.initial?.retirementAge ?? Math.round(props.defaultRetirementAge),
  );
  const [retireeLifeExpectancyAge, setRetireeLifeExpectancyAge] = useState(
    props.initial?.retireeLifeExpectancyAge ?? 85,
  );
  const [hasSpouse, setHasSpouse] = useState(props.initial?.hasSpouse ?? props.hasSpouse);
  const [spouseAgeAtRetirement, setSpouseAgeAtRetirement] = useState(
    props.initial?.spouseAgeAtRetirement ??
      props.defaultSpouseAgeAtRetirement ??
      Math.round(props.defaultRetirementAge) - 2,
  );
  const [spouseLifeExpectancyAge, setSpouseLifeExpectancyAge] = useState(
    props.initial?.spouseLifeExpectancyAge ?? 90,
  );
  const [options, setOptions] = useState<AnnuityTrackOption[]>(
    props.initial?.options ?? defaultOptions(),
  );

  useEffect(() => {
    props.onInput?.({
      balance,
      retirementAge,
      retireeLifeExpectancyAge,
      hasSpouse,
      spouseAgeAtRetirement,
      spouseLifeExpectancyAge,
      options,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, retirementAge, retireeLifeExpectancyAge, hasSpouse, spouseAgeAtRetirement, spouseLifeExpectancyAge, options]);

  const [result, setResult] = useState<AnnuityTrackResult | null>(props.initialResult ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addOption() {
    setOptions((os) => [
      ...os,
      { id: nextId(), label: NAME_PRESETS[2], conversionFactor: 200, survivorPct: 60, guaranteedMonths: 60 },
    ]);
  }
  function updateOption(id: string, patch: Partial<AnnuityTrackOption>) {
    setOptions((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function removeOption(id: string) {
    setOptions((os) => os.filter((o) => o.id !== id));
  }

  async function onCalc() {
    setBusy(true);
    setError(null);
    try {
      const r = await calcAnnuityTrack({
        balanceAtRetirement: balance,
        options,
        hasSpouse,
        retirementAge,
        retireeLifeExpectancyAge,
        spouseAgeAtRetirement: hasSpouse ? spouseAgeAtRetirement : undefined,
        spouseLifeExpectancyAge: hasSpouse ? spouseLifeExpectancyAge : undefined,
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
    <section className="results fixation-section" data-tour="annuitytrack-section">
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
          {IconScales}
          בחירת מסלול קצבה — כמה שאירים לוקחים, וכמה קצבה זה עולה
          <span
            className="tip"
            data-tip="לקראת הפרישה הקרן שולחת טבלת מסלולים: כל שילוב של % קצבת שאיר וחודשי הבטחת תשלומים נותן מקדם המרה שונה — ולכן קצבה חודשית שונה. הזינו את המסלולים מהטבלה שקיבלתם והמערכת תמצא את 'נקודת האיזון': מאיזה גיל פטירה מסלול נדיב יותר לשאירים משתלם בסך הכול."
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
              <span className="field-label">צבירה צפויה בפרישה</span>
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
              <span className="field-label">גיל פרישה</span>
              <input
                type="number"
                min={55}
                max={80}
                value={retirementAge}
                onChange={(e) => setRetirementAge(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span className="field-label">
                תוחלת חיים משוערת (שלך)
                <span className="tip" data-tip="הנחה בלבד — לצורך אומדן סך התשלומים ונקודת האיזון, לא תחזית." tabIndex={0}>ⓘ</span>
              </span>
              <input
                type="number"
                min={retirementAge + 1}
                max={110}
                value={retireeLifeExpectancyAge}
                onChange={(e) => setRetireeLifeExpectancyAge(Number(e.target.value))}
              />
            </label>
          </div>

          <label className="waiver-row">
            <input
              type="checkbox"
              checked={hasSpouse}
              onChange={(e) => setHasSpouse(e.target.checked)}
            />
            <span>יש בן/בת זוג — רלוונטי לקצבת השאיר בכל מסלול</span>
          </label>

          {hasSpouse && (
            <div className="fixation-form">
              <label className="field">
                <span className="field-label">גיל בן/בת הזוג בפרישה</span>
                <input
                  type="number"
                  min={18}
                  max={100}
                  value={spouseAgeAtRetirement}
                  onChange={(e) => setSpouseAgeAtRetirement(Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span className="field-label">תוחלת חיים משוערת (בן/בת הזוג)</span>
                <input
                  type="number"
                  min={spouseAgeAtRetirement + 1}
                  max={110}
                  value={spouseLifeExpectancyAge}
                  onChange={(e) => setSpouseLifeExpectancyAge(Number(e.target.value))}
                />
              </label>
            </div>
          )}

          {options.length === 0 && (
            <p className="hint">אין עדיין מסלולים להשוואה. הוסיפו לפחות אחד מהכפתור למטה.</p>
          )}

          {options.map((o, i) => (
            <div key={o.id} className="transfer-card" style={{ marginBottom: 10 }}>
              <div className="transfer-card-head">
                <span className="bens-label">
                  {o.label || `מסלול ${i + 1}`}
                  {i === 0 && ' (בסיס להשוואה)'}
                </span>
                <button className="remove-btn" onClick={() => removeOption(o.id)} title="הסר מסלול">
                  ✕
                </button>
              </div>
              <div className="fixation-form">
                <label className="field">
                  <span className="field-label">שם המסלול (מהטבלה שקיבלת מהקרן)</span>
                  <select
                    value={NAME_PRESETS.includes(o.label) ? o.label : 'custom'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        updateOption(o.id, { label: '' });
                      } else {
                        updateOption(o.id, { label: val, survivorPct: NAME_PRESET_SURVIVOR_PCT[val] });
                      }
                    }}
                  >
                    {NAME_PRESETS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    <option value="custom">מותאם אישית…</option>
                  </select>
                  {!NAME_PRESETS.includes(o.label) && (
                    <input
                      type="text"
                      placeholder="שם מותאם אישית"
                      value={o.label}
                      onChange={(e) => updateOption(o.id, { label: e.target.value })}
                      style={{ marginTop: 6 }}
                    />
                  )}
                </label>
                <label className="field">
                  <span className="field-label">מקדם המרה</span>
                  <input
                    type="number"
                    step={0.1}
                    min={1}
                    value={o.conversionFactor}
                    onChange={(e) => updateOption(o.id, { conversionFactor: Number(e.target.value) })}
                  />
                </label>
                <label className="field">
                  <span className="field-label">% קצבת שאיר</span>
                  <div className="input-wrap has-unit">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={o.survivorPct}
                      onChange={(e) => updateOption(o.id, { survivorPct: Number(e.target.value) })}
                    />
                    <span className="unit">%</span>
                  </div>
                </label>
                <label className="field">
                  <span className="field-label">חודשי הבטחת תשלומים</span>
                  <select
                    value={o.guaranteedMonths}
                    onChange={(e) => updateOption(o.id, { guaranteedMonths: Number(e.target.value) })}
                  >
                    {[0, 60, 120, 180, 240].map((m) => (
                      <option key={m} value={m}>
                        {m === 0 ? 'ללא הבטחה' : `${m} חודשים`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ))}

          <div className="ai-panel-actions">
            <button className="save-btn" onClick={addOption}>
              + מסלול נוסף
            </button>
          </div>

          <button
            className="calc-btn fixation-calc"
            onClick={onCalc}
            disabled={busy || options.length === 0}
          >
            {busy ? 'משווה מסלולים…' : 'השווה מסלולים'}
          </button>
          {error && <div className="error">{error}</div>}

          {result && (
            <>
              <div className="fixation-scenarios">
                {result.options.map((o) => (
                  <div key={o.id} className="card fixation-scenario custom">
                    <h4>{o.label}</h4>
                    <dl>
                      <dt>קצבה חודשית</dt>
                      <dd className="good">{nis(o.monthlyAnnuity)}</dd>
                      {o.survivorPct > 0 && (
                        <>
                          <dt>קצבת שאיר לבן/בת הזוג</dt>
                          <dd>{nis(o.survivorMonthly)} ({o.survivorPct}%)</dd>
                        </>
                      )}
                      <dt>הבטחת תשלומים</dt>
                      <dd>{o.guaranteedMonths === 0 ? 'ללא' : `${o.guaranteedMonths} חודשים`}</dd>
                      <dt>סך תשלומים משוער למשפחה</dt>
                      <dd>{nis(o.totalExpectedPayout)}</dd>
                      <dt>נקודת איזון מול מסלול הבסיס</dt>
                      <dd>
                        {o.breakEvenAge === undefined
                          ? 'מסלול הבסיס'
                          : o.breakEvenAge === null
                            ? 'אינו משתלם באופק הנבדק'
                            : `משתלם אם הפטירה מגיל ${Math.round(o.breakEvenAge)} ואילך`}
                      </dd>
                    </dl>
                  </div>
                ))}
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
