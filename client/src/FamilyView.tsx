import { useEffect, useState } from 'react';
import {
  calcFamilyScenarios,
  loadPortfolio,
  loadSpousePortfolio,
  removeSpousePortfolio,
  saveSpousePortfolio,
  spouseExists,
  UnauthorizedError,
  type FamilyScenariosResult,
  type Gender,
  type PortfolioProductInput,
  type ProductType,
  type SavedPortfolio,
} from './api';
import { TYPE_META, TYPE_ORDER } from './App';
import { DateField } from './DateField';

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

let idCounter = 0;
const nextId = () => `spouse-prod-${++idCounter}-${Date.now()}`;

function newSpouseProduct(type: ProductType): PortfolioProductInput {
  return {
    id: nextId(),
    name: TYPE_META[type].label,
    type,
    currentBalance: 0,
    monthlyDeposit: 0,
    feeFromDepositPct: 0,
    feeFromBalancePct: 0,
    monthlyCoverageCost: 0,
    survivorsPct: 100,
    disabilityPct: 75,
  };
}

const EMPTY_SPOUSE: SavedPortfolio = {
  assumptions: null,
  profile: { fullName: 'בן/בת הזוג', gender: 'FEMALE', birthDate: '1985-01-01' },
  products: [],
};

export function FamilyView(props: { onClose: () => void; onUnauthorized: () => void }) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [primary, setPrimary] = useState<SavedPortfolio | null>(null);
  const [spouse, setSpouse] = useState<SavedPortfolio>(EMPTY_SPOUSE);
  const [result, setResult] = useState<FamilyScenariosResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    spouseExists()
      .then(async (r) => {
        setActive(r.exists);
        if (r.exists) {
          const [p, s] = await Promise.all([loadPortfolio(), loadSpousePortfolio()]);
          setPrimary(p);
          setSpouse(s);
        }
      })
      .catch((e) => {
        if (e instanceof UnauthorizedError) props.onUnauthorized();
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onActivate() {
    setBusy(true);
    setError(null);
    try {
      const [p, s] = await Promise.all([loadPortfolio(), loadSpousePortfolio()]);
      setPrimary(p);
      setSpouse(s);
      setActive(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate() {
    if (!confirm('לבטל את מבט הזוג? תיק בן/בת הזוג וכל מוצריו יימחקו לצמיתות.')) return;
    setBusy(true);
    setError(null);
    try {
      await removeSpousePortfolio();
      setActive(false);
      setSpouse(EMPTY_SPOUSE);
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function updateProfile(patch: Partial<NonNullable<SavedPortfolio['profile']>>) {
    setSpouse((s) => ({
      ...s,
      profile: { ...(s.profile ?? EMPTY_SPOUSE.profile!), ...patch },
    }));
  }

  function updateProduct(id: string, patch: Partial<PortfolioProductInput>) {
    setSpouse((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function addProduct() {
    setSpouse((s) => ({ ...s, products: [...s.products, newSpouseProduct('PENSION_COMPREHENSIVE')] }));
  }

  function removeProduct(id: string) {
    setSpouse((s) => ({ ...s, products: s.products.filter((p) => p.id !== id) }));
  }

  async function onCalculate() {
    setBusy(true);
    setError(null);
    setStatus(null);
    setResult(null);
    try {
      const savedSpouse = await saveSpousePortfolio(spouse);
      setSpouse(savedSpouse);
      const freshPrimary = primary ?? (await loadPortfolio());

      if (!freshPrimary.profile) {
        throw new Error('חסרים פרטים אישיים בתיק הראשי — מלא/י אותם קודם');
      }
      if (!savedSpouse.profile) {
        throw new Error('חסרים פרטים אישיים בתיק בן/בת הזוג');
      }

      const childrenBirthDates = (freshPrimary.profile.children ?? []).map((c) => c.birthDate);

      const r = await calcFamilyScenarios({
        primary: {
          label: 'התיק הראשי',
          insuredMonthlySalary: freshPrimary.profile.insuredMonthlySalary ?? 0,
          scenarios: {
            family: { hasSpouse: true, childrenBirthDates },
            insuredMonthlySalary: freshPrimary.profile.insuredMonthlySalary ?? 0,
            products: freshPrimary.products.map(toScenarioProduct),
            nationalInsurance: { include: true },
          },
        },
        spouse: {
          label: savedSpouse.profile.fullName?.trim() || 'בן/בת הזוג',
          insuredMonthlySalary: savedSpouse.profile.insuredMonthlySalary ?? 0,
          scenarios: {
            family: { hasSpouse: true, childrenBirthDates },
            insuredMonthlySalary: savedSpouse.profile.insuredMonthlySalary ?? 0,
            products: savedSpouse.products.map(toScenarioProduct),
            nationalInsurance: { include: true },
          },
        },
      });
      setResult(r);
      setStatus('חושב ונשמר ✓');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="card ai-panel">
        <p className="hint">טוען…</p>
      </section>
    );
  }

  return (
    <section className="card ai-panel">
      <div className="ai-panel-head">
        <h2 className="card-title">מסך משפחה — מבט זוגי ותרחישי שארים הדדיים</h2>
        <button className="remove-btn" onClick={props.onClose} title="סגור">
          ✕
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {status && <p className="ai-status good">{status}</p>}

      {!active ? (
        <>
          <p className="hint">
            בונה תיק נפרד לבן/בת הזוג, ומראה תמונה הדדית: אם אחד/ת מבני הזוג נפטר/ת,
            כמה מכניסה בפועל נשארת למשפחה — השכר הממשיך של הנותר/ת בחיים + קצבת
            השארים והסכום החד-פעמי מתיק הנפטר/ת.
          </p>
          <div className="ai-panel-actions">
            <button className="calc-btn" onClick={onActivate} disabled={busy}>
              הפעל מבט זוגי
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="fixation-form">
            <label className="field">
              <span className="field-label">שם בן/בת הזוג</span>
              <input
                type="text"
                value={spouse.profile?.fullName ?? ''}
                onChange={(e) => updateProfile({ fullName: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">מגדר</span>
              <select
                className="field-select"
                value={spouse.profile?.gender ?? 'FEMALE'}
                onChange={(e) => updateProfile({ gender: e.target.value as Gender })}
              >
                <option value="FEMALE">אישה</option>
                <option value="MALE">גבר</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">תאריך לידה</span>
              <DateField
                value={spouse.profile?.birthDate ?? '1985-01-01'}
                onChange={(v) => updateProfile({ birthDate: v })}
              />
            </label>
            <label className="field">
              <span className="field-label">
                שכר חודשי מבוטח
                <span
                  className="tip"
                  data-tip="הבסיס לקצבאות שארים ונכות מתיק בן/בת הזוג, וגם ההכנסה שממשיכה עבורו/ה אם אתה/את נפטר/ת."
                  tabIndex={0}
                >
                  ⓘ
                </span>
              </span>
              <div className="input-wrap has-unit">
                <input
                  type="number"
                  dir="ltr"
                  min={0}
                  value={spouse.profile?.insuredMonthlySalary ?? ''}
                  onChange={(e) =>
                    updateProfile({
                      insuredMonthlySalary:
                        e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
                <span className="unit">₪</span>
              </div>
            </label>
          </div>

          <h3 className="card-title" style={{ fontSize: '1rem', marginTop: 22 }}>
            מוצרי ביטוח ופנסיה — בן/בת הזוג
          </h3>
          {spouse.products.length === 0 && (
            <p className="hint">אין עדיין מוצרים בתיק בן/בת הזוג.</p>
          )}
          {spouse.products.map((p) => (
            <div key={p.id} className="transfer-card" style={{ marginBottom: 10 }}>
              <div className="transfer-card-head">
                <span className="bens-label">{TYPE_META[p.type].label}</span>
                <button className="remove-btn" onClick={() => removeProduct(p.id)} title="מחק מוצר">
                  ✕
                </button>
              </div>
              <div className="fixation-form">
                <label className="field">
                  <span className="field-label">שם המוצר</span>
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => updateProduct(p.id, { name: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field-label">סוג</span>
                  <select
                    className="field-select"
                    value={p.type}
                    onChange={(e) => updateProduct(p.id, { type: e.target.value as ProductType })}
                  >
                    {TYPE_ORDER.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_META[t].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">צבירה נוכחית</span>
                  <div className="input-wrap has-unit">
                    <input
                      type="number"
                      dir="ltr"
                      min={0}
                      value={p.currentBalance}
                      onChange={(e) =>
                        updateProduct(p.id, { currentBalance: Number(e.target.value) })
                      }
                    />
                    <span className="unit">₪</span>
                  </div>
                </label>
                {(p.type === 'MANAGERS_INSURANCE' || p.type === 'LIFE_INSURANCE') && (
                  <label className="field">
                    <span className="field-label">סכום ביטוח למקרה מוות</span>
                    <div className="input-wrap has-unit">
                      <input
                        type="number"
                        dir="ltr"
                        min={0}
                        value={p.deathBenefitAmount ?? ''}
                        onChange={(e) =>
                          updateProduct(p.id, {
                            deathBenefitAmount:
                              e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                      />
                      <span className="unit">₪</span>
                    </div>
                  </label>
                )}
                {(p.type === 'PENSION_COMPREHENSIVE' || p.type === 'PENSION_GENERAL') && (
                  <>
                    <label className="field">
                      <span className="field-label">% כיסוי שארים</span>
                      <div className="input-wrap has-unit">
                        <input
                          type="number"
                          dir="ltr"
                          min={0}
                          max={100}
                          value={p.survivorsPct ?? 100}
                          onChange={(e) =>
                            updateProduct(p.id, { survivorsPct: Number(e.target.value) })
                          }
                        />
                        <span className="unit">%</span>
                      </div>
                    </label>
                    <label className="field">
                      <span className="field-label">% כיסוי נכות</span>
                      <div className="input-wrap has-unit">
                        <input
                          type="number"
                          dir="ltr"
                          min={0}
                          max={100}
                          value={p.disabilityPct ?? 75}
                          onChange={(e) =>
                            updateProduct(p.id, { disabilityPct: Number(e.target.value) })
                          }
                        />
                        <span className="unit">%</span>
                      </div>
                    </label>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="ai-panel-actions">
            <button className="save-btn" onClick={addProduct} disabled={busy}>
              + הוסף מוצר
            </button>
          </div>

          <div className="ai-panel-actions" style={{ marginTop: 16 }}>
            <button className="calc-btn" onClick={onCalculate} disabled={busy}>
              שמור וחשב תרחישים הדדיים
            </button>
            <button className="danger-btn" onClick={onDeactivate} disabled={busy}>
              בטל מבט זוגי
            </button>
          </div>

          {result && (
            <>
              <div className="fixation-summary">
                <div className="scenario-stat">
                  <div className="stat-value">{nis(result.baselineHouseholdMonthly)}</div>
                  <div className="stat-label">הכנסה משפחתית בסיסית (שני השכרים)</div>
                </div>
                <div className="scenario-stat">
                  <div className="stat-value">{nis(result.targetMonthly)}</div>
                  <div className="stat-label">יעד הכנסה משפחתי</div>
                </div>
              </div>

              <div className="fixation-scenarios">
                <OutcomeCard
                  scenarioKey="full_pension"
                  title="אם בעל/ת התיק הראשי נפטר/ת"
                  outcome={result.ifPrimaryDies}
                />
                <OutcomeCard
                  scenarioKey="max_lump_sum"
                  title={`אם ${result.ifPrimaryDies.survivorLabel} נפטר/ת`}
                  outcome={result.ifSpouseDies}
                />
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
        </>
      )}
    </section>
  );
}

function OutcomeCard(props: {
  scenarioKey: 'full_pension' | 'max_lump_sum';
  title: string;
  outcome: FamilyScenariosResult['ifPrimaryDies'];
}) {
  const { outcome } = props;
  return (
    <div className={`card fixation-scenario ${props.scenarioKey}`}>
      <h4>{props.title}</h4>
      <dl>
        <dt>{outcome.survivorLabel} ממשיך/ה בהכנסה של</dt>
        <dd>{nis(outcome.ownContinuingIncome)}</dd>
        <dt>קצבת שארים מתיק הנפטר/ת</dt>
        <dd>{nis(outcome.productsSurvivorMonthly)}</dd>
        {outcome.niSurvivorsMonthly > 0 && (
          <>
            <dt>קצבת שארים מביטוח לאומי</dt>
            <dd className="good">{nis(outcome.niSurvivorsMonthly)}</dd>
          </>
        )}
        {outcome.lumpSum > 0 && (
          <>
            <dt>סכום חד-פעמי</dt>
            <dd>{nis(outcome.lumpSum)}</dd>
          </>
        )}
        <dt>סה"כ הכנסת המשפחה</dt>
        <dd className="good">{nis(outcome.totalHouseholdMonthly)}</dd>
        {outcome.gapMonthly > 0 && (
          <>
            <dt>פער מול היעד</dt>
            <dd style={{ color: 'var(--danger)' }}>{nis(outcome.gapMonthly)}</dd>
          </>
        )}
      </dl>
      <p className="fixation-detail">
        הכנסה חודשית = השכר הממשיך של הנותר/ת בחיים + קצבת השארים והסכומים מתיק הנפטר/ת
        (כולל ביטוח לאומי).
      </p>
    </div>
  );
}

function toScenarioProduct(p: PortfolioProductInput) {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    currentBalance: p.currentBalance,
    insuredMonthlySalary: p.insuredMonthlySalary,
    frozen: p.frozen,
    survivorsPct: p.survivorsPct,
    disabilityPct: p.disabilityPct,
    survivorsWaiver: p.survivorsWaiver,
    deathBenefitAmount: p.deathBenefitAmount,
    beneficiaries: p.beneficiaries,
    umbrella: p.umbrella,
  };
}
