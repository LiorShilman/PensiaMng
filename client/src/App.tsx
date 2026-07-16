import { useEffect, useState } from 'react';
import './App.css';
import {
  calcPortfolio,
  calcRetirement,
  calcScenarios,
  clearSession,
  DEMO_EMAIL,
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
import {
  aiAnalyzeStream,
  getAiSettings,
  getLastAiAnalysis,
  calcHealthScore,
  type RightsFixationResult,
  type HealthScoreResult,
  type TaxBenefitsResult,
  type FixationFormInput,
  type TaxFormInput,
  type SimulatedPensionResult,
  type JobExitResult,
  calcFeeComparison,
  type FeeComparisonResult,
  type DecumulationResult,
  calcInsights,
  type InsightsResult,
  type Insight,
  downloadReportPdf,
  type SimPensionFormInput,
  type JobExitFormInput,
  type DecumFormInput,
  type AnnuityTrackResult,
  type AnnuityTrackFormInput,
  type FundSwitchResult,
  type FundSwitchFormInput,
  type Section190Result,
  type Section190FormInput,
  type FundLoanResult,
  type FundLoanFormInput,
  type DivorcePensionSplitResult,
  type DivorceSplitFormInput,
} from './api';
import { openReport, buildReportHtml } from './report';
import { exportPortfolioExcel } from './exportExcel';
import { AuthScreen } from './AuthScreen';
import { AiPanel } from './AiPanel';
import { AiMarkdown } from './AiMarkdown';
import { AiChat } from './AiChat';
import { Glossary } from './Glossary';
import {
  IconBook,
  IconBot,
  IconCompass,
  IconDoc,
  IconPrinter,
  IconShield,
  IconSheet,
  IconSparkles,
  IconUsers,
  IconWaves,
} from './icons';
import { SecurityPanel } from './SecurityPanel';
import { FamilyView } from './FamilyView';
import { Tour } from './Tour';
import type { TourStep } from './Tour';
import { FanChart } from './FanChart';
import { MoneyFlow } from './MoneyFlow';
import { MoneyRiver, type RiverProduct } from './MoneyRiver';
import { RightsFixation } from './RightsFixation';
import { TaxBenefits } from './TaxBenefits';
import { SimulatedPension } from './SimulatedPension';
import { JobExit } from './JobExit';
import { Decumulation } from './Decumulation';
import { LifePath } from './LifePath';
import { DateField } from './DateField';
import { AnnuityTrack } from './AnnuityTrack';
import { FundSwitch } from './FundSwitch';
import { Section190 } from './Section190';
import { FundLoan } from './FundLoan';
import { DivorcePensionSplit } from './DivorcePensionSplit';
import { ReportImport } from './ReportImport';

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
  /** מוצר ביטוח טהור — בלי חיסכון, לא נכלל בתחזית הצבירה */
  insuranceOnly?: boolean;
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

export const TYPE_META: Record<ProductType, TypeMeta> = {
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
  MONEY_MARKET_FUND: {
    label: 'קרן כספית',
    short: 'קרן כספית',
    isAnnuity: false,
    hasCoverage: false,
    maxDepositFee: 0,
    icon: 'growth',
    accent: ['#059669', '#34d399'],
    defaults: { feeFromDepositPct: 0, feeFromBalancePct: 0.2, monthlyCoverageCost: 0 },
  },
  DISABILITY_INSURANCE: {
    label: 'ביטוח אכ"ע / מטריה (פרטי)',
    short: 'אכ"ע פרטי',
    isAnnuity: false,
    hasCoverage: false,
    maxDepositFee: 0,
    icon: 'shield',
    accent: ['#0d9488', '#14b8a6'],
    insuranceOnly: true,
    defaults: { feeFromDepositPct: 0, feeFromBalancePct: 0, monthlyCoverageCost: 0 },
  },
  LIFE_INSURANCE: {
    label: 'ביטוח חיים פרטי (ריסק)',
    short: 'ביטוח חיים',
    isAnnuity: false,
    hasCoverage: false,
    maxDepositFee: 0,
    icon: 'shield',
    accent: ['#e11d48', '#fb7185'],
    insuranceOnly: true,
    defaults: { feeFromDepositPct: 0, feeFromBalancePct: 0, monthlyCoverageCost: 0 },
  },
};

export const TYPE_ORDER: ProductType[] = [
  'PENSION_COMPREHENSIVE',
  'PENSION_GENERAL',
  'MANAGERS_INSURANCE',
  'PROVIDENT_FUND',
  'PROVIDENT_INVESTMENT',
  'IRA',
  'STUDY_FUND',
  'MONEY_MARKET_FUND',
  'DISABILITY_INSURANCE',
  'LIFE_INSURANCE',
];

// ---------- עזרים ----------

/* בונים ידנית (ולא style:'currency') כי הצבת סימן ה-₪ האוטומטית של
   ה-locale מסתמכת על הקשר bidi RTL — ומתהפכת בתאים עם direction:ltr
   (td.num, לטבלת אלפים ישרה) */
const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

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
    ...(type === 'DISABILITY_INSURANCE'
      ? { currentBalance: 0, monthlyDeposit: 0, disabilityPct: 75, umbrella: false }
      : {}),
    ...(type === 'LIFE_INSURANCE'
      ? { currentBalance: 0, monthlyDeposit: 0, deathBenefitAmount: 0 }
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

/** מספר ילדים זכאים (מתחת לגיל 21) — יתום זכאי לקצבת שאירים עד גיל זה */
function eligibleChildrenCount(children?: { birthDate: string }[]): number {
  const now = new Date();
  return (children ?? []).filter((c) => {
    const birth = new Date(c.birthDate);
    if (isNaN(birth.getTime())) return false;
    const ageYears = (now.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000);
    return ageYears < 21;
  }).length;
}

/**
 * ויתור על כיסוי שאירים בתקנון חל *רק* על חלק בן/בת הזוג, וזמין רק כשאין
 * בן/בת זוג בפועל — גם למי שיש לו/לה ילדים מתחת לגיל 21 (כיסוי הילדים
 * אינו ניתן לוויתור בשום מצב וממשיך לחול תמיד). לכן זכאות הוויתור תלויה
 * במצב הזוגי בלבד, לא במספר הילדים.
 */

/** ויתור על כיסוי שאירים תקף שנתיים ממועד החתימה — פג תוקף מעל 24 חודשים */
function isWaiverExpired(dateIso: string): boolean {
  const signed = new Date(dateIso);
  if (isNaN(signed.getTime())) return false;
  const now = new Date();
  const monthsSince = (now.getFullYear() - signed.getFullYear()) * 12 + (now.getMonth() - signed.getMonth());
  return monthsSince >= 24;
}

const aiMetaLabel = (provider: 'anthropic' | 'openai', model: string) =>
  `${provider === 'anthropic' ? 'Claude' : 'ChatGPT'} · ${model}`;

/** "2026-07-11T10:00:00Z" → "11/07 10:00" */
function formatAiTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

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
  const [pdfBusy, setPdfBusy] = useState(false);
  const [scenario, setScenario] = useState<ScenarioKey>('central');
  /** התוצאות המוצגות חושבו על נתונים ישנים — יש לחשב מחדש */
  const [stale, setStale] = useState(false);
  /** עיתוי האירוע בתרחישי הביטוח: 0 = היום, אחרת בעוד X שנים */
  const [eventOffsetYears, setEventOffsetYears] = useState(0);
  /** הגדרות מסלולי ההשקעה הסטנדרטיים — נטענות מהשרת */
  const [trackDefs, setTrackDefs] = useState<TrackDef[]>([]);
  /** מרכז ידע */
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  /** אבטחה — 2FA ויומן גישה */
  const [securityOpen, setSecurityOpen] = useState(false);
  /** מסך משפחה — מבט זוגי */
  const [familyOpen, setFamilyOpen] = useState(false);
  /** סיור מודרך בכל יכולות המערכת */
  const [tourActive, setTourActive] = useState(false);
  /** מודול AI */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<string | null>(null);
  const [aiAnalyzedAt, setAiAnalyzedAt] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  /** תוצאת סימולציית קיבוע הזכויות האחרונה — לניתוח ה-AI ולדוח */
  const [fixation, setFixation] = useState<RightsFixationResult | null>(null);
  /** ביטוח לאומי: הכללה בחישובים + שנות ביטוח (ריק = אומדן אוטומטי) */
  const [niInclude, setNiInclude] = useState(true);
  const [niYears, setNiYears] = useState<number | ''>('');
  /** ציון הבריאות הפנסיוני */
  const [health, setHealth] = useState<HealthScoreResult | null>(null);
  /** השוואת דמי ניהול לשוק */
  const [feeComp, setFeeComp] = useState<FeeComparisonResult | null>(null);
  /** מנוע תובנות — מרכז אותות מ-scenarios/health/feeComp/taxBenefits */
  const [insights, setInsights] = useState<InsightsResult | null>(null);
  /** מטריצת גילאים לתרחישי הביטוח */
  const [matrix, setMatrix] = useState<{ offset: number; r: ScenariosResult }[] | null>(null);
  const [matrixBusy, setMatrixBusy] = useState(false);
  /** תוצאת מחשבון הטבות המס האחרונה — לניתוח ה-AI */
  const [taxBenefits, setTaxBenefits] = useState<TaxBenefitsResult | null>(null);
  /** תוצאת סימולציית הפרישה המדומה האחרונה — לניתוח ה-AI */
  const [simPension, setSimPension] = useState<SimulatedPensionResult | null>(null);
  /** תוצאת סימולציית עזיבת העבודה האחרונה — לניתוח ה-AI */
  const [jobExit, setJobExit] = useState<JobExitResult | null>(null);
  /** תוצאת תוכנית המשיכה ההדרגתית — לניתוח ה-AI */
  const [decum, setDecum] = useState<DecumulationResult | null>(null);
  /** תוצאת השוואת מסלולי קצבה האחרונה — לניתוח ה-AI */
  const [annuityTrack, setAnnuityTrack] = useState<AnnuityTrackResult | null>(null);
  /** תוצאת "כדאי לעבור קרן?" האחרונה — לניתוח ה-AI */
  const [fundSwitch, setFundSwitch] = useState<FundSwitchResult | null>(null);
  /** תוצאת מחשבון תיקון 190 האחרונה — לניתוח ה-AI */
  const [section190, setSection190] = useState<Section190Result | null>(null);
  /** תוצאת מחשבון הלוואה מהקרן האחרונה — לניתוח ה-AI */
  const [fundLoan, setFundLoan] = useState<FundLoanResult | null>(null);
  /** תוצאת מחשבון חלוקת זכויות פנסיה בגירושין האחרונה — לניתוח ה-AI */
  const [divorceSplit, setDivorceSplit] = useState<DivorcePensionSplitResult | null>(null);
  /** קלטי הסימולטורים — נטענים ונשמרים עם התיק */
  const [fixationForm, setFixationForm] = useState<FixationFormInput | null>(null);
  const [taxForm, setTaxForm] = useState<TaxFormInput | null>(null);
  const [simPensionForm, setSimPensionForm] = useState<SimPensionFormInput | null>(null);
  const [jobExitForm, setJobExitForm] = useState<JobExitFormInput | null>(null);
  const [decumForm, setDecumForm] = useState<DecumFormInput | null>(null);
  const [annuityTrackForm, setAnnuityTrackForm] = useState<AnnuityTrackFormInput | null>(null);
  const [fundSwitchForm, setFundSwitchForm] = useState<FundSwitchFormInput | null>(null);
  const [section190Form, setSection190Form] = useState<Section190FormInput | null>(null);
  const [fundLoanForm, setFundLoanForm] = useState<FundLoanFormInput | null>(null);
  const [divorceSplitForm, setDivorceSplitForm] = useState<DivorceSplitFormInput | null>(null);

  useEffect(() => {
    if (!user) return;
    getTracks().then(setTrackDefs).catch(() => {});
    // הגדרות ה-AI נטענות בכניסה — כפתורי ה-AI יודעים מיד שיש מפתח שמור
    getAiSettings()
      .then((s) => setAiConfigured(!!s?.hasKey))
      .catch(() => {});
    // הניתוח האחרון שנשמר — כדי לא לנתח מחדש בכל כניסה
    getLastAiAnalysis()
      .then((last) => {
        if (!last) return;
        setAiText(last.text);
        setAiMeta(aiMetaLabel(last.provider, last.model));
        setAiAnalyzedAt(last.analyzedAt);
      })
      .catch(() => {});
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
          // שחזור קלטי הסימולטורים ותוצאותיהם שנשמרו עם התיק — כדי שלא
          // יתאפסו לריק בכל כניסה מחדש (מפרט 8: הדוח כולל אותם ממילא)
          setFixationForm(saved.assumptions.fixationInput ?? null);
          setFixation(saved.assumptions.fixationResult ?? null);
          setTaxForm(saved.assumptions.taxInput ?? null);
          setTaxBenefits(saved.assumptions.taxResult ?? null);
          setSimPensionForm(saved.assumptions.simPensionInput ?? null);
          setSimPension(saved.assumptions.simPensionResult ?? null);
          setJobExitForm(saved.assumptions.jobExitInput ?? null);
          setJobExit(saved.assumptions.jobExitResult ?? null);
          setDecumForm(saved.assumptions.decumInput ?? null);
          setDecum(saved.assumptions.decumResult ?? null);
          setAnnuityTrackForm(saved.assumptions.annuityTrackInput ?? null);
          setAnnuityTrack(saved.assumptions.annuityTrackResult ?? null);
          setFundSwitchForm(saved.assumptions.fundSwitchInput ?? null);
          setFundSwitch(saved.assumptions.fundSwitchResult ?? null);
          setSection190Form(saved.assumptions.section190Input ?? null);
          setSection190(saved.assumptions.section190Result ?? null);
          setFundLoanForm(saved.assumptions.fundLoanInput ?? null);
          setFundLoan(saved.assumptions.fundLoanResult ?? null);
          setDivorceSplitForm(saved.assumptions.divorceSplitInput ?? null);
          setDivorceSplit(saved.assumptions.divorceSplitResult ?? null);
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
      const saved = await savePortfolio({
        assumptions: {
          ...assumptions,
          fixationInput: fixationForm ?? undefined,
          fixationResult: fixation ?? undefined,
          taxInput: taxForm ?? undefined,
          taxResult: taxBenefits ?? undefined,
          simPensionInput: simPensionForm ?? undefined,
          simPensionResult: simPension ?? undefined,
          jobExitInput: jobExitForm ?? undefined,
          jobExitResult: jobExit ?? undefined,
          decumInput: decumForm ?? undefined,
          decumResult: decum ?? undefined,
          annuityTrackInput: annuityTrackForm ?? undefined,
          annuityTrackResult: annuityTrack ?? undefined,
          fundSwitchInput: fundSwitchForm ?? undefined,
          fundSwitchResult: fundSwitch ?? undefined,
          section190Input: section190Form ?? undefined,
          section190Result: section190 ?? undefined,
          fundLoanInput: fundLoanForm ?? undefined,
          fundLoanResult: fundLoan ?? undefined,
          divorceSplitInput: divorceSplitForm ?? undefined,
          divorceSplitResult: divorceSplit ?? undefined,
        },
        profile,
        products,
      });
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

  async function onDownloadPdf() {
    if (!result || !user) return;
    setPdfBusy(true);
    setError(null);
    try {
      const html = buildReportHtml({
        userName: user.fullName,
        profile,
        products,
        result,
        scenarios,
        retirement,
        fixation,
        health,
        simPension,
        taxBenefits,
        jobExit,
        decum,
        annuityTrack,
        fundSwitch,
        section190,
        fundLoan,
        divorceSplit,
        feeComparison: feeComp,
        insights,
        aiText,
        aiMeta,
        typeLabel: (t) => TYPE_META[t].label,
      });
      const date = new Date().toISOString().slice(0, 10);
      await downloadReportPdf(html, `PensiaMng-${user.fullName.replace(/\s+/g, '_')}-${date}.pdf`);
    } catch (e) {
      if (e instanceof UnauthorizedError) return logout();
      setError((e as Error).message);
    } finally {
      setPdfBusy(false);
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

  /** אומדן שנות ביטוח לתוספת הוותק: מגיל 22 עד הפרישה (עקיפה ידנית אפשרית) */
  function niYearsEffective(): number {
    if (niYears !== '') return niYears;
    if (retirement) {
      return Math.min(
        50,
        Math.max(0, Math.round(retirement.effectiveRetirementAgeMonths / 12 - 22)),
      );
    }
    return 40;
  }

  /** מטריצת גילאים (מפרט 5.1): תרחישי הביטוח בכמה נקודות זמן במקביל */
  async function onBuildMatrix() {
    if (!result || matrixBusy) return;
    setMatrixBusy(true);
    try {
      const step = 5;
      const offsets: number[] = [];
      for (let o = 0; o < yearsToRetirement; o += step) offsets.push(o);
      if (!offsets.includes(yearsToRetirement - 1) && yearsToRetirement > 1) {
        offsets.push(yearsToRetirement - 1); // ערב פרישה
      }
      const results = await Promise.all(
        offsets.map((o) => calcScenarios(scenariosInputFor(o, result))),
      );
      setMatrix(offsets.map((offset, i) => ({ offset, r: results[i] })));
    } catch (e) {
      if (e instanceof UnauthorizedError) return logout();
      setError((e as Error).message);
    } finally {
      setMatrixBusy(false);
    }
  }

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
      ...(niInclude ? { nationalInsurance: { include: true } } : {}),
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
          survivorsWaiverDate: p.survivorsWaiverDate,
          deathBenefitAmount: p.deathBenefitAmount,
          beneficiaries: p.beneficiaries,
          umbrella: p.umbrella,
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

  // השוואת דמי ניהול לשוק — מחושבת עם כל תחזית חדשה
  useEffect(() => {
    if (!result || !retirement) {
      setFeeComp(null);
      return;
    }
    calcFeeComparison({
      months: Math.max(12, retirement.monthsToRetirement),
      annualReturnPct: assumptions.annualReturnPct,
      annualSalaryGrowthPct: assumptions.annualSalaryGrowthPct,
      products: products
        .filter((p) => !TYPE_META[p.type].insuranceOnly)
        .map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          currentBalance: p.currentBalance,
          monthlyDeposit: p.frozen ? 0 : p.monthlyDeposit,
          feeFromDepositPct: p.feeFromDepositPct,
          feeFromBalancePct: p.feeFromBalancePct,
        })),
    })
      .then(setFeeComp)
      .catch(() => setFeeComp(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // ציון הבריאות — מחושב מחדש כשמשתנות התחזית או תרחישי הביטוח
  useEffect(() => {
    if (!result || !scenarios) {
      setHealth(null);
      return;
    }
    const age = Math.floor(
      (Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000),
    );
    const target = scenarios.death.targetMonthly;
    calcHealthScore({
      age,
      replacementRatePct: result.totals.central.replacementRatePct,
      deathCoverageRatio:
        target > 0
          ? (scenarios.death.totalSurvivorMonthly + scenarios.death.niSurvivorsMonthly) /
            target
          : null,
      disabilityCoverageRatio:
        target > 0
          ? (scenarios.disability.totalDisabilityMonthly +
              scenarios.disability.niDisabilityMonthly) /
            target
          : null,
      products: products.map((p) => ({
        type: p.type,
        frozen: p.frozen,
        currentBalance: p.currentBalance,
        feeFromBalancePct: p.feeFromBalancePct,
        feeFromDepositPct: p.feeFromDepositPct,
        hasBeneficiaries: (p.beneficiaries ?? []).length > 0,
        ...(p.tracks && p.tracks.length > 0
          ? {
              equityPct: p.tracks
                .filter((t) => t.category === 'EQUITY' || t.category === 'SP500')
                .reduce((s, t) => s + t.pct, 0),
              ageDependentTrack: p.tracks.some(
                (t) => t.category === 'AGE_DEPENDENT' && t.pct > 0,
              ),
            }
          : {}),
      })),
    })
      .then(setHealth)
      .catch(() => setHealth(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, scenarios]);

  // מנוע תובנות — מרכז אותות מכל המנועים שכבר חושבו, בלי לחשב מחדש
  useEffect(() => {
    if (!scenarios && !health && !feeComp && !taxBenefits) {
      setInsights(null);
      return;
    }
    calcInsights({ scenarios, healthScore: health, feeComparison: feeComp, taxBenefits })
      .then(setInsights)
      .catch(() => setInsights(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios, health, feeComp, taxBenefits]);

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
      מוצרים: products.map((p) => {
        const liq = p.type === 'STUDY_FUND' ? studyFundLiquidity(p.joinDate) : null;
        return {
          שם: p.name,
          סוג: TYPE_META[p.type].label,
          יתרה_צבורה: p.currentBalance,
          הפקדה_חודשית: p.monthlyDeposit,
          דמי_ניהול_מהפקדה_אחוז: p.feeFromDepositPct,
          דמי_ניהול_מצבירה_אחוז: p.feeFromBalancePct,
          עלות_כיסויים_או_פרמיה_חודשית: p.monthlyCoverageCost,
          לא_פעילה: p.frozen ?? false,
          מסלולי_השקעה: p.tracks ?? [],
          שכר_מבוטח_בקרן_או_בפוליסה: p.insuredMonthlySalary,
          ...(liq
            ? {
                תאריך_פתיחה: p.joinDate,
                נזילות: liq.liquid ? 'נזילה למשיכה בפטור' : `תהיה נזילה ב-${liq.at}`,
              }
            : {}),
          ...(p.type === 'DISABILITY_INSURANCE'
            ? {
                כיסוי_נכות_אחוז: p.disabilityPct,
                כוללת_מטריה_ביטוחית: p.umbrella ?? false,
              }
            : {}),
          ...(p.type === 'LIFE_INSURANCE' || p.type === 'MANAGERS_INSURANCE'
            ? { סכום_ביטוח_חיים: p.deathBenefitAmount ?? 0 }
            : {}),
          ...(INSURED_PENSION_TYPES.has(p.type)
            ? {
                כיסוי_שאירים_אחוז: p.survivorsPct,
                כיסוי_נכות_אחוז: p.disabilityPct,
                ויתור_על_כיסוי_שאירים: p.survivorsWaiver ?? false,
                תאריך_חתימת_הוויתור: p.survivorsWaiverDate ?? null,
              }
            : {}),
          מוטבים:
            (p.beneficiaries ?? []).length > 0
              ? p.beneficiaries
              : 'לא הוגדרו (יורשים על פי דין)',
          היסטוריית_ניוד:
            (p.transfers ?? []).length > 0
              ? p.transfers!.map((t) => ({
                  ממי: t.fromProvider,
                  סוג_מקורי: t.fromType || null,
                  תאריך_ניוד: t.transferDate,
                  הערה: t.note || null,
                }))
              : null,
        };
      }),
      תחזית_לפרישה: result
        ? {
            מרכזי: {
              סך_צבירה: result.totals.central.totalBalance,
              קצבה_חודשית: result.totals.central.totalMonthlyAnnuity,
              קצבת_אזרח_ותיק_ביטוח_לאומי: result.totals.central.niOldAgeMonthly,
              הון_נזיל: result.totals.central.totalLumpSum,
              סך_דמי_ניהול: result.totals.central.totalFeesPaid,
              שיעור_תחלופה_אחוז_כולל_ביטוח_לאומי:
                result.totals.central.replacementRatePct,
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
              קצבת_שאירים_חודשית_מהקרנות: scenarios.death.totalSurvivorMonthly,
              קצבת_שאירים_ביטוח_לאומי: scenarios.death.niSurvivorsMonthly,
              סכומים_חד_פעמיים: scenarios.death.totalLumpSum,
              יעד_חודשי: scenarios.death.targetMonthly,
              פער: scenarios.death.gapMonthly,
            },
            נכות: {
              קצבה_חודשית_מהקרנות: scenarios.disability.totalDisabilityMonthly,
              קצבת_נכות_ביטוח_לאומי: scenarios.disability.niDisabilityMonthly,
              קיזוז_ביטוח_לאומי_בקרן: scenarios.disability.niOffsetReduction,
              כיסוי_עודף_שלא_ניתן_לממש: scenarios.disability.excessMonthly,
              פער: scenarios.disability.gapMonthly,
            },
            אזהרות_המערכת: scenarios.warnings,
          }
        : null,
      משיכה_הדרגתית_בפרישה: decum
        ? {
            משיכה_בת_קיימא_לחודש: decum.sustainableMonthly,
            עד_גיל: decum.targetAge,
            גיל_אזילת_ההון: decum.depletionAge,
            סך_משיכות: decum.totalWithdrawn,
          }
        : null,
      עזיבת_עבודה: jobExit
        ? {
            נטו_במשיכה_היום: jobExit.netToday,
            מס_על_החלק_החייב: jobExit.taxOnTaxable,
            קצבה_חודשית_שנמחקת: jobExit.monthlyAnnuityLoss,
            פגיעה_בהון_הפטור_בקיבוע: jobExit.kibuaExemptCapitalLoss,
          }
        : null,
      פרישה_מדומה: simPension
        ? {
            קצבה_מוקדמת_ברוטו: simPension.earlyMonthlyGross,
            נטו_בזמן_עבודה: simPension.earlyMonthlyNetWhileWorking,
            סך_נטו_בחלון_הביניים: simPension.totalNetDuringWindow,
            קצבה_אם_ממתינים: simPension.waitMonthlyGross,
            הפסד_חודשי_לכל_החיים: simPension.monthlyLossAfterLegal,
            גיל_נקודת_איזון: simPension.breakEvenAge,
          }
        : null,
      הטבות_מס_בהפקדה: taxBenefits
        ? {
            חיסכון_מס_שנתי: taxBenefits.totalAnnualSaving,
            זיכוי: taxBenefits.taxCredit,
            שווי_ניכוי: taxBenefits.deductionValue,
            תקרה_שנותרה_לניצול: taxBenefits.remainingDepositAllowance,
            חיסכון_נוסף_אפשרי: taxBenefits.potentialExtraSaving,
          }
        : null,
      דמי_ניהול_מול_השוק: feeComp
        ? {
            סך_עלות_עודפת_שנתית: feeComp.totalAnnualExcessCost,
            מחיר_הפער_בפרישה: feeComp.totalGapAtRetirement,
            פירוט: feeComp.products.map((p) => ({
              מוצר: p.name,
              בפועל: p.actual,
              ממוצע_שוק: p.marketAvg,
              עודף_שנתי: p.annualExcessCost,
            })),
          }
        : null,
      ציון_בריאות_פנסיוני: health
        ? {
            ציון: health.total,
            דירוג: health.gradeLabel,
            רכיבים: health.components.map((c) => ({
              רכיב: c.label,
              ניקוד: `${c.score}/${c.max}`,
              פירוט: c.detail,
            })),
          }
        : null,
      קיבוע_זכויות: fixation
        ? {
            הון_פטור_מלא: fixation.exemptCapitalCeiling,
            קיזוז_מענקי_עבר: fixation.grantOffset,
            יתרה_פטורה: fixation.remainingExemptCapital,
            תרחישים: fixation.scenarios.map((s) => ({
              תרחיש: s.label,
              היוון_פטור: s.lumpSum,
              פטור_חודשי: s.monthlyExemption,
              קצבה_חייבת: s.taxableMonthlyPension,
            })),
          }
        : null,
      בחירת_מסלול_קצבה: annuityTrack
        ? {
            מסלולים: annuityTrack.options.map((o) => ({
              שם: o.label,
              קצבה_חודשית: o.monthlyAnnuity,
              קצבת_שאיר: o.survivorMonthly,
              אחוז_שאיר: o.survivorPct,
              הבטחת_תשלומים_חודשים: o.guaranteedMonths,
              סך_תשלומים_משוער: o.totalExpectedPayout,
              נקודת_איזון_מול_בסיס:
                o.breakEvenAge === undefined
                  ? 'מסלול הבסיס'
                  : o.breakEvenAge === null
                    ? 'אינו משתלם באופק הנבדק'
                    : `מגיל ${Math.round(o.breakEvenAge)}`,
            })),
            אזהרות: annuityTrack.warnings,
          }
        : null,
      כדאיות_מעבר_קרן: fundSwitch
        ? {
            יתרה_נוכחית_בפרישה: fundSwitch.currentBalanceAtRetirement,
            יתרה_מועמדת_בפרישה: fundSwitch.candidateBalanceAtRetirement,
            פער_יתרה: fundSwitch.balanceGap,
            סך_דמי_ניהול_נוכחי: fundSwitch.currentTotalFeesPaid,
            סך_דמי_ניהול_מועמד: fundSwitch.candidateTotalFeesPaid,
            קצבה_נוכחית: fundSwitch.currentMonthlyAnnuity,
            קצבה_מועמדת: fundSwitch.candidateMonthlyAnnuity,
            פער_קצבה: fundSwitch.annuityGap,
            אזהרות: fundSwitch.warnings,
          }
        : null,
      תיקון_190: section190
        ? {
            משיכה_הונית: {
              רווח_חייב: section190.lumpSum.taxableGain,
              מס: section190.lumpSum.tax,
              נטו_ביד: section190.lumpSum.netAmount,
              ערך_עתידי_בתוחלת_חיים: section190.lumpSum.projectedValueAtLifeExpectancy,
            },
            קצבה_מוכרת: {
              קצבה_חודשית_פטורה: section190.recognizedPension.monthlyAmount,
              סך_הכנסה_עד_תוחלת_חיים: section190.recognizedPension.totalIncomeToLifeExpectancy,
            },
            אזהרות: section190.warnings,
          }
        : null,
      הלוואה_מהקרן: fundLoan
        ? {
            הלוואת_הקרן: {
              תשלום_חודשי: fundLoan.fundLoan.monthlyPayment,
              סך_ריבית: fundLoan.fundLoan.totalInterest,
              עלות_הזדמנות: fundLoan.fundLoan.opportunityCost,
              עלות_כוללת: fundLoan.fundLoan.totalCost,
            },
            הלוואה_חלופית: {
              תשלום_חודשי: fundLoan.alternativeLoan.monthlyPayment,
              סך_ריבית: fundLoan.alternativeLoan.totalInterest,
            },
            פער_עלות_כוללת: fundLoan.totalCostGap,
            אזהרות: fundLoan.warnings,
          }
        : null,
      חלוקת_זכויות_בגירושין: divorceSplit
        ? {
            סך_יתרות_למועד_הקרע: divorceSplit.totalBalanceAtBreakDate,
            סך_חלק_בן_בת_הזוג: divorceSplit.totalSpouseShare,
            פירוט: divorceSplit.products.map((p) => ({
              מוצר: p.name,
              יחס_זמנים_אחוז: p.maritalFractionPct,
              חלק_בן_בת_הזוג: p.spouseShare,
              נשאר_לעמית: p.remainingForMember,
            })),
            אזהרות: divorceSplit.warnings,
          }
        : null,
    };
  }

  async function onAiAnalyze() {
    setAiBusy(true);
    setAiError(null);
    setAiText('');
    setAiMeta(null);
    let acc = '';
    try {
      // זרימה: הטקסט נבנה מקטע-מקטע על המסך תוך כדי יצירה
      const meta = await aiAnalyzeStream(buildAiContext(), (delta) => {
        acc += delta;
        setAiText(acc);
      });
      setAiMeta(aiMetaLabel(meta.provider, meta.model));
      setAiAnalyzedAt(new Date().toISOString());
    } catch (e) {
      if (e instanceof UnauthorizedError) return logout();
      setAiError((e as Error).message);
      if (!acc) setAiText(null);
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
          ...(niInclude
            ? {
                nationalInsurance: {
                  include: true,
                  insuranceYears: niYearsEffective(),
                  spouseSupplementEligible: hasSpouse(profile.maritalStatus),
                },
              }
            : {}),
          // מוצרי ביטוח טהורים לא נכללים בתחזית הצבירה; trackAllocations = tracks
          products: products
            .filter((p) => !TYPE_META[p.type].insuranceOnly)
            .map((p) => ({ ...p, trackAllocations: p.tracks })),
        }),
        calcScenarios(scenariosInputFor(0)),
      ]);
      setResult(r);
      setScenarios(s);
      setMatrix(null);
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

  /** עוזר: פותח אקורדיון "results fixation-section" רק אם הוא סגור (פעולה בטוחה והפיכה) */
  const openAccordion = (dataTour: string) => {
    const section = document.querySelector<HTMLElement>(`[data-tour="${dataTour}"]`);
    const head = section?.querySelector<HTMLElement>('.acc-head');
    if (head && !head.classList.contains('open')) head.click();
  };

  const q = (selector: string) => () => document.querySelector<HTMLElement>(selector);

  const TOUR_STEPS: TourStep[] = [
    {
      title: 'ברוכים הבאים ל-PensiaMng',
      body: 'סיור קצר על כל מה שהמערכת יודעת לעשות — בניית תיק, תרחישי ביטוח, AI, מבט זוגי ועוד. אפשר לצאת בכל שלב עם Esc או "דלג על הסיור".',
      find: q('.logo-row'),
    },
    {
      title: 'מרכז ידע',
      body: 'מילון מונחים פנסיוניים עם הסברים בעברית פשוטה — נגיש מכל מקום במערכת.',
      find: q('[data-tour="btn-glossary"]'),
      beforeShow: () => {
        setSecurityOpen(false);
        setFamilyOpen(false);
        setAiOpen(false);
      },
    },
    {
      title: 'הגדרות AI',
      body: 'מחברים מפתח API של Claude או ChatGPT כדי לקבל ניתוח חכם של התיק, יועץ צ\'אט עם גישה למנוע החישוב, וקליטת דוחות שנתיים מ-PDF.',
      find: q('[data-tour="btn-ai"]'),
    },
    {
      title: 'אבטחה',
      body: 'הפעלת אימות דו-שלבי (2FA) וצפייה ביומן הגישה והפעולות בחשבון.',
      find: q('[data-tour="btn-security"]'),
    },
    {
      title: 'מסך משפחה — מבט זוגי',
      body: 'בונים תיק נפרד לבן/בת הזוג ורואים תמונה הדדית: אם אחד/ת מבני הזוג נפטר/ת, כמה הכנסה נשארת בפועל למשפחה.',
      find: q('[data-tour="btn-family"]'),
    },
    {
      title: 'הנחות התכנון',
      body: 'פרטים אישיים, מצב משפחתי, שכר מבוטח, ביטוח לאומי וילדים — הבסיס לכל החישובים בתיק.',
      find: q('[data-tour="assumptions-section"]'),
      beforeShow: () => setGlossaryOpen(false),
    },
    {
      title: 'קליטת דוח שנתי מ-PDF',
      body: 'מעלים דוח שנתי מהקרן וה-AI מחלץ אוטומטית יתרות, דמי ניהול ומסלולים — לאישורכם לפני שמירה. חוסך הזנה ידנית.',
      find: q('[data-tour="report-import"]'),
    },
    {
      title: 'הוספת מוצר לתיק',
      body: 'קרן פנסיה, ביטוח מנהלים, קופת גמל, קרן השתלמות, ביטוחי אכ"ע וחיים — כל סוגי המוצרים הפנסיוניים במקום אחד.',
      find: q('[data-tour="add-row"]'),
    },
    {
      title: 'חישוב תחזית',
      body: 'מריץ הקרנת צבירה עתידית, קצבה צפויה ותרחישי ביטוח — עם עקבות חישוב מלאים לשקיפות.',
      find: q('[data-tour="btn-calc"]'),
    },
    {
      title: 'שמירת התיק',
      body: 'שומר את התיק במסד הנתונים כדי לחזור אליו בכל כניסה.',
      find: q('[data-tour="btn-save"]'),
    },
    {
      title: 'ציון בריאות פנסיוני',
      body: 'ציון 0–100 המשוקלל משיעור תחלופה, עלויות מול השוק, כיסויי שארים ונכות, התאמת מסלול והיגיינת התיק — עם המלצות שיפור מדורגות.',
      find: q('.health-card'),
      optional: true,
    },
    {
      title: 'תרחיש מוות',
      body: 'כמה מקבלת המשפחה אם קורה האסון — קצבת שארים, סכומים חד-פעמיים וביטוח לאומי, מול יעד הכנסה.',
      find: q('.scenario-card.death'),
      optional: true,
    },
    {
      title: 'תרחיש אובדן כושר עבודה',
      body: 'כיסוי נכות מהקרנות, זיהוי כפל ביטוחי וקיזוזי ביטוח לאומי.',
      find: q('.scenario-card.disability'),
      optional: true,
    },
    {
      title: 'ניתוח AI',
      body: 'ה-AI מסביר את התוצאות בשפה פשוטה, ומזהה בעיות כמו כפל ביטוחי או דמי ניהול חריגים.',
      find: q('.ai-section'),
      optional: true,
    },
    {
      title: 'קיבוע זכויות',
      body: 'סימולטור מלא לניצול הפטור ממס בפרישה בין קצבה פטורה, היוון פטור ופיצויים פטורים.',
      find: q('[data-tour="fixation-section"]'),
      beforeShow: () => openAccordion('fixation-section'),
      optional: true,
    },
    {
      title: 'הטבות מס בהפקדה',
      body: 'כמה מס חסכתם השנה מהפקדות לפנסיה, וכמה עוד נשאר לנצל עד סוף השנה.',
      find: q('[data-tour="taxbenefits-section"]'),
      beforeShow: () => openAccordion('taxbenefits-section'),
      optional: true,
    },
    {
      title: 'זהו!',
      body: 'זה רק חלק מהיכולות — יש גם בחירת מסלול קצבה, כדאיות מעבר קרן, תיקון 190, הלוואה מהקרן, פרישה מדומה, עזיבת עבודה, משיכה הדרגתית בפרישה, ייצוא לאקסל ועוד. אפשר לפתוח את הסיור הזה שוב בכל רגע מכפתור "סיור" בכותרת.',
      find: q('.footer'),
    },
  ];

  return (
    <div className="app">
      <div className="bg-glow" aria-hidden="true" />

      {user.email === DEMO_EMAIL && (
        <div className="demo-banner" role="status">
          מצב הדגמה — כל הנתונים המוצגים בדיוניים לחלוטין, לצורך הצגת יכולות המערכת בלבד
        </div>
      )}

      {tourActive && (
        <Tour steps={TOUR_STEPS} onFinish={() => setTourActive(false)} />
      )}

      <header className="header">
        <div className="header-top">
          <div className="logo-row">
            <div className="logo-mark">₪</div>
            <h1 className="logo-text">PensiaMng</h1>
          </div>
          <div className="user-bar">
            <button
              className="ai-toggle"
              data-tour="btn-glossary"
              onClick={() => {
                setGlossaryOpen((v) => {
                  if (!v) window.scrollTo({ top: 0, behavior: "smooth" });
                  return !v;
                });
              }}
              title="מרכז ידע — מדריך מקיף ומילון מונחים"
            >
              {IconBook}
              ידע
            </button>
            <button
              className={`ai-toggle ${aiConfigured ? 'configured' : ''}`}
              data-tour="btn-ai"
              onClick={() => {
                setAiOpen((v) => {
                  if (!v) window.scrollTo({ top: 0, behavior: "smooth" });
                  return !v;
                });
              }}
              title="הגדרות AI"
            >
              {IconBot}
              AI
            </button>
            <button
              className="ai-toggle"
              data-tour="btn-security"
              onClick={() => {
                setSecurityOpen((v) => {
                  if (!v) window.scrollTo({ top: 0, behavior: "smooth" });
                  return !v;
                });
              }}
              title="אבטחה — אימות דו-שלבי ויומן גישה"
            >
              {IconShield}
              אבטחה
            </button>
            <button
              className="ai-toggle"
              data-tour="btn-family"
              onClick={() => {
                setFamilyOpen((v) => {
                  if (!v) window.scrollTo({ top: 0, behavior: "smooth" });
                  return !v;
                });
              }}
              title="מסך משפחה — מבט זוגי"
            >
              {IconUsers}
              משפחה
            </button>
            <button
              className="ai-toggle"
              data-tour="btn-tour"
              onClick={() => setTourActive(true)}
              title="סיור מודרך בכל יכולות המערכת"
            >
              {IconCompass}
              סיור
            </button>
            <span className="user-name">{user.fullName}</span>
            <button className="logout-btn" onClick={logout}>
              התנתק
            </button>
          </div>
        </div>
        <p className="subtitle">תכנון פנסיה מקצועי — בניית תיק, הקרנת צבירה ותחזית קצבה</p>
      </header>

      {glossaryOpen && <Glossary onClose={() => setGlossaryOpen(false)} />}

      {securityOpen && (
        <SecurityPanel
          onClose={() => setSecurityOpen(false)}
          onUnauthorized={logout}
        />
      )}

      {familyOpen && (
        <FamilyView onClose={() => setFamilyOpen(false)} onUnauthorized={logout} />
      )}

      {aiOpen && (
        <AiPanel onConfigured={setAiConfigured} onClose={() => setAiOpen(false)} />
      )}

      <section className="card assumptions" data-tour="assumptions-section">
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
            <DateField
              value={profile.birthDate}
              onChange={(v) => setProfile((p) => ({ ...p, birthDate: v }))}
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
          <label className="field">
            <span className="field-label">
              שנות ביטוח (ביטוח לאומי)
              <span
                className="tip"
                data-tip="שנות עבודה/תושבות מבוטחת — קובעות את תוספת הוותק בקצבת אזרח ותיק (2% לשנה, עד 50%). ריק = אומדן אוטומטי מגיל 22 עד הפרישה."
                tabIndex={0}
              >
                ⓘ
              </span>
            </span>
            <input
              type="number"
              min={0}
              max={60}
              placeholder={retirement ? String(niYearsEffective()) : 'אוטומטי'}
              value={niYears}
              onChange={(e) =>
                setNiYears(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
          </label>
        </div>

        <label className="waiver-row ni-row">
          <input
            type="checkbox"
            checked={niInclude}
            onChange={(e) => setNiInclude(e.target.checked)}
          />
          <span>
            כלול קצבאות ביטוח לאומי (אזרח ותיק, שאירים, נכות)
            <span
              className="tip"
              data-tip="ביטוח לאומי הוא הרגל השלישית של הפנסיה: קצבת אזרח ותיק בפרישה, קצבת שאירים במקרה מוות וקצבת נכות כללית באובדן כושר. הערכים לפי 2025 בהנחות מפושטות — מומלץ להשאיר פעיל לתמונה מלאה."
              tabIndex={0}
            >
              ⓘ
            </span>
          </span>
        </label>

        <div className="children-row">
          <span className="children-label">
            ילדים
            <span className="tip" data-tip="לקצבת שאירים: יתום זכאי עד גיל 21. הזן את תאריכי הלידה של הילדים." tabIndex={0}>ⓘ</span>
          </span>
          {(profile.children ?? []).map((c, i) => (
            <span key={i} className="child-chip">
              <DateField
                value={c.birthDate}
                onChange={(v) =>
                  setProfile((p) => ({
                    ...p,
                    children: (p.children ?? []).map((cc, ii) =>
                      ii === i ? { ...cc, birthDate: v } : cc,
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

        <ReportImport
          aiConfigured={aiConfigured}
          onUnauthorized={logout}
          onAdd={(items) =>
            setProducts((ps) => [
              ...ps,
              ...items.map((x) => {
                const type = (
                  x.type in TYPE_META ? x.type : 'PROVIDENT_FUND'
                ) as ProductType;
                const meta = TYPE_META[type];
                return {
                  id: nextId(),
                  name: x.name,
                  type,
                  currentBalance: x.currentBalance,
                  monthlyDeposit: x.monthlyDeposit ?? 0,
                  feeFromDepositPct:
                    x.feeFromDepositPct ?? meta.defaults.feeFromDepositPct,
                  feeFromBalancePct:
                    x.feeFromBalancePct ?? meta.defaults.feeFromBalancePct,
                  monthlyCoverageCost:
                    x.monthlyPremium ?? meta.defaults.monthlyCoverageCost,
                  conversionFactor: meta.defaults.conversionFactor,
                  insuredMonthlySalary: x.insuredMonthlySalary,
                  deathBenefitAmount: x.deathBenefitAmount,
                  joinDate: x.joinDate,
                } satisfies PortfolioProductInput;
              }),
            ])
          }
        />

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
                hasCurrentSpouse={hasSpouse(profile.maritalStatus)}
                eligibleChildren={eligibleChildrenCount(profile.children)}
                onChange={(patch) => updateProduct(p.id, patch)}
                onRemove={() => removeProduct(p.id)}
              />
            ))}
          </div>
        )}

        <div className="add-row" data-tour="add-row">
          <span className="add-label">הוסף מוצר:</span>
          {TYPE_ORDER.map((t) => (
            <button key={t} className="add-chip" onClick={() => addProduct(t)}>
              + {TYPE_META[t].short}
            </button>
          ))}
        </div>

        {error && <div className="error">{error}</div>}
      </section>

      {/* סרגל פעולות צף — נגיש מכל נקודה בדף הארוך, ללא גלילה */}
      <div className="action-dock" role="toolbar" aria-label="פעולות התיק">
        <button
          className="calc-btn"
          data-tour="btn-calc"
          onClick={onCalculate}
          disabled={loading || products.length === 0}
        >
          {loading ? 'מחשב…' : 'חשב תחזית לתיק'}
        </button>
        <button
          className="save-btn"
          data-tour="btn-save"
          onClick={onSave}
          disabled={saveState === 'saving'}
        >
          {saveState === 'saving'
            ? 'שומר…'
            : saveState === 'saved'
              ? '✓ נשמר'
              : 'שמור תיק'}
        </button>
        {result && (
          <button
            className="report-btn"
            onClick={() =>
              openReport({
                userName: user.fullName,
                profile,
                products,
                result,
                scenarios,
                retirement,
                fixation,
                health,
                simPension,
                taxBenefits,
                jobExit,
                decum,
                annuityTrack,
                fundSwitch,
                section190,
                fundLoan,
                divorceSplit,
                feeComparison: feeComp,
                insights,
                aiText,
                aiMeta,
                typeLabel: (t) => TYPE_META[t].label,
              })
            }
            title="דוח מעוצב להדפסה או שמירה כ-PDF, כולל ניתוח ה-AI אם הופק"
          >
            {IconPrinter}
            הפק דוח
          </button>
        )}
        {result && (
          <button
            className="report-btn excel-btn"
            onClick={() =>
              exportPortfolioExcel({
                userName: user.fullName,
                profile,
                products,
                result,
                scenarios,
                typeLabel: (t) => TYPE_META[t].label,
              })
            }
            title="ייצוא התיק, התחזית ותרחישי הביטוח לקובץ Excel"
          >
            {IconSheet}
            ייצוא לאקסל
          </button>
        )}
        {result && (
          <button
            className="report-btn pdf-btn"
            onClick={onDownloadPdf}
            disabled={pdfBusy}
            title="קובץ PDF אמיתי להורדה — טקסט בר-חיפוש, לא צילום מסך"
          >
            {IconDoc}
            {pdfBusy ? 'מייצר PDF…' : 'הורדת PDF'}
          </button>
        )}
      </div>

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

          {health && <HealthScoreCard h={health} />}

          {insights && insights.insights.length > 0 && <InsightsPanel data={insights} />}

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

          {(() => {
            const toRiver = (p: (typeof result.products)[number]): RiverProduct => ({
              id: p.id,
              name: p.name,
              series: p.projection.central.series,
            });
            // נכסים קצבתיים (נעולים עד פרישה) מול נכסים הוניים נזילים — יעד
            // הנזילות שונה, אז לא הגיוני לערבב אותם באותו נהר "עד הפרישה"
            const annuityRiver = result.products
              .filter((p) => TYPE_META[p.type].isAnnuity)
              .map(toRiver);
            const capitalRiver = result.products
              .filter((p) => !TYPE_META[p.type].isAnnuity)
              .map(toRiver);
            if (annuityRiver.length === 0 && capitalRiver.length === 0) return null;
            return (
              <div className="river-pair">
                {annuityRiver.length > 0 && (
                  <div className="card river-card">
                    <h3 className="card-title">
                      {IconWaves} נהר הכסף — נכסים פנסיוניים (קצבתיים) לאורך הדרך לפרישה
                      <span
                        className="tip"
                        data-tip="כל מוצר קצבתי — נעול עד הפרישה — הוא זרם צבעוני שרוחבו בכל נקודת זמן משקף את הצבירה שלו; הזרמים נערמים סביב מרכז משותף במקום גרף עמודות רגיל, כדי לראות בבת אחת גם את הגודל היחסי של כל מוצר וגם איך כולם גדלים יחד לאורך הדרך."
                        tabIndex={0}
                      >
                        ⓘ
                      </span>
                    </h3>
                    <MoneyRiver products={annuityRiver} />
                  </div>
                )}
                {capitalRiver.length > 0 && (
                  <div className="card river-card">
                    <h3 className="card-title">
                      {IconWaves} נהר הכסף — נכסים הוניים נזילים
                      <span
                        className="tip"
                        data-tip="קרן השתלמות, קופת גמל להשקעה ו-IRA — בניגוד לנכסים הקצבתיים, אלה נזילים ולא בהכרח מיועדים להישאר עד הפרישה (לכל אחד יעד/מועד נזילות משלו). הצבירה כאן מוצגת לאותו טווח זמן להשוואה, לא כהבטחה שהכסף יישאר שם."
                        tabIndex={0}
                      >
                        ⓘ
                      </span>
                    </h3>
                    <MoneyRiver
                      products={capitalRiver}
                      endLabel="בטווח שנבדק"
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {feeComp && feeComp.products.length > 0 && (
            <div className="card fee-comp-card">
              <h3 className="card-title">
                דמי ניהול מול ממוצע השוק
                <span
                  className="tip"
                  data-tip="השוואה לממוצעי דמי הניהול שמפרסמת רשות שוק ההון (2024). 'מחיר הפער' = כמה צבירה תפסיד (או תרוויח) עד הפרישה בגלל ההפרש מהממוצע."
                  tabIndex={0}
                >
                  ⓘ
                </span>
              </h3>
              <div className="fixation-summary fee-comp-summary">
                <div className="scenario-stat">
                  <div className={`stat-value ${feeComp.totalAnnualExcessCost > 0 ? 'excess' : 'good'}`}>
                    {feeComp.totalAnnualExcessCost > 0 ? '+' : ''}
                    {nis(feeComp.totalAnnualExcessCost)}
                  </div>
                  <div className="stat-label">עלות שנתית מול הממוצע (חיובי = עודף)</div>
                </div>
                <div className="scenario-stat">
                  <div className={`stat-value ${feeComp.totalGapAtRetirement > 0 ? 'excess' : 'good'}`}>
                    {feeComp.totalGapAtRetirement > 0 ? '−' : '+'}
                    {nis(Math.abs(feeComp.totalGapAtRetirement))}
                  </div>
                  <div className="stat-label">"מחיר הפער" בצבירה עד הפרישה</div>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>מוצר</th>
                    <th>בפועל (הפקדה/צבירה)</th>
                    <th>ממוצע שוק</th>
                    <th>עודף שנתי</th>
                    <th>פער בפרישה</th>
                  </tr>
                </thead>
                <tbody>
                  {feeComp.products.map((p) => (
                    <tr key={p.id} className={`fee-row ${p.verdict}`}>
                      <td className="prod-name">{p.name}</td>
                      <td className="num">
                        {p.actual.deposit}% / {p.actual.balance}%
                      </td>
                      <td className="num">
                        {p.marketAvg.deposit}% / {p.marketAvg.balance}%
                      </td>
                      <td className="num">{nis(p.annualExcessCost)}</td>
                      <td className="num">{nis(p.gapAtRetirement)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {feeComp.warnings.length > 0 && (
                <div className="warnings">
                  {feeComp.warnings.map((w, i) => (
                    <div key={i} className="warning-item">⚠ {w}</div>
                  ))}
                </div>
              )}
            </div>
          )}

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
            <button
              className="trace-toggle"
              onClick={() => (matrix ? setMatrix(null) : void onBuildMatrix())}
              disabled={matrixBusy}
            >
              {matrixBusy
                ? 'בונה מטריצה…'
                : matrix
                  ? 'הסתר מטריצת גילאים'
                  : 'מטריצת גילאים — כל נקודות הזמן'}
            </button>
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
                  <div className="stat-value">
                    {nis(
                      scenarios.death.totalSurvivorMonthly +
                        scenarios.death.niSurvivorsMonthly,
                    )}
                  </div>
                  <div className="stat-label">קצבת שאירים חודשית למשפחה</div>
                </div>
                {scenarios.death.niSurvivorsMonthly > 0 && (
                  <div className="scenario-stat">
                    <div className="stat-value ni">
                      {nis(scenarios.death.niSurvivorsMonthly)}
                    </div>
                    <div className="stat-label">מזה ביטוח לאומי (שאירים)</div>
                  </div>
                )}
                <div className="scenario-stat">
                  <div className="stat-value">{nis(scenarios.death.totalLumpSum)}</div>
                  <div className="stat-label">סכומים חד-פעמיים למוטבים</div>
                </div>
              </div>
              <GapBar
                actual={
                  scenarios.death.totalSurvivorMonthly +
                  scenarios.death.niSurvivorsMonthly
                }
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
                  <div className="stat-value">
                    {nis(
                      scenarios.disability.totalDisabilityMonthly +
                        scenarios.disability.niDisabilityMonthly,
                    )}
                  </div>
                  <div className="stat-label">
                    קצבת נכות חודשית
                    {scenarios.disability.excessMonthly > 0 && ' (לאחר תקרת 75%)'}
                  </div>
                </div>
                {scenarios.disability.niDisabilityMonthly > 0 && (
                  <div className="scenario-stat">
                    <div className="stat-value ni">
                      {nis(scenarios.disability.niDisabilityMonthly)}
                    </div>
                    <div className="stat-label">
                      מזה ביטוח לאומי (נכות כללית)
                      {scenarios.disability.niOffsetReduction > 0 &&
                        ` · הקרן מקזזת ${nis(scenarios.disability.niOffsetReduction)}`}
                    </div>
                  </div>
                )}
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
                actual={
                  scenarios.disability.totalDisabilityMonthly +
                  scenarios.disability.niDisabilityMonthly
                }
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

          {matrix && (
            <div className="card fee-comp-card matrix-card">
              <h3 className="card-title">
                מטריצת גילאים — מוות ואובדן כושר לאורך הדרך
                <span
                  className="tip"
                  data-tip="מה תקבל המשפחה אם האירוע יקרה בכל נקודת זמן: הצבירות גדלות עם השנים (מהתחזית המרכזית), גילאי הילדים משתנים והזכאויות בהתאם. כולל ביטוח לאומי אם מסומן."
                  tabIndex={0}
                >
                  ⓘ
                </span>
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>מתי</th>
                    <th>מוות: קצבה למשפחה</th>
                    <th>מוות: חד-פעמי</th>
                    <th>מוות: פער</th>
                    <th>נכות: קצבה</th>
                    <th>נכות: פער</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(({ offset, r }) => {
                    const age = Math.floor(
                      (Date.now() - new Date(profile.birthDate).getTime()) /
                        (365.25 * 24 * 3600 * 1000) +
                        offset,
                    );
                    return (
                      <tr key={offset}>
                        <td className="prod-name">
                          {offset === 0 ? 'היום' : `בעוד ${offset} שנים`} (גיל {age})
                        </td>
                        <td className="num">
                          {nis(r.death.totalSurvivorMonthly + r.death.niSurvivorsMonthly)}
                        </td>
                        <td className="num">{nis(r.death.totalLumpSum)}</td>
                        <td className={`num ${r.death.gapMonthly > 0 ? 'gap-bad' : 'gap-ok'}`}>
                          {r.death.gapMonthly > 0 ? nis(r.death.gapMonthly) : '✓ מכוסה'}
                        </td>
                        <td className="num">
                          {nis(
                            r.disability.totalDisabilityMonthly +
                              r.disability.niDisabilityMonthly,
                          )}
                        </td>
                        <td
                          className={`num ${r.disability.gapMonthly > 0 ? 'gap-bad' : 'gap-ok'}`}
                        >
                          {r.disability.gapMonthly > 0
                            ? nis(r.disability.gapMonthly)
                            : '✓ מכוסה'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="hint">
                הצבירות בכל נקודה נלקחות מהתחזית המרכזית; יעד המשפחה קבוע (70% מהשכר של
                היום). ערב פרישה = השנה האחרונה לפני הגיל החוקי.
              </p>
            </div>
          )}

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

      {result && retirement && (
        <RightsFixation
          key={retirement.retirementDate}
          defaultYear={Number(retirement.retirementDate.slice(0, 4))}
          defaultMonthlyPension={result.totals.central.totalMonthlyAnnuity}
          onUnauthorized={logout}
          onResult={setFixation}
          initial={fixationForm ?? undefined}
          onInput={setFixationForm}
          initialResult={fixation ?? undefined}
        />
      )}

      {result && (
        <TaxBenefits
          defaultMonthlyIncome={profile.insuredMonthlySalary ?? 0}
          onUnauthorized={logout}
          onResult={setTaxBenefits}
          initial={taxForm ?? undefined}
          onInput={setTaxForm}
          initialResult={taxBenefits ?? undefined}
        />
      )}

      {result &&
        retirement &&
        retirement.effectiveRetirementAgeMonths / 12 > 60 &&
        (() => {
          const currentAge =
            Math.round(
              ((Date.now() - new Date(profile.birthDate).getTime()) /
                (365.25 * 24 * 3600 * 1000)) *
                10,
            ) / 10;
          if (currentAge >= retirement.effectiveRetirementAgeMonths / 12) return null;
          const annuityProducts = products.filter((p) => TYPE_META[p.type].isAnnuity);
          return (
            <SimulatedPension
              currentAge={currentAge}
              legalRetirementAge={
                Math.round((retirement.effectiveRetirementAgeMonths / 12) * 10) / 10
              }
              defaultBalance={annuityProducts.reduce((s, p) => s + p.currentBalance, 0)}
              defaultMonthlyDeposit={annuityProducts.reduce(
                (s, p) => s + (p.frozen ? 0 : p.monthlyDeposit),
                0,
              )}
              defaultReturnPct={assumptions.annualReturnPct}
              onUnauthorized={logout}
              onResult={setSimPension}
              initial={simPensionForm ?? undefined}
              onInput={setSimPensionForm}
              initialResult={simPension ?? undefined}
            />
          );
        })()}

      {result && retirement && (
        <JobExit
          defaultSalary={profile.insuredMonthlySalary ?? 0}
          yearsToRetirement={Math.max(1, Math.round(retirement.monthsToRetirement / 12))}
          defaultReturnPct={assumptions.annualReturnPct}
          onUnauthorized={logout}
          onResult={setJobExit}
          initial={jobExitForm ?? undefined}
          onInput={setJobExitForm}
          initialResult={jobExit ?? undefined}
        />
      )}

      {result && retirement && (
        <Decumulation
          defaultCapital={result.totals.central.totalLumpSum}
          retirementAge={
            Math.round((retirement.effectiveRetirementAgeMonths / 12) * 10) / 10
          }
          onUnauthorized={logout}
          onResult={setDecum}
          initial={decumForm ?? undefined}
          onInput={setDecumForm}
          initialResult={decum ?? undefined}
        />
      )}

      {result &&
        retirement &&
        (() => {
          const annuityProducts = products.filter(
            (p) => TYPE_META[p.type].isAnnuity && !p.frozen,
          );
          const totalBalance = annuityProducts.reduce((s, p) => s + p.currentBalance, 0);
          const totalDeposit = annuityProducts.reduce((s, p) => s + p.monthlyDeposit, 0);
          const avgFeeDeposit = annuityProducts.length
            ? annuityProducts.reduce((s, p) => s + p.feeFromDepositPct, 0) /
              annuityProducts.length
            : 0;
          const avgFeeBalance = annuityProducts.length
            ? annuityProducts.reduce((s, p) => s + p.feeFromBalancePct, 0) /
              annuityProducts.length
            : 0;
          const avgFactor = annuityProducts.length
            ? annuityProducts.reduce((s, p) => s + (p.conversionFactor ?? 200), 0) /
              annuityProducts.length
            : 200;
          return (
            <LifePath
              defaultBalance={totalBalance}
              defaultMonthlyDeposit={totalDeposit}
              feeFromDepositPct={avgFeeDeposit}
              feeFromBalancePct={avgFeeBalance}
              defaultReturnPct={assumptions.annualReturnPct}
              defaultSalaryGrowthPct={assumptions.annualSalaryGrowthPct}
              months={Math.max(1, retirement.monthsToRetirement)}
              conversionFactor={avgFactor}
              onUnauthorized={logout}
            />
          );
        })()}

      {result &&
        retirement &&
        (() => {
          const annuityBalanceAtRetirement = result.products
            .filter((p) => p.isAnnuity)
            .reduce((s, p) => s + p.projection.central.finalBalance, 0);
          return (
            <AnnuityTrack
              defaultBalance={annuityBalanceAtRetirement}
              defaultRetirementAge={
                Math.round((retirement.effectiveRetirementAgeMonths / 12) * 10) / 10
              }
              hasSpouse={hasSpouse(profile.maritalStatus)}
              onUnauthorized={logout}
              onResult={setAnnuityTrack}
              initial={annuityTrackForm ?? undefined}
              onInput={setAnnuityTrackForm}
              initialResult={annuityTrack ?? undefined}
            />
          );
        })()}

      {result &&
        retirement &&
        (() => {
          const annuityProducts = products.filter((p) => TYPE_META[p.type].isAnnuity && !p.frozen);
          const largest = annuityProducts.reduce(
            (best, p) => (p.currentBalance > (best?.currentBalance ?? -1) ? p : best),
            null as PortfolioProductInput | null,
          );
          const totalBalance = annuityProducts.reduce((s, p) => s + p.currentBalance, 0);
          const totalDeposit = annuityProducts.reduce((s, p) => s + p.monthlyDeposit, 0);
          return (
            <FundSwitch
              defaultBalance={totalBalance}
              defaultMonthlyDeposit={totalDeposit}
              defaultReturnPct={assumptions.annualReturnPct}
              defaultSalaryGrowthPct={assumptions.annualSalaryGrowthPct}
              months={Math.max(1, retirement.monthsToRetirement)}
              currentFeeFromDepositPct={largest?.feeFromDepositPct ?? 1}
              currentFeeFromBalancePct={largest?.feeFromBalancePct ?? 0.5}
              currentConversionFactor={largest?.conversionFactor ?? 200}
              onUnauthorized={logout}
              onResult={setFundSwitch}
              initial={fundSwitchForm ?? undefined}
              onInput={setFundSwitchForm}
              initialResult={fundSwitch ?? undefined}
            />
          );
        })()}

      {result &&
        (() => {
          const age = Math.floor(
            (Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000),
          );
          const capitalBalance = result.totals.central.totalLumpSum;
          return (
            <Section190
              defaultBalance={capitalBalance}
              defaultAge={age}
              defaultReturnPct={assumptions.annualReturnPct}
              onUnauthorized={logout}
              onResult={setSection190}
              initial={section190Form ?? undefined}
              onInput={setSection190Form}
              initialResult={section190 ?? undefined}
            />
          );
        })()}

      {result && (
        <FundLoan
          defaultReturnPct={assumptions.annualReturnPct}
          onUnauthorized={logout}
          onResult={setFundLoan}
          initial={fundLoanForm ?? undefined}
          onInput={setFundLoanForm}
          initialResult={fundLoan ?? undefined}
        />
      )}

      {result && (
        <DivorcePensionSplit
          onUnauthorized={logout}
          onResult={setDivorceSplit}
          initial={divorceSplitForm ?? undefined}
          onInput={setDivorceSplitForm}
          initialResult={divorceSplit ?? undefined}
        />
      )}

      {result && (
        <section className="results ai-section">
          <div className="whatif-head">
            <h2 className="results-title">{IconSparkles} ניתוח והמלצות AI</h2>
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
              {(aiMeta || aiAnalyzedAt) && (
                <div className="ai-meta">
                  {aiMeta}
                  {aiMeta && aiAnalyzedAt && ' · '}
                  {aiAnalyzedAt && `נשמר מ-${formatAiTimestamp(aiAnalyzedAt)}`}
                </div>
              )}
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

          {aiConfigured && <AiChat onUnauthorized={logout} />}
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
  /** האם יש בן/בת זוג כרגע — קובע זכאות לוויתור על חלק בן/בת הזוג בכיסוי שאירים */
  hasCurrentSpouse: boolean;
  /** מספר ילדים זכאים (מתחת לגיל 21) — כיסויים שלהם לא ניתנים לוויתור בשום מצב */
  eligibleChildren: number;
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
        ) : meta.insuranceOnly ? (
          <span className="type-pill insurance">ביטוחי</span>
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
        {p.type === 'PROVIDENT_INVESTMENT' && (
          <>
            <span className="type-pill liquid">נזילה תמיד</span>
            <span
              className="tip"
              data-tip="קופת גמל להשקעה נזילה בכל עת, ללא ותק מינימלי — אבל משיכה כהון חייבת במס רווח הון ריאלי (25%). אם ממתינים לגיל 60 ומושכים כקצבה חודשית, הרווח פטור ממס לגמרי. המערכת עדיין לא מחשבת מס אוטומטית — זה שיקול לקחת בחשבון בעצמך."
              tabIndex={0}
            >
              ⓘ
            </span>
          </>
        )}
        {p.type === 'MONEY_MARKET_FUND' && (
          <>
            <span className="type-pill liquid">נזילה תמיד</span>
            <span
              className="tip"
              data-tip="קרן כספית נזילה בכל עת, ללא ותק מינימלי — אבל בניגוד לקופת גמל להשקעה, אין לה מסלול המרה לקצבה פטורה ממס: כל משיכה חייבת במס רווח הון ריאלי (25%), בלי יוצא מן הכלל. אינה מוצר פנסיוני — אין הטבת מס בהפקדה ואין הפקדת מעסיק."
              tabIndex={0}
            >
              ⓘ
            </span>
          </>
        )}
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
        {p.type === 'LIFE_INSURANCE' ? (
          <>
            <MoneyField
              label="סכום ביטוח למקרה מוות"
              value={p.deathBenefitAmount ?? 0}
              onChange={(v) => onChange({ deathBenefitAmount: v === 0 ? undefined : v })}
              tooltip="הסכום החד-פעמי שישולם למוטבים במקרה מוות. איפה למצוא: דף פרטי הביטוח של הפוליסה או 'הר הביטוח'."
            />
            <MoneyField
              label="פרמיה חודשית"
              value={p.monthlyCoverageCost}
              onChange={(v) => onChange({ monthlyCoverageCost: v })}
              tooltip="עלות הפוליסה בחודש — לידיעה ולניתוח כדאיות; אינה משפיעה על תחזית הצבירה."
            />
          </>
        ) : meta.insuranceOnly ? (
          <>
            <MoneyField
              label="שכר מבוטח בפוליסה"
              value={p.insuredMonthlySalary ?? 0}
              onChange={(v) => onChange({ insuredMonthlySalary: v === 0 ? undefined : v })}
              tooltip="השכר שהפוליסה מכסה — לרוב החלק שאינו מבוטח בקרן הפנסיה (למשל השכר שמופקד לקופת גמל). איפה למצוא: דף פרטי הביטוח של הפוליסה."
            />
            <Field
              label="כיסוי נכות"
              unit="%"
              value={p.disabilityPct ?? 75}
              onChange={(v) => onChange({ disabilityPct: v })}
              tooltip="אחוז השכר המבוטח שישולם כקצבה חודשית באובדן כושר עבודה. מקסימום מקובל: 75%."
            />
            <MoneyField
              label="פרמיה חודשית"
              value={p.monthlyCoverageCost}
              onChange={(v) => onChange({ monthlyCoverageCost: v })}
              tooltip="עלות הפוליסה בחודש — לידיעה ולניתוח כדאיות; אינה משפיעה על תחזית הצבירה."
            />
          </>
        ) : (
          <>
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
          </>
        )}
        {!meta.insuranceOnly && meta.maxDepositFee > 0 && (
          <Field
            label={`ד"נ מהפקדה (עד ${meta.maxDepositFee})`}
            unit="%"
            value={p.feeFromDepositPct}
            step={0.01}
            onChange={(v) => onChange({ feeFromDepositPct: v })}
            tooltip="אחוז שנגבה מכל הפקדה חדשה לפני שהיא נכנסת לחיסכון. איפה למצוא: הדוח השנתי, סעיף 'דמי ניהול מהפקדות'."
          />
        )}
        {!meta.insuranceOnly && (
        <Field
          label='ד"נ מצבירה (שנתי)'
          unit="%"
          value={p.feeFromBalancePct}
          step={0.001}
          onChange={(v) => onChange({ feeFromBalancePct: v })}
          tooltip="אחוז שנתי שנגבה מכלל היתרה הצבורה. איפה למצוא: הדוח השנתי, סעיף 'דמי ניהול מצבירה' — נקוב בדיוק של עד 3 ספרות (למשל 0.145%)."
        />
        )}
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
        {!meta.insuranceOnly && INSURED_PENSION_TYPES.has(p.type) && !p.frozen && (
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
            <DateField
              value={p.joinDate ?? ''}
              onChange={(v) => onChange({ joinDate: v })}
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
      {(!meta.insuranceOnly || p.type === 'LIFE_INSURANCE') && (
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
      )}

      {(!meta.insuranceOnly || p.type === 'LIFE_INSURANCE') && (
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
          <div key={i} className="bens-row-wrap">
            <div className="bens-row">
              <label className="field">
                <span className="field-label">שם מוטב</span>
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
              </label>
              <label className="field">
                <span className="field-label">אחוז</span>
                <div className="input-wrap has-unit">
                  <input
                    type="number"
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
                  <span className="unit">%</span>
                </div>
              </label>
              <div className="field bens-remove-col">
                <span className="field-label">&nbsp;</span>
                <button
                  className="chip-remove bens-remove"
                  title="הסר מוטב"
                  onClick={() =>
                    onChange({
                      beneficiaries: (p.beneficiaries ?? []).filter((_, ii) => ii !== i),
                    })
                  }
                >
                  ✕
                </button>
              </div>
            </div>
            {!(b.name.trim() && b.pct > 0) && (
              <div className="bens-row-warning">
                ⚠ {!b.name.trim() && b.pct <= 0
                  ? 'שורה ריקה — לא תישמר'
                  : !b.name.trim()
                    ? 'חסר שם — השורה הזו לא תישמר'
                    : 'חסר אחוז (מעל 0%) — השורה הזו לא תישמר'}
              </div>
            )}
          </div>
        ))}
        <BeneficiaryBar beneficiaries={p.beneficiaries ?? []} />
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
      )}

      {p.type === 'DISABILITY_INSURANCE' && (
        <label className="waiver-row">
          <input
            type="checkbox"
            checked={p.umbrella ?? false}
            onChange={(e) => onChange({ umbrella: e.target.checked })}
          />
          <span>
            כוללת מטריה ביטוחית
            <span
              className="tip"
              data-tip="מטריה ביטוחית משדרגת את כיסוי הנכות של קרן הפנסיה: הגדרה עיסוקית (כיסוי אם אינך יכול לעבוד במקצוע שלך), ביטול קיזוז ביטוח לאומי וביטול תקופת אכשרה."
              tabIndex={0}
            >
              ⓘ
            </span>
          </span>
        </label>
      )}
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
        <label className={`waiver-row ${props.hasCurrentSpouse ? 'disabled' : ''}`}>
          <input
            type="checkbox"
            checked={p.survivorsWaiver ?? false}
            disabled={props.hasCurrentSpouse}
            onChange={(e) => {
              const checked = e.target.checked;
              onChange({
                survivorsWaiver: checked,
                survivorsWaiverDate:
                  checked && !p.survivorsWaiverDate
                    ? new Date().toISOString().slice(0, 10)
                    : p.survivorsWaiverDate,
              });
            }}
          />
          <span>
            ויתור על כיסוי שאירים לבן/בת הזוג
            <span
              className="tip"
              data-tip={
                props.hasCurrentSpouse
                  ? 'לא ניתן לוותר — יש בן/בת זוג כרגע. הוויתור בתקנון חל רק על חלק הכיסוי לבן/בת הזוג, וזמין רק כשאין בן/בת זוג בפועל.'
                  : props.eligibleChildren > 0
                    ? `אין בן/בת זוג כרגע — ניתן לוותר על חלק הכיסוי לבן/בת הזוג בלבד ולהוזיל עלויות. כיסוי ${props.eligibleChildren} הילדים הזכאים (מתחת לגיל 21) ימשיך לחול במלואו תמיד — לא ניתן לוותר עליו בשום מצב. הוויתור תקף לשנתיים בלבד ודורש חידוש.`
                    : 'אין בן/בת זוג ואין ילדים מתחת לגיל 21 — ניתן לוותר על כיסוי השאירים ולהגדיל את החיסכון. הוויתור תקף לשנתיים בלבד וחייב חידוש בהצהרה חוזרת.'
              }
              tabIndex={0}
            >
              ⓘ
            </span>
          </span>
        </label>
      )}
      {INSURED_PENSION_TYPES.has(p.type) && !p.frozen && p.survivorsWaiver && !props.hasCurrentSpouse && (
        <label className="field" style={{ marginTop: 8, maxWidth: 220 }}>
          <span className="field-label">תאריך חתימת הוויתור</span>
          <DateField
            value={p.survivorsWaiverDate ?? ''}
            onChange={(v) => onChange({ survivorsWaiverDate: v })}
          />
        </label>
      )}
      {INSURED_PENSION_TYPES.has(p.type) &&
        !p.frozen &&
        p.survivorsWaiver &&
        props.hasCurrentSpouse && (
          <p className="warning-item" style={{ marginTop: 8 }}>
            ⚠ מסומן ויתור על כיסוי שאירים למרות שיש בן/בת זוג כרגע — כדאי לבטל את הסימון, אחרת
            במקרה מוות עלול להיפגע הכיסוי לבן/בת הזוג.
          </p>
        )}
      {INSURED_PENSION_TYPES.has(p.type) &&
        !p.frozen &&
        p.survivorsWaiver &&
        p.survivorsWaiverDate &&
        isWaiverExpired(p.survivorsWaiverDate) && (
          <p className="warning-item" style={{ marginTop: 8 }}>
            ⚠ הוויתור על כיסוי שאירים נחתם לפני מעל שנתיים ({p.survivorsWaiverDate}) — פג תוקפו,
            יש לחדש את ההצהרה מול הקרן.
          </p>
        )}

      <div className="bens transfers">
        <span className="bens-label">
          היסטוריית ניוד
          <span
            className="tip"
            data-tip="תיעוד אם הכספים כאן הגיעו מניוד ממוצר אחר — למשל קופת גמל שמקורה בביטוח מנהלים. שווה לרשום מה אבד במעבר (כגון מקדם המרה מובטח), כדי לזכור את זה בעתיד."
            tabIndex={0}
          >
            ⓘ
          </span>
        </span>
        {(p.transfers ?? []).map((t, i) => (
          <div key={i} className="transfer-card">
            <div className="transfer-card-head">
              <span className="transfer-index">
                ניוד{t.fromProvider ? ` · ${t.fromProvider}` : ` #${i + 1}`}
              </span>
              <button
                className="chip-remove"
                title="הסר רשומת ניוד"
                onClick={() =>
                  onChange({
                    transfers: (p.transfers ?? []).filter((_, ii) => ii !== i),
                  })
                }
              >
                ✕
              </button>
            </div>
            <div className="transfer-fields">
              <label className="field">
                <span className="field-label">גוף מקור</span>
                <input
                  type="text"
                  placeholder="למשל: מנורה"
                  value={t.fromProvider}
                  onChange={(e) =>
                    onChange({
                      transfers: (p.transfers ?? []).map((tt, ii) =>
                        ii === i ? { ...tt, fromProvider: e.target.value } : tt,
                      ),
                    })
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">סוג מוצר מקורי</span>
                <input
                  type="text"
                  placeholder="למשל: ביטוח מנהלים"
                  value={t.fromType ?? ''}
                  onChange={(e) =>
                    onChange({
                      transfers: (p.transfers ?? []).map((tt, ii) =>
                        ii === i ? { ...tt, fromType: e.target.value } : tt,
                      ),
                    })
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">תאריך ניוד</span>
                <DateField
                  value={t.transferDate}
                  onChange={(v) =>
                    onChange({
                      transfers: (p.transfers ?? []).map((tt, ii) =>
                        ii === i ? { ...tt, transferDate: v } : tt,
                      ),
                    })
                  }
                />
              </label>
              <label className="field transfer-note-field">
                <span className="field-label">מה אבד/השתנה</span>
                <input
                  type="text"
                  placeholder="מקדם המרה מובטח, תנאים..."
                  value={t.note ?? ''}
                  onChange={(e) =>
                    onChange({
                      transfers: (p.transfers ?? []).map((tt, ii) =>
                        ii === i ? { ...tt, note: e.target.value } : tt,
                      ),
                    })
                  }
                />
              </label>
            </div>
          </div>
        ))}
        <button
          className="add-chip small"
          onClick={() =>
            onChange({
              transfers: [
                ...(p.transfers ?? []),
                { fromProvider: '', fromType: '', transferDate: '', note: '' },
              ],
            })
          }
        >
          + רשומת ניוד
        </button>
      </div>
    </div>
  );
}

// ---------- ציון בריאות פנסיוני ----------

function HealthScoreCard({ h }: { h: HealthScoreResult }) {
  const [open, setOpen] = useState(false);
  const angle = Math.round((h.total / 100) * 360);
  return (
    <div className={`card health-card ${h.grade}`}>
      <div className="health-main">
        <div
          className="health-ring"
          style={{
            background: `conic-gradient(var(--ring-color) ${angle}deg, rgba(148,163,184,0.15) ${angle}deg)`,
          }}
          role="img"
          aria-label={`ציון בריאות פנסיוני: ${h.total} מתוך 100`}
        >
          <div className="health-ring-inner">
            <span className="health-total">{h.total}</span>
            <span className="health-max">/100</span>
          </div>
        </div>
        <div className="health-info">
          <h3 className="health-title">
            ציון בריאות פנסיוני: <span className="health-grade">{h.gradeLabel}</span>
            <span
              className="tip"
              data-tip="ציון משוקלל (מפרט 7.1): שיעור תחלופה 35 נק', דמי ניהול 20, כיסוי שאירים 15, כיסוי אכ&quot;ע 15, התאמת מסלול לגיל 10, היגיינה 5. מחושב מהנתונים שהוזנו — לא ייעוץ."
              tabIndex={0}
            >
              ⓘ
            </span>
          </h3>
          {h.topRecommendations.length > 0 ? (
            <ul className="health-recs">
              {h.topRecommendations.slice(0, 3).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="health-recs-none">כל המדדים תקינים — המשך לעקוב אחת לשנה</p>
          )}
          <button className="trace-toggle" onClick={() => setOpen(!open)}>
            {open ? 'הסתר פירוט' : 'פירוט הרכיבים'}
          </button>
        </div>
      </div>
      {open && (
        <div className="health-components">
          {h.components.map((c) => (
            <div key={c.key} className="health-comp">
              <div className="health-comp-head">
                <span>{c.label}</span>
                <span className="health-comp-score">
                  {c.score}/{c.max}
                </span>
              </div>
              <div className="health-comp-bar">
                <div
                  className="health-comp-fill"
                  style={{ width: `${Math.round((c.score / c.max) * 100)}%` }}
                />
              </div>
              <div className="health-comp-detail">{c.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- מנוע תובנות ----------

const INSIGHT_SEVERITY_LABEL: Record<Insight['severity'], string> = {
  critical: 'קריטי',
  warning: 'לתשומת לב',
  info: 'הזדמנות',
};

function InsightsPanel({ data }: { data: InsightsResult }) {
  return (
    <div className="card insights-card">
      <h3 className="results-title" style={{ fontSize: '1rem' }}>
        {IconSparkles} תובנות ואיתור בעיות ({data.insights.length})
      </h3>
      <ul className="insights-list">
        {data.insights.map((ins) => (
          <li key={ins.id} className={`insight-item ${ins.severity}`}>
            <span
              className="insight-severity-badge"
              title={INSIGHT_SEVERITY_LABEL[ins.severity]}
            >
              {INSIGHT_SEVERITY_LABEL[ins.severity]}
            </span>
            <div className="insight-body">
              <div className="insight-title">{ins.title}</div>
              <div className="insight-detail">{ins.detail}</div>
            </div>
            {ins.estimatedAnnualImpact !== undefined && ins.estimatedAnnualImpact > 0 && (
              <span className="insight-impact">{nis(ins.estimatedAnnualImpact)}/שנה</span>
            )}
          </li>
        ))}
      </ul>
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
        <dd>{nis(props.t.totalMonthlyAnnuity + props.t.niOldAgeMonthly)}</dd>
        {props.t.niOldAgeMonthly > 0 && (
          <>
            <dt className="ni-sub">מזה אזרח ותיק (ביטוח לאומי)</dt>
            <dd className="ni-sub">{nis(props.t.niOldAgeMonthly)}</dd>
          </>
        )}
        <dt>הון חד־פעמי נזיל</dt>
        <dd>{nis(props.t.totalLumpSum)}</dd>
        <dt>סך דמי ניהול</dt>
        <dd className="fees">{nis(props.t.totalFeesPaid)}</dd>
      </dl>
    </div>
  );
}

// ---------- מרנדר Markdown מינימלי לתשובות AI ----------

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

/** צבעים קטגוריאליים בסדר קבוע — לא מוגרלים, לא תלויי-נתונים (עקרון dataviz) */
const BENEFICIARY_COLORS = ['#a78bfa', '#818cf8', '#f2c464', '#4ade80', '#f0857d', '#2dd4bf'];

/** פס חלוקת מוטבים — part-to-whole קטן, עם מקרא (שם + %) מתחתיו */
function BeneficiaryBar(props: { beneficiaries: { name: string; pct: number }[] }) {
  const items = props.beneficiaries.filter((b) => b.pct > 0 && b.name.trim());
  if (items.length === 0) return null;
  const total = items.reduce((s, b) => s + b.pct, 0);
  const remainder = Math.max(0, 100 - total);
  return (
    <div className="bens-chart">
      <div className="bens-bar">
        {items.map((b, i) => (
          <div
            key={i}
            className="bens-bar-seg"
            style={{ width: `${b.pct}%`, background: BENEFICIARY_COLORS[i % BENEFICIARY_COLORS.length] }}
          />
        ))}
        {remainder > 0 && (
          <div className="bens-bar-seg bens-bar-rest" style={{ width: `${remainder}%` }} />
        )}
      </div>
      <div className="bens-legend">
        {items.map((b, i) => (
          <span key={i} className="bens-legend-item">
            <span
              className="bens-legend-dot"
              style={{ background: BENEFICIARY_COLORS[i % BENEFICIARY_COLORS.length] }}
            />
            {b.name} {b.pct}%
          </span>
        ))}
        {remainder > 0 && (
          <span className="bens-legend-item">
            <span className="bens-legend-dot bens-legend-dot-rest" />
            יורשים על פי דין {remainder}%
          </span>
        )}
      </div>
    </div>
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
