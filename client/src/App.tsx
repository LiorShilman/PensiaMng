import { useEffect, useState } from 'react';
import './App.css';
import {
  calcPortfolio,
  calcRetirement,
  calcScenarios,
  clearSession,
  getStoredUser,
  getToken,
  loadPortfolio,
  savePortfolio,
  UnauthorizedError,
  type AuthUser,
  type ClientProfile,
  type MaritalStatus,
  type PortfolioProductInput,
  type PortfolioResult,
  type PortfolioScenarioTotals,
  type ProductType,
  getTracks,
  type RetirementResult,
  type ScenariosResult,
  type TrackDef,
} from './api';
import { aiAnalyze } from './api';
import { AuthScreen } from './AuthScreen';
import { AiPanel } from './AiPanel';
import { FanChart } from './FanChart';
import { MoneyFlow } from './MoneyFlow';

// ---------- מטא-דאטה לסוגי מוצרים ----------

type IconKey = 'shield' | 'briefcase' | 'coins' | 'growth' | 'cap';

interface TypeMeta {
  label: string;
  short: string;
  isAnnuity: boolean;
  /** האם קיים רכיב כיסויים ביטוחיים */
  hasCoverage: boolean;
  /** תקרת דמי ניהול מהפקדה — 0 = אין רכיב כזה (השתלמות) */
  maxDepositFee: number;
  /** זהות ויזואלית: אייקון + גרדיאנט */
  icon: IconKey;
  accent: [string, string];
  defaults: {
    feeFromDepositPct: number;
    feeFromBalancePct: number;
    monthlyCoverageCost: number;
    conversionFactor?: number;
  };
}

const ICONS: Record<IconKey, React.ReactNode> = {
  shield: (
    <svg viewBox="0 0 24 24" className="ticon">
      <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  briefcase: (
    <svg viewBox="0 0 24 24" className="ticon">
      <rect x="3" y="8" width="18" height="11" rx="2" />
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  ),
  coins: (
    <svg viewBox="0 0 24 24" className="ticon">
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  ),
  growth: (
    <svg viewBox="0 0 24 24" className="ticon">
      <path d="M4 19h16" />
      <path d="M5 15l4-4 3 3 6-6" />
      <path d="M15 8h3v3" />
    </svg>
  ),
  cap: (
    <svg viewBox="0 0 24 24" className="ticon">
      <path d="M3 9l9-4 9 4-9 4z" />
      <path d="M7 11v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4" />
    </svg>
  ),
};

const TYPE_META: Record<ProductType, TypeMeta> = {
  PENSION_COMPREHENSIVE: {
    label: 'קרן פנסיה מקיפה',
    short: 'פנסיה מקיפה',
    isAnnuity: true,
    hasCoverage: true,
    maxDepositFee: 6,
    icon: 'shield',
    accent: ['#0284c7', '#4f46e5'],
    defaults: { feeFromDepositPct: 1.0, feeFromBalancePct: 0.22, monthlyCoverageCost: 100, conversionFactor: 200 },
  },
  PENSION_GENERAL: {
    label: 'קרן פנסיה משלימה',
    short: 'פנסיה משלימה',
    isAnnuity: true,
    hasCoverage: true,
    maxDepositFee: 6,
    icon: 'shield',
    accent: ['#0891b2', '#0284c7'],
    defaults: { feeFromDepositPct: 1.5, feeFromBalancePct: 0.3, monthlyCoverageCost: 0, conversionFactor: 200 },
  },
  MANAGERS_INSURANCE: {
    label: 'ביטוח מנהלים',
    short: 'ביטוח מנהלים',
    isAnnuity: true,
    hasCoverage: true,
    maxDepositFee: 4,
    icon: 'briefcase',
    accent: ['#6366f1', '#8b5cf6'],
    defaults: { feeFromDepositPct: 2.5, feeFromBalancePct: 1.0, monthlyCoverageCost: 150, conversionFactor: 190 },
  },
  PROVIDENT_FUND: {
    label: 'קופת גמל',
    short: 'קופת גמל',
    isAnnuity: true,
    hasCoverage: false,
    maxDepositFee: 4,
    icon: 'coins',
    accent: ['#7c3aed', '#a855f7'],
    defaults: { feeFromDepositPct: 0, feeFromBalancePct: 0.6, monthlyCoverageCost: 0, conversionFactor: 200 },
  },
  PROVIDENT_INVESTMENT: {
    label: 'קופת גמל להשקעה',
    short: 'גמל להשקעה',
    isAnnuity: false,
    hasCoverage: false,
    maxDepositFee: 4,
    icon: 'growth',
    accent: ['#c026d3', '#e879f9'],
    defaults: { feeFromDepositPct: 0, feeFromBalancePct: 0.7, monthlyCoverageCost: 0 },
  },
  IRA: {
    label: 'גמל בניהול אישי (IRA)',
    short: 'IRA',
    isAnnuity: false,
    hasCoverage: false,
    maxDepositFee: 4,
    icon: 'growth',
    accent: ['#475569', '#94a3b8'],
    defaults: { feeFromDepositPct: 0, feeFromBalancePct: 0.3, monthlyCoverageCost: 0 },
  },
  STUDY_FUND: {
    label: 'קרן השתלמות',
    short: 'השתלמות',
    isAnnuity: false,
    hasCoverage: false,
    maxDepositFee: 0,
    icon: 'cap',
    accent: ['#d97706', '#f59e0b'],
    defaults: { feeFromDepositPct: 0, feeFromBalancePct: 0.6, monthlyCoverageCost: 0 },
  },
};

const TYPE_ORDER: ProductType[] = [
  'PENSION_COMPREHENSIVE',
  'PENSION_GENERAL',
  'MANAGERS_INSURANCE',
  'PROVIDENT_FUND',
  'PROVIDENT_INVESTMENT',
  'IRA',
  'STUDY_FUND',
];

// ---------- עזרים ----------

const nis = (n: number) =>
  n.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });

/** "2052-01-01" → "01/2052" */
function formatMonthYear(isoDate: string): string {
  const [y, m] = isoDate.split('-');
  return `${m}/${y}`;
}

/** 306 חודשים → "25.5 שנים" / 8 → "8 חודשים" */
function monthsLabel(months: number): string {
  if (months < 12) return `${months} חודשים`;
  const years = months / 12;
  const rounded = Math.round(years * 10) / 10;
  return `${rounded} שנים`;
}

let idCounter = 0;
const nextId = () => `prod-${++idCounter}-${Date.now()}`;

function newProduct(type: ProductType): PortfolioProductInput {
  const meta = TYPE_META[type];
  return {
    id: nextId(),
    name: meta.label,
    type,
    currentBalance: 100_000,
    monthlyDeposit: 1_500,
    feeFromDepositPct: meta.defaults.feeFromDepositPct,
    feeFromBalancePct: meta.defaults.feeFromBalancePct,
    monthlyCoverageCost: meta.defaults.monthlyCoverageCost,
    conversionFactor: meta.defaults.conversionFactor,
    ...(INSURED_PENSION_TYPES.has(type)
      ? { survivorsPct: 100, disabilityPct: 75, survivorsWaiver: false }
      : {}),
    ...(type === 'MANAGERS_INSURANCE' ? { deathBenefitAmount: 0 } : {}),
    ...(type === 'STUDY_FUND'
      ? { joinDate: new Date().toISOString().slice(0, 10) }
      : {}),
  };
}

/** נזילות קרן השתלמות: 6 שנים מפתיחת הקרן */
function studyFundLiquidity(joinDate?: string): { liquid: boolean; at: string } | null {
  if (!joinDate) return null;
  const d = new Date(joinDate);
  if (isNaN(d.getTime())) return null;
  const at = new Date(d);
  at.setFullYear(at.getFullYear() + 6);
  return {
    liquid: at <= new Date(),
    at: `${String(at.getMonth() + 1).padStart(2, '0')}/${at.getFullYear()}`,
  };
}

interface Assumptions {
  annualReturnPct: number;
  annualSalaryGrowthPct: number;
  /** ריק = לפי הגיל החוקי */
  plannedRetirementAge?: number;
}

type ScenarioKey = 'pessimistic' | 'central' | 'optimistic';

const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  pessimistic: 'פסימי',
  central: 'מרכזי',
  optimistic: 'אופטימי',
};

const MARITAL_LABELS: Record<MaritalStatus, string> = {
  SINGLE: 'רווק/ה',
  MARRIED: 'נשוי/אה',
  COMMON_LAW: 'ידוע/ה בציבור',
  DIVORCED: 'גרוש/ה',
  WIDOWED: 'אלמן/ה',
};

/** האם יש בן/בת זוג לצורך קצבת שאירים */
const hasSpouse = (m?: MaritalStatus) => m === 'MARRIED' || m === 'COMMON_LAW';

/** סוגי מוצרים עם כיסוי ביטוחי מובנה (שאירים+נכות) */
const INSURED_PENSION_TYPES: ReadonlySet<ProductType> = new Set([
  'PENSION_COMPREHENSIVE',
  'PENSION_GENERAL',
]);

// ---------- קומפוננטה ראשית ----------

function App() {
  const [user, setUser] = useState<AuthUser | null>(() =>
    getToken() ? getStoredUser() : null,
  );
  const [assumptions, setAssumptions] = useState<Assumptions>({
    annualReturnPct: 3.74,
    annualSalaryGrowthPct: 1.5,
  });
  const [profile, setProfile] = useState<ClientProfile>({
    gender: 'MALE',
    birthDate: '1985-01-01',
    maritalStatus: 'SINGLE',
    insuredMonthlySalary: 0,
    children: [],
  });
  const [scenarios, setScenarios] = useState<ScenariosResult | null>(null);
  const [retirement, setRetirement] = useState<RetirementResult | null>(null);
  const [retirementError, setRetirementError] = useState<string | null>(null);
  const [products, setProducts] = useState<PortfolioProductInput[]>([]);
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [scenario, setScenario] = useState<ScenarioKey>('central');
  /** התוצאות המוצגות חושבו על נתונים ישנים — יש לחשב מחדש */
  const [stale, setStale] = useState(false);
  /** עיתוי האירוע בתרחישי הביטוח: 0 = היום, אחרת בעוד X שנים */
  const [eventOffsetYears, setEventOffsetYears] = useState(0);
  /** הגדרות מסלולי ההשקעה הסטנדרטיים — נטענות מהשרת */
  const [trackDefs, setTrackDefs] = useState<TrackDef[]>([]);
  /** מודול AI */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getTracks().then(setTrackDefs).catch(() => {});
  }, [user]);

  // טעינת התיק השמור בכניסה
  useEffect(() => {
    if (!user) return;
    loadPortfolio()
      .then((saved) => {
        if (saved.assumptions) {
          setAssumptions({
            annualReturnPct: saved.assumptions.annualReturnPct,
            annualSalaryGrowthPct: saved.assumptions.annualSalaryGrowthPct,
            plannedRetirementAge: saved.assumptions.plannedRetirementAge,
          });
        }
        if (saved.profile) setProfile(saved.profile);
        // תמיד משקפים את מה ששמור — גם תיק ריק נשאר ריק
        setProducts(saved.products);
      })
      .catch((e) => {
        if (e instanceof UnauthorizedError) logout();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // כל שינוי בקלטים אחרי שיש תוצאה — מסמן שהתוצאות התיישנו
  useEffect(() => {
    if (result || scenarios) setStale(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, assumptions, profile]);

  // חישוב גיל פרישה וחודשים עד פרישה — בכל שינוי של מין/תאריך לידה/גיל מתוכנן
  useEffect(() => {
    if (!user || !profile.birthDate) return;
    calcRetirement({
      gender: profile.gender,
      birthDate: profile.birthDate,
      plannedRetirementAge: assumptions.plannedRetirementAge,
    })
      .then((r) => {
        setRetirement(r);
        setRetirementError(null);
      })
      .catch((e) => {
        if (e instanceof UnauthorizedError) return logout();
        setRetirement(null);
        setRetirementError((e as Error).message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    profile.gender,
    profile.birthDate,
    assumptions.plannedRetirementAge,
  ]);

  function logout() {
    clearSession();
    setUser(null);
    setResult(null);
  }

  async function onSave() {
    setSaveState('saving');
    setError(null);
    try {
      const saved = await savePortfolio({ assumptions, profile, products });
      // המוצרים חוזרים עם מזהי DB קבועים — מעדכנים כדי שהשמירה הבאה תהיה עקבית
      setProducts(saved.products);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch (e) {
      if (e instanceof UnauthorizedError) return logout();
      setError((e as Error).message);
      setSaveState('idle');
    }
  }

  function addProduct(type: ProductType) {
    setProducts((ps) => [...ps, newProduct(type)]);
  }

  function removeProduct(id: string) {
    setProducts((ps) => ps.filter((p) => p.id !== id));
  }

  function updateProduct(id: string, patch: Partial<PortfolioProductInput>) {
    setProducts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  /** שנים עד פרישה (שלמות) — לפי חישוב גיל הפרישה */
  const yearsToRetirement = retirement
    ? Math.floor(retirement.monthsToRetirement / 12)
    : 0;

  /** בניית קלט תרחישי הביטוח — לפני הפרישה או אחריה */
  function scenariosInputFor(offsetYears: number, fromResult?: PortfolioResult | null) {
    const asOfDate = new Date();
    asOfDate.setFullYear(asOfDate.getFullYear() + offsetYears);
    const afterRetirement =
      retirement !== null && offsetYears * 12 > retirement.monthsToRetirement;

    return {
      family: {
        hasSpouse: hasSpouse(profile.maritalStatus),
        childrenBirthDates: (profile.children ?? []).map((c) => c.birthDate),
      },
      insuredMonthlySalary: profile.insuredMonthlySalary ?? 0,
      asOf: asOfDate.toISOString().slice(0, 10),
      ...(afterRetirement && retirement
        ? {
            retirementPhase: {
              monthsSinceRetirement: Math.max(
                0,
                offsetYears * 12 - retirement.monthsToRetirement,
              ),
            },
          }
        : {}),
      products: products.map((p) => {
        const proj = fromResult?.products.find((x) => x.id === p.id);
        // לפני פרישה: הצבירה מהתחזית לאותה נקודה; אחרי: הצבירה בפרישה + הקצבה
        let balance = p.currentBalance;
        if (offsetYears > 0 && proj && !afterRetirement) {
          const pt = proj.projection.central.series.find(
            (s) => s.month === offsetYears * 12,
          );
          if (pt) balance = pt.balance;
        }
        const lastPoint = proj?.projection.central.series.at(-1);
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          currentBalance: balance,
          insuredMonthlySalary: p.insuredMonthlySalary,
          frozen: p.frozen,
          survivorsPct: p.survivorsPct,
          disabilityPct: p.disabilityPct,
          survivorsWaiver: p.survivorsWaiver,
          deathBenefitAmount: p.deathBenefitAmount,
          beneficiaries: p.beneficiaries,
          ...(afterRetirement
            ? {
                monthlyAnnuity: proj?.monthlyAnnuity?.central ?? 0,
                balanceAtRetirement: lastPoint?.balance ?? p.currentBalance,
              }
            : {}),
        };
      }),
    };
  }

  // שינוי עיתוי האירוע — חישוב תרחישים מחדש (עם debounce לגרירת סליידר)
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => {
      calcScenarios(scenariosInputFor(eventOffsetYears, result))
        .then(setScenarios)
        .catch((e) => {
          if (e instanceof UnauthorizedError) return logout();
          setError((e as Error).message);
        });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventOffsetYears]);

  /** בניית הקשר אנונימי לניתוח AI — בלי שם, אימייל או ת"ז; ילדים כגילאים בלבד */
  function buildAiContext() {
    const now = new Date();
    const age = Math.floor(
      (now.getTime() - new Date(profile.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000),
    );
    return {
      פרופיל: {
        מין: profile.gender === 'MALE' ? 'זכר' : 'נקבה',
        גיל: age,
        מצב_משפחתי: MARITAL_LABELS[profile.maritalStatus ?? 'SINGLE'],
        שכר_חודשי_מבוטח: profile.insuredMonthlySalary ?? 0,
        גילאי_ילדים: (profile.children ?? []).map((c) =>
          Math.floor(
            (now.getTime() - new Date(c.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000),
          ),
        ),
      },
      פרישה: retirement
        ? {
            גיל_פרישה: retirement.legalRetirementAgeLabel,
            שנים_עד_פרישה: Math.round((retirement.monthsToRetirement / 12) * 10) / 10,
          }
        : null,
      הנחות: {
        תשואה_ריאלית_שנתית_אחוז: assumptions.annualReturnPct,
        עליית_שכר_שנתית_אחוז: assumptions.annualSalaryGrowthPct,
      },
      מוצרים: products.map((p) => ({
        שם: p.name,
        סוג: TYPE_META[p.type].label,
        יתרה_צבורה: p.currentBalance,
        הפקדה_חודשית: p.monthlyDeposit,
        דמי_ניהול_מהפקדה_אחוז: p.feeFromDepositPct,
        דמי_ניהול_מצבירה_אחוז: p.feeFromBalancePct,
        עלות_כיסויים_חודשית: p.monthlyCoverageCost,
        לא_פעילה: p.frozen ?? false,
        מסלולי_השקעה: p.tracks ?? [],
        שכר_מבוטח_בקרן: p.insuredMonthlySalary,
      })),
      תחזית_לפרישה: result
        ? {
            מרכזי: {
              סך_צבירה: result.totals.central.totalBalance,
              קצבה_חודשית: result.totals.central.totalMonthlyAnnuity,
              הון_נזיל: result.totals.central.totalLumpSum,
              סך_דמי_ניהול: result.totals.central.totalFeesPaid,
              שיעור_תחלופה_אחוז: result.totals.central.replacementRatePct,
            },
            פסימי_סך_צבירה: result.totals.pessimistic.totalBalance,
            אופטימי_סך_צבירה: result.totals.optimistic.totalBalance,
            פירוט_דמי_ניהול_לפי_מוצר: result.products.map((p) => ({
              שם: p.name,
              דמי_ניהול_עד_פרישה: p.projection.central.totalFeesPaid,
            })),
          }
        : null,
      תרחישי_ביטוח_מצב_היום: scenarios
        ? {
            מוות: {
              קצבת_שאירים_חודשית: scenarios.death.totalSurvivorMonthly,
              סכומים_חד_פעמיים: scenarios.death.totalLumpSum,
              יעד_חודשי: scenarios.death.targetMonthly,
              פער: scenarios.death.gapMonthly,
            },
            נכות: {
              קצבה_חודשית_בפועל: scenarios.disability.totalDisabilityMonthly,
              כיסוי_עודף_שלא_ניתן_לממש: scenarios.disability.excessMonthly,
              פער: scenarios.disability.gapMonthly,
            },
            אזהרות_המערכת: scenarios.warnings,
          }
        : null,
    };
  }

  async function onAiAnalyze() {
    setAiBusy(true);
    setAiError(null);
    try {
      const r = await aiAnalyze(buildAiContext());
      setAiText(r.text);
      setAiMeta(`${r.provider === 'anthropic' ? 'Claude' : 'ChatGPT'} · ${r.model}`);
    } catch (e) {
      if (e instanceof UnauthorizedError) return logout();
      setAiError((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  async function onCalculate() {
    if (!retirement || retirement.monthsToRetirement === 0) {
      setError(
        retirement?.alreadyEligible
          ? 'לפי תאריך הלידה כבר הגעת לגיל הפרישה — אין תקופת צבירה לחישוב'
          : 'יש להזין תאריך לידה תקין לפני החישוב',
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [r, s] = await Promise.all([
        calcPortfolio({
          months: retirement.monthsToRetirement,
          annualReturnPct: assumptions.annualReturnPct,
          annualSalaryGrowthPct: assumptions.annualSalaryGrowthPct,
          insuredMonthlySalary: profile.insuredMonthlySalary,
          // המנוע מצפה ל-trackAllocations; אצלנו השדה נקרא tracks (כמו בשמירה)
          products: products.map((p) => ({ ...p, trackAllocations: p.tracks })),
        }),
        calcScenarios(scenariosInputFor(0)),
      ]);
      setResult(r);
      setScenarios(s);
      setEventOffsetYears(0);
      setStale(false);
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
      setScenarios(null);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return <AuthScreen onAuthed={setUser} />;
  }

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden="true" />

      <header className="header">
        <div className="header-top">
          <div className="logo-row">
            <div className="logo-mark">₪</div>
            <h1 className="logo-text">PensiaMng</h1>
          </div>
          <div className="user-bar">
            <button
              className={`ai-toggle ${aiConfigured ? 'configured' : ''}`}
              onClick={() => setAiOpen((v) => !v)}
              title="הגדרות AI"
            >
              🤖 AI
            </button>
            <span className="user-name">{user.fullName}</span>
            <button className="logout-btn" onClick={logout}>
              התנתק
            </button>
          </div>
        </div>
        <p className="subtitle">תכנון פנסיה מקצועי — בניית תיק, הקרנת צבירה ותחזית קצבה</p>
      </header>

      {aiOpen && (
        <AiPanel onConfigured={setAiConfigured} onClose={() => setAiOpen(false)} />
      )}

      <section className="card assumptions">
        <h2 className="card-title">הנחות התכנון</h2>
        <div className="assumptions-grid">
          <label className="field">
            <span>מין</span>
            <select
              className="field-select"
              value={profile.gender}
              onChange={(e) =>
                setProfile((p) => ({ ...p, gender: e.target.value as 'MALE' | 'FEMALE' }))
              }
            >
              <option value="MALE">זכר</option>
              <option value="FEMALE">נקבה</option>
            </select>
          </label>
          <label className="field">
            <span>תאריך לידה</span>
            <input
              type="date"
              value={profile.birthDate}
              onChange={(e) => setProfile((p) => ({ ...p, birthDate: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>גיל פרישה (ריק = לפי חוק)</span>
            <input
              type="number"
              min={60}
              max={75}
              placeholder={retirement?.legalRetirementAgeLabel ?? ''}
              value={assumptions.plannedRetirementAge ?? ''}
              onChange={(e) =>
                setAssumptions((a) => ({
                  ...a,
                  plannedRetirementAge:
                    e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
            />
          </label>
          <Field
            label="תשואה שנתית ריאלית"
            unit="%"
            value={assumptions.annualReturnPct}
            step={0.01}
            onChange={(v) => setAssumptions((a) => ({ ...a, annualReturnPct: v }))}
            tooltip="תשואה שנתית ממוצעת אחרי ניכוי אינפלציה. 3.74% היא הנחת התקנון למסלול תלוי-גיל; למסלול מנייתי מקובל להניח יותר, בסיכון גבוה יותר."
          />
          <Field
            label="עליית שכר שנתית"
            unit="%"
            value={assumptions.annualSalaryGrowthPct}
            step={0.1}
            onChange={(v) => setAssumptions((a) => ({ ...a, annualSalaryGrowthPct: v }))}
            tooltip="קצב עליית השכר הריאלי שלך לאורך הקריירה — ההפקדות החודשיות גדלות בהתאם. 1-2% הוא טווח שמרני מקובל."
          />
        </div>

        {retirement && (
          <p className={`retirement-line ${retirement.alreadyEligible ? 'warn' : ''}`}>
            {retirement.alreadyEligible ? (
              <>לפי תאריך הלידה — כבר בגיל פרישה</>
            ) : (
              <>
                גיל פרישה חוקי: <strong>{retirement.legalRetirementAgeLabel}</strong>
                {' · '}פרישה צפויה: <strong>{formatMonthYear(retirement.retirementDate)}</strong>
                {' · '}נותרו: <strong>{monthsLabel(retirement.monthsToRetirement)}</strong>
              </>
            )}
          </p>
        )}
        {retirementError && <div className="error">{retirementError}</div>}

        <h3 className="sub-title">משפחה וכיסוי ביטוחי <span className="sub-hint">(לתרחישי מוות ונכות)</span></h3>
        <div className="assumptions-grid">
          <label className="field">
            <span>מצב משפחתי</span>
            <select
              className="field-select"
              value={profile.maritalStatus ?? 'SINGLE'}
              onChange={(e) =>
                setProfile((p) => ({ ...p, maritalStatus: e.target.value as MaritalStatus }))
              }
            >
              {(Object.keys(MARITAL_LABELS) as MaritalStatus[]).map((m) => (
                <option key={m} value={m}>
                  {MARITAL_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <MoneyField
            label="שכר חודשי מבוטח"
            value={profile.insuredMonthlySalary ?? 0}
            onChange={(v) => setProfile((p) => ({ ...p, insuredMonthlySalary: v }))}
            tooltip="השכר שממנו מחושבות קצבאות שאירים ונכות, ובסיס יעד ההכנסה למשפחה. משמש כברירת מחדל לכל הקרנות; אם לקרן מסוימת שכר קובע שונה — הזן אותו בכרטיס הקרן והוא יגבר. איפה למצוא: תלוש השכר או 'שכר קובע' בדוח השנתי."
          />
        </div>

        <div className="children-row">
          <span className="children-label">
            ילדים
            <span className="tip" data-tip="לקצבת שאירים: יתום זכאי עד גיל 21. הזן את תאריכי הלידה של הילדים." tabIndex={0}>ⓘ</span>
          </span>
          {(profile.children ?? []).map((c, i) => (
            <span key={i} className="child-chip">
              <input
                type="date"
                value={c.birthDate}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    children: (p.children ?? []).map((cc, ii) =>
                      ii === i ? { ...cc, birthDate: e.target.value } : cc,
                    ),
                  }))
                }
              />
              <button
                className="chip-remove"
                title="הסר ילד"
                onClick={() =>
                  setProfile((p) => ({
                    ...p,
                    children: (p.children ?? []).filter((_, ii) => ii !== i),
                  }))
                }
              >
                ✕
              </button>
            </span>
          ))}
          <button
            className="add-chip"
            onClick={() =>
              setProfile((p) => ({
                ...p,
                children: [...(p.children ?? []), { birthDate: '2015-01-01' }],
              }))
            }
          >
            + הוסף ילד
          </button>
        </div>

        <p className="hint">כל תוצאה מוצגת בשלושה תרחישים: פסימי (−1.5%), מרכזי, אופטימי (+1.5%)</p>
      </section>

      <section className="portfolio-section">
        <div className="section-head">
          <h2>התיק הפנסיוני שלי <span className="count-badge">{products.length}</span></h2>
        </div>

        {products.length > 0 && (
          <div className="summary-strip">
            <div className="summary-tile">
              <div className="summary-value gold">
                {nis(products.reduce((s, p) => s + p.currentBalance, 0))}
              </div>
              <div className="summary-label">סך צבירה כיום</div>
            </div>
            <div className="summary-tile">
              <div className="summary-value">
                {nis(products.filter((p) => !p.frozen).reduce((s, p) => s + p.monthlyDeposit, 0))}
              </div>
              <div className="summary-label">הפקדה חודשית</div>
            </div>
            <div className="summary-tile">
              <div className="summary-value">{products.filter((p) => !p.frozen).length}</div>
              <div className="summary-label">מוצרים פעילים</div>
            </div>
            {products.some((p) => p.frozen) && (
              <div className="summary-tile">
                <div className="summary-value muted">
                  {products.filter((p) => p.frozen).length}
                </div>
                <div className="summary-label">קרנות לא פעילות</div>
              </div>
            )}
          </div>
        )}

        {products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗂️</div>
            <p>התיק ריק — הוסף את המוצר הפנסיוני הראשון שלך מהכפתורים למטה</p>
          </div>
        ) : (
          <div className="products-grid">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                trackDefs={trackDefs}
                globalReturnPct={assumptions.annualReturnPct}
                onChange={(patch) => updateProduct(p.id, patch)}
                onRemove={() => removeProduct(p.id)}
              />
            ))}
          </div>
        )}

        <div className="add-row">
          <span className="add-label">הוסף מוצר:</span>
          {TYPE_ORDER.map((t) => (
            <button key={t} className="add-chip" onClick={() => addProduct(t)}>
              + {TYPE_META[t].short}
            </button>
          ))}
        </div>

        <div className="calc-row">
          <button
            className="calc-btn"
            onClick={onCalculate}
            disabled={loading || products.length === 0}
          >
            {loading ? 'מחשב את התיק…' : 'חשב תחזית לתיק'}
          </button>
          <button
            className="save-btn"
            onClick={onSave}
            disabled={saveState === 'saving'}
          >
            {saveState === 'saving'
              ? 'שומר…'
              : saveState === 'saved'
                ? '✓ נשמר'
                : 'שמור תיק'}
          </button>
          {error && <div className="error">{error}</div>}
        </div>
      </section>

      {result && (
        <section className={`results ${stale ? 'stale' : ''}`}>
          {stale && (
            <div className="stale-banner">
              ⚠ הנתונים השתנו מאז החישוב האחרון — התוצאות למטה אינן מעודכנות.{' '}
              <button className="stale-recalc" onClick={onCalculate} disabled={loading}>
                חשב מחדש עכשיו
              </button>
            </div>
          )}
          <h2 className="results-title">תחזית לפרישה — התיק המלא</h2>

          <div className="totals-grid">
            {(['pessimistic', 'central', 'optimistic'] as ScenarioKey[]).map((key) => (
              <TotalsCard
                key={key}
                title={SCENARIO_LABELS[key]}
                tone={key}
                t={result.totals[key]}
                returnPct={
                  assumptions.annualReturnPct +
                  (key === 'pessimistic' ? -1.5 : key === 'optimistic' ? 1.5 : 0)
                }
                highlight={scenario === key}
                onSelect={() => setScenario(key)}
              />
            ))}
          </div>

          <div className="card chart-card">
            <h3 className="card-title">מסלול הצבירה עד הפרישה</h3>
            <FanChart
              pessimistic={result.totals.pessimistic.series}
              central={result.totals.central.series}
              optimistic={result.totals.optimistic.series}
            />
          </div>

          <div className="card breakdown">
            <div className="breakdown-head">
              <h3 className="card-title">פירוט לפי מוצר</h3>
              <div className="scenario-switch" role="tablist">
                {(['pessimistic', 'central', 'optimistic'] as ScenarioKey[]).map((key) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={scenario === key}
                    className={`scenario-tab ${key} ${scenario === key ? 'active' : ''}`}
                    onClick={() => setScenario(key)}
                  >
                    {SCENARIO_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>מוצר</th>
                    <th>סוג</th>
                    <th>צבירה בפרישה</th>
                    <th>אופן משיכה</th>
                    <th>דמי ניהול ששולמו</th>
                  </tr>
                </thead>
                <tbody>
                  {result.products.map((p) => (
                    <tr key={p.id}>
                      <td className="prod-name">{p.name}</td>
                      <td>
                        <span className={`type-pill ${p.isAnnuity ? 'annuity' : 'capital'}`}>
                          {TYPE_META[p.type].short}
                        </span>
                        {products.find((x) => x.id === p.id)?.frozen && (
                          <span className="type-pill frozen">לא פעילה</span>
                        )}
                      </td>
                      <td className="num">{nis(p.projection[scenario].finalBalance)}</td>
                      <td className="num">
                        {p.isAnnuity && p.monthlyAnnuity
                          ? `קצבה ${nis(p.monthlyAnnuity[scenario])} לחודש`
                          : 'הון חד־פעמי'}
                      </td>
                      <td className="num fees">{nis(p.projection[scenario].totalFeesPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button className="trace-toggle" onClick={() => setShowTrace((v) => !v)}>
            {showTrace ? 'הסתר את פירוט החישוב' : 'איך חושב? הצג עקבות חישוב'}
          </button>
          {showTrace && (
            <div className="trace card">
              <code>{result.trace.formula}</code>
              <ul>
                {result.trace.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {scenarios && (
        <section className="results">
          <div className="whatif-head">
            <h2 className="results-title">מה אם? — תרחישי ביטוח</h2>
            {result && retirement && (
              <div className="timing-row">
                <span className="timing-label">מתי האירוע?</span>
                <input
                  type="range"
                  className="timing-slider"
                  min={0}
                  max={yearsToRetirement + 25}
                  step={1}
                  value={eventOffsetYears}
                  onChange={(e) => setEventOffsetYears(Number(e.target.value))}
                />
                <span
                  className={`timing-value ${eventOffsetYears * 12 > retirement.monthsToRetirement ? 'post' : ''}`}
                >
                  {eventOffsetYears === 0
                    ? 'היום'
                    : eventOffsetYears * 12 > retirement.monthsToRetirement
                      ? `בפנסיה · בעוד ${eventOffsetYears} שנים (${new Date().getFullYear() + eventOffsetYears})`
                      : `בעוד ${eventOffsetYears} שנים (${new Date().getFullYear() + eventOffsetYears})`}
                </span>
              </div>
            )}
          </div>
          {eventOffsetYears > 0 &&
            retirement &&
            (eventOffsetYears * 12 > retirement.monthsToRetirement ? (
              <p className="timing-note">
                שלב הפרישה: קצבת שאיר לבן/בת הזוג היא אחוז מהקצבה (60% ברירת מחדל, לפי
                מסלול הקצבה); ללא בן/בת זוג — יתרת הבטחת התשלומים (240) ליורשים; ההון
                מוצג בשוויו בפרישה.
              </p>
            ) : (
              <p className="timing-note">
                הצבירות נלקחות מהתחזית (תרחיש מרכזי) לנקודת הזמן שנבחרה; גילאי הילדים
                מוקדמים בהתאם — יתום מעל גיל 21 כבר אינו זכאי.
              </p>
            ))}

          {scenarios.warnings.length > 0 && (
            <div className="warnings">
              {scenarios.warnings.map((w, i) => (
                <div key={i} className="warning-item">⚠ {w}</div>
              ))}
            </div>
          )}

          <div className="scenarios-grid">
            <div className="card scenario-card death">
              <h3 className="card-title">חלילה — מקרה מוות</h3>
              <div className="scenario-totals">
                <div className="scenario-stat">
                  <div className="stat-value">{nis(scenarios.death.totalSurvivorMonthly)}</div>
                  <div className="stat-label">קצבת שאירים חודשית למשפחה</div>
                </div>
                <div className="scenario-stat">
                  <div className="stat-value">{nis(scenarios.death.totalLumpSum)}</div>
                  <div className="stat-label">סכומים חד-פעמיים למוטבים</div>
                </div>
              </div>
              <GapBar
                actual={scenarios.death.totalSurvivorMonthly}
                target={scenarios.death.targetMonthly}
                gap={scenarios.death.gapMonthly}
              />
              <ul className="scenario-details">
                {scenarios.death.products.map((p) => (
                  <li key={p.id}>
                    <strong>{p.name}:</strong>{' '}
                    {p.survivorMonthly > 0 && `${nis(p.survivorMonthly)} לחודש · `}
                    {p.lumpSum > 0 && `${nis(p.lumpSum)} חד-פעמי · `}
                    {p.detail}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card scenario-card disability">
              <h3 className="card-title">אובדן כושר עבודה (נכות)</h3>
              <div className="scenario-totals">
                <div className="scenario-stat">
                  <div className="stat-value">{nis(scenarios.disability.totalDisabilityMonthly)}</div>
                  <div className="stat-label">
                    קצבת נכות חודשית
                    {scenarios.disability.excessMonthly > 0 && ' (לאחר תקרת 75%)'}
                  </div>
                </div>
                {scenarios.disability.excessMonthly > 0 && (
                  <div className="scenario-stat">
                    <div className="stat-value excess">
                      {nis(scenarios.disability.excessMonthly)}
                    </div>
                    <div className="stat-label">כיסוי עודף שלא ניתן לממש</div>
                  </div>
                )}
              </div>
              <GapBar
                actual={scenarios.disability.totalDisabilityMonthly}
                target={scenarios.disability.targetMonthly}
                gap={scenarios.disability.gapMonthly}
              />
              <ul className="scenario-details">
                {scenarios.disability.products.map((p) => (
                  <li key={p.id}>
                    <strong>{p.name}:</strong>{' '}
                    {p.disabilityMonthly > 0 && `${nis(p.disabilityMonthly)} לחודש · `}
                    {p.detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card flow-card">
            <h3 className="card-title">לאן הולך הכסף? — מפת הזרימה במקרה מוות</h3>
            <MoneyFlow
              products={scenarios.death.products}
              colorOf={(id) => {
                const t = products.find((x) => x.id === id)?.type;
                return t ? TYPE_META[t].accent[0] : '#64748b';
              }}
            />
          </div>
        </section>
      )}

      {result && (
        <section className="results ai-section">
          <div className="whatif-head">
            <h2 className="results-title">🤖 ניתוח והמלצות AI</h2>
            <button
              className="calc-btn ai-analyze-btn"
              onClick={aiConfigured ? onAiAnalyze : () => setAiOpen(true)}
              disabled={aiBusy}
            >
              {aiBusy
                ? 'מנתח את התיק… (עד דקה)'
                : aiConfigured
                  ? aiText
                    ? 'נתח שוב'
                    : 'נתח את התיק שלי'
                  : 'הגדר AI כדי להתחיל'}
            </button>
          </div>
          {aiError && <div className="error">{aiError}</div>}
          {aiText && (
            <div className="card ai-result">
              {aiMeta && <div className="ai-meta">{aiMeta}</div>}
              <AiMarkdown text={aiText} />
            </div>
          )}
          {!aiText && !aiBusy && (
            <p className="hint">
              הניתוח נשלח לספק ה-AI שהגדרת עם נתוני התיק בלבד (ללא פרטים מזהים), ומחזיר
              תובנות, סיכונים והמלצות פעולה. המספרים עצמם מחושבים תמיד במנוע המערכת — ה-AI
              רק מפרש.
            </p>
          )}
        </section>
      )}

      <footer className="footer">
        המערכת מיועדת להמחשה ותכנון בלבד ואינה מהווה ייעוץ פנסיוני כהגדרתו בחוק.
      </footer>
    </div>
  );
}

// ---------- כרטיס מוצר ----------

/** תשואה אפקטיבית משוקללת לפי מסלולים; null אם ההקצאה לא חוקית (>100%) */
function effectiveReturnPct(
  tracks: { category: string; pct: number }[] | undefined,
  defs: TrackDef[],
  fallback: number,
): number | null {
  const valid = (tracks ?? []).filter((t) => t.pct > 0);
  if (valid.length === 0) return null;
  const total = valid.reduce((s, t) => s + t.pct, 0);
  if (total > 100) return null;
  let w = valid.reduce(
    (s, t) =>
      s + ((defs.find((d) => d.category === t.category)?.realReturnPct ?? fallback) * t.pct) / 100,
    0,
  );
  w += (fallback * (100 - total)) / 100;
  return Math.round(w * 100) / 100;
}

function ProductCard(props: {
  product: PortfolioProductInput;
  trackDefs: TrackDef[];
  globalReturnPct: number;
  onChange: (patch: Partial<PortfolioProductInput>) => void;
  onRemove: () => void;
}) {
  const { product: p, trackDefs, globalReturnPct, onChange, onRemove } = props;
  const meta = TYPE_META[p.type];
  const effReturn = effectiveReturnPct(p.tracks, trackDefs, globalReturnPct);
  const tracksTotal = (p.tracks ?? []).reduce((s, t) => s + t.pct, 0);

  function changeType(type: ProductType) {
    const m = TYPE_META[type];
    onChange({
      type,
      name: m.label,
      feeFromDepositPct: m.defaults.feeFromDepositPct,
      feeFromBalancePct: m.defaults.feeFromBalancePct,
      monthlyCoverageCost: m.defaults.monthlyCoverageCost,
      conversionFactor: m.defaults.conversionFactor,
    });
  }

  const canFreeze = INSURED_PENSION_TYPES.has(p.type) || p.type === 'MANAGERS_INSURANCE';

  return (
    <div
      className={`card product-card ${meta.isAnnuity ? 'annuity' : 'capital'} ${p.frozen ? 'frozen' : ''}`}
      style={
        p.frozen
          ? undefined
          : { borderTopColor: meta.accent[0] }
      }
    >
      <div className="product-head">
        <div
          className="type-icon"
          style={{
            background: p.frozen
              ? 'linear-gradient(135deg, #475569, #64748b)'
              : `linear-gradient(135deg, ${meta.accent[0]}, ${meta.accent[1]})`,
          }}
        >
          {ICONS[meta.icon]}
        </div>
        <select
          className="type-select"
          value={p.type}
          onChange={(e) => changeType(e.target.value as ProductType)}
        >
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].label}
            </option>
          ))}
        </select>
        {p.frozen ? (
          <span className="type-pill frozen">לא פעילה</span>
        ) : (
          <span className={`type-pill ${meta.isAnnuity ? 'annuity' : 'capital'}`}>
            {meta.isAnnuity ? 'קצבתי' : 'הוני'}
          </span>
        )}
        {p.type === 'STUDY_FUND' &&
          (() => {
            const liq = studyFundLiquidity(p.joinDate);
            if (!liq) return null;
            return liq.liquid ? (
              <span className="type-pill liquid">נזילה ✓</span>
            ) : (
              <span className="type-pill locked">נזילה ב-{liq.at}</span>
            );
          })()}
        <button className="remove-btn" onClick={onRemove} title="הסר מוצר">
          ✕
        </button>
      </div>

      <input
        className="name-input"
        value={p.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="שם המוצר / הגוף המנהל"
      />

      <div className="product-fields">
        <MoneyField
          label="יתרה צבורה"
          value={p.currentBalance}
          onChange={(v) => onChange({ currentBalance: v })}
          tooltip="הסכום שנצבר בחשבון עד היום. איפה למצוא: הדוח השנתי/רבעוני של הקרן, האזור האישי באתר הגוף המנהל, או אתר 'הר הכסף'."
        />
        {!p.frozen && (
          <MoneyField
            label="הפקדה חודשית"
            value={p.monthlyDeposit}
            onChange={(v) => onChange({ monthlyDeposit: v })}
            tooltip="סך ההפקדה החודשית — עובד + מעסיק + פיצויים יחד. איפה למצוא: תלוש השכר (סעיפי הפרשות) או פירוט ההפקדות בדוח השנתי."
          />
        )}
        {meta.maxDepositFee > 0 && (
          <Field
            label={`ד"נ מהפקדה (עד ${meta.maxDepositFee})`}
            unit="%"
            value={p.feeFromDepositPct}
            step={0.01}
            onChange={(v) => onChange({ feeFromDepositPct: v })}
            tooltip="אחוז שנגבה מכל הפקדה חדשה לפני שהיא נכנסת לחיסכון. איפה למצוא: הדוח השנתי, סעיף 'דמי ניהול מהפקדות'."
          />
        )}
        <Field
          label='ד"נ מצבירה (שנתי)'
          unit="%"
          value={p.feeFromBalancePct}
          step={0.001}
          onChange={(v) => onChange({ feeFromBalancePct: v })}
          tooltip="אחוז שנתי שנגבה מכלל היתרה הצבורה. איפה למצוא: הדוח השנתי, סעיף 'דמי ניהול מצבירה' — נקוב בדיוק של עד 3 ספרות (למשל 0.145%)."
        />
        {meta.hasCoverage && !p.frozen && (
          <MoneyField
            label="עלות כיסויים לחודש"
            value={p.monthlyCoverageCost}
            onChange={(v) => onChange({ monthlyCoverageCost: v })}
            tooltip="עלות הביטוח המובנה בקרן — כיסוי נכות (אובדן כושר עבודה) וכיסוי שאירים — שנגבית מהחשבון מדי חודש. איפה למצוא: הדוח השנתי, סעיף 'עלות כיסויים ביטוחיים'. אם ויתרת על כיסויים — השאר 0."
          />
        )}
        {meta.isAnnuity && (
          <Field
            label="מקדם המרה"
            value={p.conversionFactor ?? 200}
            step={0.1}
            onChange={(v) => onChange({ conversionFactor: v })}
            tooltip="המספר שבו מחלקים את הצבירה כדי לקבל קצבה חודשית (למשל: 1,000,000 ÷ 200 = 5,000 ₪). טווח טיפוסי: 180–210. איפה למצוא: תקנון הקרן או מסמך מסלול הקצבה; בביטוח מנהלים ותיק — המקדם המובטח שבפוליסה."
          />
        )}
        {INSURED_PENSION_TYPES.has(p.type) && !p.frozen && (
          <MoneyField
            label="שכר מבוטח בקרן"
            value={p.insuredMonthlySalary ?? 0}
            onChange={(v) => onChange({ insuredMonthlySalary: v === 0 ? undefined : v })}
            tooltip='"השכר הקובע" של הקרן הזו — הבסיס לקצבאות שאירים ונכות שלה. חשוב כשיש כמה קרנות (למשל קרן ישנה עם שכר קובע נמוך). ריק/0 = לפי השכר המבוטח הכללי שבפרופיל. איפה למצוא: הדוח השנתי של הקרן, "שכר קובע" או "שכר מבוטח".'
          />
        )}
        {INSURED_PENSION_TYPES.has(p.type) && !p.survivorsWaiver && !p.frozen && (
          <>
            <Field
              label="כיסוי שאירים"
              unit="%"
              value={p.survivorsPct ?? 100}
              onChange={(v) => onChange({ survivorsPct: v })}
              tooltip="שיעור השכר המכוסה לקצבת שאירים לפי מסלול הביטוח בקרן. ברירת מחדל: 100%. איפה למצוא: הדוח השנתי, סעיף 'מסלול ביטוח' או 'כיסויים ביטוחיים'."
            />
            <Field
              label="כיסוי נכות"
              unit="%"
              value={p.disabilityPct ?? 75}
              onChange={(v) => onChange({ disabilityPct: v })}
              tooltip="שיעור השכר שתקבל כקצבת נכות במקרה של אובדן כושר עבודה. ברירת מחדל: 75% (המקסימום). איפה למצוא: הדוח השנתי, סעיף 'מסלול ביטוח'."
            />
          </>
        )}
        {p.type === 'STUDY_FUND' && (
          <label className="field">
            <FieldLabel
              label="תאריך פתיחת הקרן"
              tooltip="לחישוב ותק ונזילות: קרן השתלמות ניתנת למשיכה בפטור ממס אחרי 6 שנים מהפתיחה (או 3 שנים בגיל פרישה). איפה למצוא: הדוח השנתי — 'תאריך הצטרפות'."
            />
            <input
              type="date"
              value={p.joinDate ?? ''}
              onChange={(e) => onChange({ joinDate: e.target.value })}
            />
          </label>
        )}
        {p.type === 'MANAGERS_INSURANCE' && !p.frozen && (
          <MoneyField
            label="סכום ביטוח למקרה מוות"
            value={p.deathBenefitAmount ?? 0}
            onChange={(v) => onChange({ deathBenefitAmount: v })}
            tooltip="סכום חד-פעמי שמשולם למוטבים במקרה מוות (ריסק), בנוסף לצבירה. איפה למצוא: דף פרטי הביטוח בפוליסה או הדוח השנתי. אם אין רכיב ריסק — השאר 0."
          />
        )}
      </div>
      <div className="bens">
        <span className="bens-label">
          מסלולי השקעה
          <span
            className="tip"
            data-tip="באיזה מסלול מושקעת הצבירה — קובע את הנחת התשואה של המוצר לפי ממוצעים סטנדרטיים למסלול. אפשר לשלב (למשל 70% מנייתי + 30% אג״ח). ריק = הנחת התשואה הכללית. איפה למצוא: הדוח השנתי או האזור האישי."
            tabIndex={0}
          >
            ⓘ
          </span>
        </span>
        {(p.tracks ?? []).map((t, i) => (
          <span key={i} className="ben-chip">
            <select
              className="chip-select"
              value={t.category}
              onChange={(e) =>
                onChange({
                  tracks: (p.tracks ?? []).map((tt, ii) =>
                    ii === i ? { ...tt, category: e.target.value } : tt,
                  ),
                })
              }
            >
              {trackDefs.map((d) => (
                <option key={d.category} value={d.category}>
                  {d.label} ({d.realReturnPct}%)
                </option>
              ))}
            </select>
            <input
              type="number"
              className="ben-pct"
              min={0}
              max={100}
              value={t.pct}
              onChange={(e) =>
                onChange({
                  tracks: (p.tracks ?? []).map((tt, ii) =>
                    ii === i ? { ...tt, pct: Number(e.target.value) } : tt,
                  ),
                })
              }
            />
            <span className="ben-unit">%</span>
            <button
              className="chip-remove"
              title="הסר מסלול"
              onClick={() =>
                onChange({ tracks: (p.tracks ?? []).filter((_, ii) => ii !== i) })
              }
            >
              ✕
            </button>
          </span>
        ))}
        <button
          className="add-chip small"
          onClick={() =>
            onChange({
              tracks: [
                ...(p.tracks ?? []),
                {
                  category: 'EQUITY',
                  pct: Math.max(0, 100 - tracksTotal),
                },
              ],
            })
          }
        >
          + מסלול
        </button>
        {tracksTotal > 100 && (
          <span className="tracks-warn">סך המסלולים מעל 100%</span>
        )}
        {effReturn !== null && tracksTotal <= 100 && (
          <span className="tracks-eff">תשואה אפקטיבית: {effReturn}%</span>
        )}
      </div>

      <div className="bens">
        <span className="bens-label">
          מוטבים
          <span
            className="tip"
            data-tip="מי מקבל את הכסף במקרה מוות (סכומים חד-פעמיים). ריק = יורשים על פי דין. חשוב לעדכן אחרי גירושין/נישואין! איפה לבדוק: טופס המוטבים באזור האישי של הגוף המנהל."
            tabIndex={0}
          >
            ⓘ
          </span>
        </span>
        {(p.beneficiaries ?? []).map((b, i) => (
          <span key={i} className="ben-chip">
            <input
              type="text"
              placeholder="שם"
              value={b.name}
              onChange={(e) =>
                onChange({
                  beneficiaries: (p.beneficiaries ?? []).map((bb, ii) =>
                    ii === i ? { ...bb, name: e.target.value } : bb,
                  ),
                })
              }
            />
            <input
              type="number"
              className="ben-pct"
              min={0}
              max={100}
              value={b.pct}
              onChange={(e) =>
                onChange({
                  beneficiaries: (p.beneficiaries ?? []).map((bb, ii) =>
                    ii === i ? { ...bb, pct: Number(e.target.value) } : bb,
                  ),
                })
              }
            />
            <span className="ben-unit">%</span>
            <button
              className="chip-remove"
              title="הסר מוטב"
              onClick={() =>
                onChange({
                  beneficiaries: (p.beneficiaries ?? []).filter((_, ii) => ii !== i),
                })
              }
            >
              ✕
            </button>
          </span>
        ))}
        <button
          className="add-chip small"
          onClick={() =>
            onChange({
              beneficiaries: [...(p.beneficiaries ?? []), { name: '', pct: 0 }],
            })
          }
        >
          + מוטב
        </button>
      </div>

      {canFreeze && (
        <label className="waiver-row">
          <input
            type="checkbox"
            checked={p.frozen ?? false}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? {
                      frozen: true,
                      monthlyDeposit: 0,
                      monthlyCoverageCost: 0,
                      deathBenefitAmount: undefined,
                    }
                  : { frozen: false },
              )
            }
          />
          <span>
            קרן לא פעילה (ללא הפקדות)
            <span
              className="tip"
              data-tip="קרן מוקפאת — למשל קרן שהתקבלה בחלוקה לאחר גירושין, או קרן ממעסיק קודם. הצבירה ממשיכה לצבור תשואה, אבל אין הפקדות ואין כיסוי שאירים/נכות. במקרה מוות — הצבירה לשאירים/מוטבים."
              tabIndex={0}
            >
              ⓘ
            </span>
          </span>
        </label>
      )}
      {INSURED_PENSION_TYPES.has(p.type) && !p.frozen && (
        <label className="waiver-row">
          <input
            type="checkbox"
            checked={p.survivorsWaiver ?? false}
            onChange={(e) => onChange({ survivorsWaiver: e.target.checked })}
          />
          <span>
            ויתור על כיסוי שאירים
            <span
              className="tip"
              data-tip="רווק/ה ללא ילדים יכול/ה לוותר על כיסוי השאירים ולהגדיל את החיסכון. הוויתור תקף לשנתיים ודורש חידוש. במקרה מוות — הצבירה תשולם למוטבים כסכום חד-פעמי."
              tabIndex={0}
            >
              ⓘ
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

// ---------- כרטיס סיכום תרחיש ----------

function replacementTone(pct: number): string {
  if (pct >= 70) return 'good';
  if (pct >= 55) return 'warn';
  return 'bad';
}

function TotalsCard(props: {
  title: string;
  tone: 'pessimistic' | 'central' | 'optimistic';
  t: PortfolioScenarioTotals;
  returnPct?: number;
  highlight?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      className={`card totals-card ${props.tone} ${props.highlight ? 'highlight' : ''} ${props.onSelect ? 'selectable' : ''}`}
      onClick={props.onSelect}
      role={props.onSelect ? 'button' : undefined}
      tabIndex={props.onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (props.onSelect && (e.key === 'Enter' || e.key === ' ')) props.onSelect();
      }}
    >
      <div className="totals-head">{props.title}</div>
      {props.returnPct !== undefined && (
        <div className="totals-assumption">בהנחת תשואה ריאלית {props.returnPct.toFixed(2)}% בשנה</div>
      )}
      <div className="totals-balance">{nis(props.t.totalBalance)}</div>
      <div className="totals-balance-label">סך צבירה בפרישה</div>
      {props.t.replacementRatePct !== null && (
        <div className={`replacement-badge ${replacementTone(props.t.replacementRatePct)}`}>
          שיעור תחלופה: {props.t.replacementRatePct}% מהשכר
          <span
            className="tip"
            data-tip="הקצבה החודשית הצפויה כאחוז מהשכר שלך ערב הפרישה — המדד המרכזי בתכנון פנסיוני. יעד מקובל: 70% ומעלה. מתחת ל-55% נדרשת פעולה (הגדלת הפקדות / דחיית פרישה)."
            tabIndex={0}
          >
            ⓘ
          </span>
        </div>
      )}
      <dl>
        <dt>קצבה חודשית</dt>
        <dd>{nis(props.t.totalMonthlyAnnuity)}</dd>
        <dt>הון חד־פעמי נזיל</dt>
        <dd>{nis(props.t.totalLumpSum)}</dd>
        <dt>סך דמי ניהול</dt>
        <dd className="fees">{nis(props.t.totalFeesPaid)}</dd>
      </dl>
    </div>
  );
}

// ---------- מרנדר Markdown מינימלי לתשובות AI ----------

function AiMarkdown(props: { text: string }) {
  const lines = props.text.split('\n');
  const render = (line: string, key: number) => {
    // מודגש **כך** — פיצול פשוט
    const parts = line.split(/\*\*(.+?)\*\*/g);
    const content = parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p));
    if (line.startsWith('## ')) {
      return (
        <h4 key={key} className="ai-h">
          {line.slice(3)}
        </h4>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <h4 key={key} className="ai-h">
          {line.slice(2)}
        </h4>
      );
    }
    if (/^[-*•] /.test(line)) {
      return (
        <div key={key} className="ai-li">
          <span className="ai-bullet">•</span>
          <span>{content.map((c, i) => (typeof c === 'string' && i === 0 ? c.slice(2) : c))}</span>
        </div>
      );
    }
    if (/^\d+[.)] /.test(line)) {
      return (
        <div key={key} className="ai-li num">
          {content}
        </div>
      );
    }
    if (line.startsWith('_') && line.endsWith('_')) {
      return (
        <p key={key} className="ai-disclaimer">
          {line.slice(1, -1)}
        </p>
      );
    }
    if (line.trim() === '') return <div key={key} className="ai-space" />;
    return <p key={key}>{content}</p>;
  };
  return <div className="ai-md">{lines.map(render)}</div>;
}

// ---------- מד פער כיסוי ----------

function GapBar(props: { actual: number; target: number; gap: number }) {
  if (props.target <= 0) return null;
  const pct = Math.min(100, Math.round((props.actual / props.target) * 100));
  const covered = props.gap === 0;
  return (
    <div className="gap-bar-wrap">
      <div className="gap-bar-info">
        <span>יעד למשפחה: {nis(props.target)} לחודש (70% מהשכר)</span>
        <span className={covered ? 'covered' : 'gap'}>
          {covered ? '✓ היעד מכוסה' : `פער: ${nis(props.gap)} לחודש`}
        </span>
      </div>
      <div className="gap-bar">
        <div
          className={`gap-bar-fill ${covered ? 'covered' : 'gap'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------- שדות קלט ----------

function FieldLabel(props: { label: string; tooltip?: string }) {
  return (
    <span className="field-label">
      {props.label}
      {props.tooltip && (
        <span className="tip" data-tip={props.tooltip} tabIndex={0}>
          ⓘ
        </span>
      )}
    </span>
  );
}

function Field(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  tooltip?: string;
  unit?: string;
}) {
  return (
    <label className="field">
      <FieldLabel label={props.label} tooltip={props.tooltip} />
      <div className={`input-wrap ${props.unit ? 'has-unit' : ''}`}>
        <input
          type="number"
          value={props.value}
          step={props.step ?? 1}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
        {props.unit && <span className="unit">{props.unit}</span>}
      </div>
    </label>
  );
}

/** שדה סכום בש"ח — מציג מפריד אלפים (1,250,000) תוך שמירת ערך מספרי */
function MoneyField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  tooltip?: string;
}) {
  return (
    <label className="field">
      <FieldLabel label={props.label} tooltip={props.tooltip} />
      <div className="input-wrap has-unit">
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          placeholder="0"
          value={props.value === 0 ? '' : props.value.toLocaleString('en-US')}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, '');
            props.onChange(digits === '' ? 0 : Number(digits));
          }}
        />
        <span className="unit">₪</span>
      </div>
    </label>
  );
}

export default App;
