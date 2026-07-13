// PensiaMng client — API layer

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3210';
const TOKEN_KEY = 'pensiamng_token';
const USER_KEY = 'pensiamng_user';

// ---------- ניהול אסימון התחברות ----------

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** נזרק כשהשרת מחזיר 401 — האפליקציה מנתבת חזרה למסך התחברות */
export class UnauthorizedError extends Error {}

export interface ProjectionInput {
  currentBalance: number;
  monthlyDeposit: number;
  feeFromDepositPct: number;
  feeFromBalancePct: number;
  monthlyCoverageCost: number;
  annualReturnPct: number;
  annualSalaryGrowthPct: number;
  months: number;
}

export interface SeriesPoint {
  /** חודשים מהיום (0 = היום) */
  month: number;
  balance: number;
}

export interface ProjectionScenario {
  annualReturnPct: number;
  finalBalance: number;
  series: SeriesPoint[];
  totalNetDeposits: number;
  totalFeesPaid: number;
  totalCoverageCost: number;
}

export interface CalcTrace {
  formula: string;
  inputs: Record<string, number | string>;
  notes: string[];
}

export interface ProjectionResult {
  pessimistic: ProjectionScenario;
  central: ProjectionScenario;
  optimistic: ProjectionScenario;
  trace: CalcTrace;
}

export interface AnnuityResult {
  monthlyAnnuity: number;
  trace: CalcTrace;
}

// ---------- תיק פנסיוני ----------

export type ProductType =
  | 'PENSION_COMPREHENSIVE'
  | 'PENSION_GENERAL'
  | 'MANAGERS_INSURANCE'
  | 'PROVIDENT_FUND'
  | 'PROVIDENT_INVESTMENT'
  | 'IRA'
  | 'STUDY_FUND'
  | 'DISABILITY_INSURANCE'
  | 'LIFE_INSURANCE';

export interface PortfolioProductInput {
  id: string;
  name: string;
  type: ProductType;
  currentBalance: number;
  monthlyDeposit: number;
  feeFromDepositPct: number;
  feeFromBalancePct: number;
  monthlyCoverageCost: number;
  annualReturnPct?: number;
  conversionFactor?: number;
  /** שכר מבוטח בקרן זו ("שכר קובע") — ריק = השכר הגלובלי */
  insuredMonthlySalary?: number;
  /** קרן לא פעילה (מוקפאת) — למשל לאחר גירושין; ללא הפקדות וללא כיסויים */
  frozen?: boolean;
  /** כיסויים ביטוחיים (קרנות פנסיה) */
  survivorsPct?: number;
  disabilityPct?: number;
  survivorsWaiver?: boolean;
  /** סכום ביטוח למקרה מוות (ביטוח מנהלים) */
  deathBenefitAmount?: number;
  /** מוטבים — ריק = יורשים על פי דין */
  beneficiaries?: Beneficiary[];
  /** הקצאת מסלולי השקעה — ריק = הנחת התשואה הגלובלית */
  tracks?: TrackAllocation[];
  /** תאריך פתיחת הקרן (ISO) — לחישוב ותק ונזילות (קרן השתלמות: 6 שנים) */
  joinDate?: string;
  /** מטריה ביטוחית (אכ"ע פרטי) */
  umbrella?: boolean;
  /** היסטוריית ניוד — מקור הכספים אם הועברו ממוצר אחר (למשל ביטוח מנהלים → קופת גמל) */
  transfers?: ProductTransfer[];
}

export interface ProductTransfer {
  /** גוף מנהל מקור, למשל "מנורה" */
  fromProvider: string;
  /** סוג מוצר מקור בטקסט חופשי, למשל "ביטוח מנהלים" */
  fromType?: string;
  /** ISO yyyy-mm-dd */
  transferDate: string;
  /** מה אבד/השתנה — תנאים, מקדם מובטח וכו' */
  note?: string;
}

export interface Beneficiary {
  name: string;
  pct: number;
}

export interface TrackAllocation {
  category: string;
  pct: number;
}

export interface TrackDef {
  category: string;
  label: string;
  realReturnPct: number;
  riskLevel: number;
}

export function getTracks(): Promise<TrackDef[]> {
  return request<TrackDef[]>('GET', '/calc/tracks');
}

// ---------- מודול AI (מפרט פרק 10א) ----------

export type AiProvider = 'anthropic' | 'openai';

export interface AiSettingsView {
  provider: AiProvider;
  model: string;
  hasKey: boolean;
  keyMask: string | null;
  /** תקרת הוצאה חודשית ($); null = ללא הגבלה */
  monthlyBudgetUsd: number | null;
}

export interface AiModelInfo {
  id: string;
  label: string;
}

export interface AnalyzeResult {
  text: string;
  provider: AiProvider;
  model: string;
}

export interface LastAnalysis extends AnalyzeResult {
  /** ISO — מתי הניתוח הופק */
  analyzedAt: string;
}

export function getAiSettings(): Promise<AiSettingsView | null> {
  return request<AiSettingsView | null>('GET', '/ai/settings');
}

export function saveAiSettings(dto: {
  provider: AiProvider;
  apiKey?: string;
  model?: string;
  monthlyBudgetUsd?: number | null;
}): Promise<AiSettingsView> {
  return request<AiSettingsView>('PUT', '/ai/settings', dto);
}

/** רשימת המודלים הזמינים מהספק — משמש גם כבדיקת חיבור */
export function getAiModels(): Promise<AiModelInfo[]> {
  return request<AiModelInfo[]>('GET', '/ai/models');
}

export function aiAnalyze(context: unknown): Promise<AnalyzeResult> {
  return request<AnalyzeResult>('POST', '/ai/analyze', { context });
}

/**
 * ניתוח בזרימה: מקטעי הטקסט מגיעים דרך onDelta תוך כדי יצירה.
 * מחזיר את המטא-נתונים (ספק/מודל) בסיום; זורק שגיאה אם השרת דיווח על כשל.
 */
export async function aiAnalyzeStream(
  context: unknown,
  onDelta: (text: string) => void,
): Promise<{ provider: AiProvider; model: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/ai/analyze/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ context }),
  });
  if (res.status === 401) throw new UnauthorizedError('נדרשת התחברות מחדש');
  if (!res.ok || !res.body) throw new Error(`שגיאת שרת (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let meta: { provider: AiProvider; model: string } | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // אירועי SSE מופרדים בשורה ריקה
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const raw of events) {
      const lines = raw.split('\n');
      const eventLine = lines.find((l) => l.startsWith('event: '));
      const dataLine = lines.find((l) => l.startsWith('data: '));
      if (!eventLine || !dataLine) continue;
      const event = eventLine.slice(7).trim();
      const data = JSON.parse(dataLine.slice(6));
      if (event === 'delta') onDelta(data as string);
      else if (event === 'done') meta = data as { provider: AiProvider; model: string };
      else if (event === 'error') throw new Error((data as { message: string }).message);
    }
  }
  if (!meta) throw new Error('הזרימה הסתיימה ללא אישור סיום');
  return meta;
}

/** הניתוח האחרון שנשמר — נטען עם הכניסה כדי לא לנתח מחדש כל פעם */
export function getLastAiAnalysis(): Promise<LastAnalysis | null> {
  return request<LastAnalysis | null>('GET', '/ai/last');
}

export interface AiUsageView {
  monthCostUsd: number;
  monthInputTokens: number;
  monthOutputTokens: number;
  budgetUsd: number | null;
  usagePct: number | null;
  entries: {
    capability: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    createdAt: string;
  }[];
}

/** ניצול ה-AI החודשי + יומן הקריאות (מפרט 10א) */
export function getAiUsage(): Promise<AiUsageView> {
  return request<AiUsageView>('GET', '/ai/usage');
}

// ---------- יועץ צ'אט AI עם Tool Use ----------

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  text: string;
  /** הכלים שהמודל הפעיל — לשקיפות */
  toolCalls: { name: string }[];
  provider: AiProvider;
  model: string;
}

export function aiChat(messages: ChatMessage[]): Promise<ChatResult> {
  return request<ChatResult>('POST', '/ai/chat', { messages });
}

export interface PortfolioInput {
  months: number;
  annualSalaryGrowthPct: number;
  annualReturnPct: number;
  /** שכר חודשי — לחישוב שיעור תחלופה */
  insuredMonthlySalary?: number;
  /** קצבת אזרח ותיק מביטוח לאומי — נכללת בקצבה ובשיעור התחלופה */
  nationalInsurance?: {
    include: boolean;
    insuranceYears: number;
    spouseSupplementEligible?: boolean;
  };
  products: PortfolioProductInput[];
}

export interface ScenarioTriple {
  pessimistic: number;
  central: number;
  optimistic: number;
}

export interface PortfolioProductResult {
  id: string;
  name: string;
  type: ProductType;
  isAnnuity: boolean;
  projection: ProjectionResult;
  monthlyAnnuity?: ScenarioTriple;
}

export interface PortfolioScenarioTotals {
  totalBalance: number;
  series: SeriesPoint[];
  totalMonthlyAnnuity: number;
  /** קצבת אזרח ותיק מביטוח לאומי (0 כשלא נכללה) */
  niOldAgeMonthly: number;
  totalLumpSum: number;
  totalFeesPaid: number;
  /** קצבה ÷ שכר בפרישה, באחוזים; null אם לא נמסר שכר */
  replacementRatePct: number | null;
}

export interface PortfolioResult {
  products: PortfolioProductResult[];
  totals: {
    pessimistic: PortfolioScenarioTotals;
    central: PortfolioScenarioTotals;
    optimistic: PortfolioScenarioTotals;
  };
  trace: CalcTrace;
}

export function calcPortfolio(input: PortfolioInput): Promise<PortfolioResult> {
  return post<PortfolioResult>('/calc/portfolio', input);
}

// ---------- התחברות ושמירת תיק ----------

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export function register(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthResult> {
  return post<AuthResult>('/auth/register', { email, password, fullName });
}

/** אתגר 2FA — מוחזר במקום טוקן כש-2FA מופעל למשתמש; יש להשלים ב-verifyTwoFa */
export interface TwoFaChallenge {
  requires2fa: true;
  tempToken: string;
}

export type LoginResult = AuthResult | TwoFaChallenge;

export function login(email: string, password: string): Promise<LoginResult> {
  return post<LoginResult>('/auth/login', { email, password });
}

/** האימייל הקבוע של חשבון ההדגמה — משמש לזיהוי "מצב הדגמה" בממשק */
export const DEMO_EMAIL = 'demo@pensiamng.local';

/**
 * כניסת דמו בלחיצה אחת — חשבון נפרד לגמרי מהמשתמשים הרשומים, מאופס
 * לתיק הדגמה מלא (כל סוגי המוצרים + מבט זוגי) בכל כניסה.
 */
export function demoLogin(): Promise<AuthResult> {
  return post<AuthResult>('/auth/demo-login', {});
}

// ---------- אימות דו-שלבי (2FA) ויומן גישה (מפרט §11) ----------

export interface TwoFaSetup {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface TwoFaStatus {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
}

export interface AuditEntry {
  action: string;
  success: boolean;
  ip: string | null;
  detail: string | null;
  createdAt: string;
}

export function twoFaStatus(): Promise<TwoFaStatus> {
  return request<TwoFaStatus>('GET', '/auth/2fa/status');
}

export function twoFaSetup(): Promise<TwoFaSetup> {
  return post<TwoFaSetup>('/auth/2fa/setup', {});
}

export function twoFaEnable(code: string): Promise<{ backupCodes: string[] }> {
  return post('/auth/2fa/enable', { code });
}

export function twoFaDisable(code: string): Promise<{ ok: true }> {
  return post('/auth/2fa/disable', { code });
}

/** שלב 3 של ההתחברות: משלים את האתגר עם קוד מהאפליקציה או קוד גיבוי */
export function twoFaVerify(tempToken: string, code: string): Promise<AuthResult> {
  return post<AuthResult>('/auth/2fa/verify', { tempToken, code });
}

export function getAuditLog(): Promise<AuditEntry[]> {
  return request<AuditEntry[]>('GET', '/auth/audit-log');
}

/** קלט סימולטור קיבוע הזכויות — נשמר עם התיק */
export interface FixationFormInput {
  year: number;
  pension: number;
  taxRate: number;
  lumpSum: number;
  grants: PastGrant[];
}

/** קלט מחשבון הטבות המס — נשמר עם התיק */
export interface TaxFormInput {
  status: 'EMPLOYEE' | 'SELF_EMPLOYED';
  income: number;
  deposits: number;
  taxRate: number;
}

/** קלט סימולטור פרישה מדומה — נשמר עם התיק */
export interface SimPensionFormInput {
  startAge: number;
  balance: number;
  deposit: number;
  factorStart: number;
  factorLegal: number;
  taxRate: number;
}

/** קלט סימולטור עזיבת עבודה — נשמר עם התיק */
export interface JobExitFormInput {
  severance: number;
  years: number;
  salary: number;
  factor: number;
  taxRate: number;
}

/** קלט תוכנית המשיכה ההדרגתית — נשמר עם התיק */
export interface DecumFormInput {
  capital: number;
  withdrawal: number;
  targetAge: number;
  returnPct: number;
}

/** קלט השוואת מסלולי קצבה — נשמר עם התיק */
export interface AnnuityTrackFormInput {
  balance: number;
  retirementAge: number;
  retireeLifeExpectancyAge: number;
  hasSpouse: boolean;
  spouseAgeAtRetirement: number;
  spouseLifeExpectancyAge: number;
  options: AnnuityTrackOption[];
}

export interface PlanAssumptions {
  annualReturnPct: number;
  annualSalaryGrowthPct: number;
  /** עקיפה ידנית של גיל הפרישה החוקי; ריק = לפי חוק */
  plannedRetirementAge?: number;
  /** שדה מדור קודם (תיקים ישנים) */
  yearsToRetirement?: number;
  /**
   * קלטי הסימולטורים ותוצאותיהם האחרונות — נשמרים כחלק מ-JSON ההנחות
   * בשרת, כדי שהמחשבונים לא יתאפסו לריק בכל כניסה מחדש (הפאנל נפתח
   * אוטומטית ומציג את התוצאה השמורה במקום לדרוש "חשב" מחדש).
   */
  fixationInput?: FixationFormInput;
  fixationResult?: RightsFixationResult;
  taxInput?: TaxFormInput;
  taxResult?: TaxBenefitsResult;
  simPensionInput?: SimPensionFormInput;
  simPensionResult?: SimulatedPensionResult;
  jobExitInput?: JobExitFormInput;
  jobExitResult?: JobExitResult;
  decumInput?: DecumFormInput;
  decumResult?: DecumulationResult;
  annuityTrackInput?: AnnuityTrackFormInput;
  annuityTrackResult?: AnnuityTrackResult;
}

export type Gender = 'MALE' | 'FEMALE';

export type MaritalStatus =
  | 'SINGLE'
  | 'MARRIED'
  | 'COMMON_LAW'
  | 'DIVORCED'
  | 'WIDOWED';

export interface ChildInfo {
  /** ISO yyyy-mm-dd */
  birthDate: string;
  name?: string;
}

export interface ClientProfile {
  /** שם/כינוי להצגה — משמש בעיקר בתיק בן/בת הזוג (מבט זוגי) */
  fullName?: string;
  gender: Gender;
  /** ISO yyyy-mm-dd */
  birthDate: string;
  maritalStatus?: MaritalStatus;
  /** שכר חודשי מבוטח (₪) */
  insuredMonthlySalary?: number;
  children?: ChildInfo[];
}

export interface SavedPortfolio {
  assumptions: PlanAssumptions | null;
  profile: ClientProfile | null;
  products: PortfolioProductInput[];
}

// ---------- חישוב גיל פרישה ----------

export interface RetirementInput {
  gender: Gender;
  birthDate: string;
  plannedRetirementAge?: number;
}

export interface RetirementResult {
  legalRetirementAgeMonths: number;
  legalRetirementAgeLabel: string;
  effectiveRetirementAgeMonths: number;
  retirementDate: string;
  monthsToRetirement: number;
  alreadyEligible: boolean;
  trace: CalcTrace;
}

export function calcRetirement(input: RetirementInput): Promise<RetirementResult> {
  return post<RetirementResult>('/calc/retirement', input);
}

// ---------- תרחישי מוות ונכות ----------

export interface ScenariosInput {
  family: { hasSpouse: boolean; childrenBirthDates: string[] };
  insuredMonthlySalary: number;
  incomeTargetPct?: number;
  /** נקודת ייחוס לאירוע — לתרחישי "בעוד X שנים" */
  asOf?: string;
  /** מצב "אחרי פרישה" — כללי שלב הקצבה */
  retirementPhase?: { monthsSinceRetirement: number };
  /** שילוב קצבאות ביטוח לאומי בתרחישים */
  nationalInsurance?: { include: boolean; spouseAge?: number };
  products: {
    id: string;
    name: string;
    type: ProductType;
    currentBalance: number;
    insuredMonthlySalary?: number;
    frozen?: boolean;
    survivorsPct?: number;
    disabilityPct?: number;
    survivorsWaiver?: boolean;
    deathBenefitAmount?: number;
    beneficiaries?: Beneficiary[];
    umbrella?: boolean;
    /** שלב פרישה */
    monthlyAnnuity?: number;
    balanceAtRetirement?: number;
  }[];
}

export interface DeathProductOutcome {
  id: string;
  name: string;
  type: ProductType;
  survivorMonthly: number;
  spouseMonthly: number;
  childrenMonthly: number;
  lumpSum: number;
  lumpSumSplit: { name: string; amount: number }[];
  detail: string;
}

export interface DisabilityProductOutcome {
  id: string;
  name: string;
  type: ProductType;
  disabilityMonthly: number;
  detail: string;
}

export interface ScenariosResult {
  death: {
    eligibleChildren: number;
    totalSurvivorMonthly: number;
    /** קצבת שאירים מביטוח לאומי (0 כשלא נכלל) */
    niSurvivorsMonthly: number;
    totalLumpSum: number;
    targetMonthly: number;
    gapMonthly: number;
    products: DeathProductOutcome[];
  };
  disability: {
    totalDisabilityMonthly: number;
    uncappedTotalMonthly: number;
    excessMonthly: number;
    /** קצבת נכות כללית מביטוח לאומי (0 כשלא נכלל) */
    niDisabilityMonthly: number;
    /** הפחתת הקרן בגין קיזוז ביטוח לאומי */
    niOffsetReduction: number;
    targetMonthly: number;
    gapMonthly: number;
    products: DisabilityProductOutcome[];
  };
  warnings: string[];
  trace: CalcTrace;
}

export function calcScenarios(input: ScenariosInput): Promise<ScenariosResult> {
  return post<ScenariosResult>('/calc/scenarios', input);
}

// ---------- מסך משפחה — מבט זוגי, תרחישי שארים הדדיים (מפרט §9 פריט 5) ----------

export interface FamilyMemberInput {
  /** שם/כינוי להצגה */
  label: string;
  /** שכר מבוטח נוכחי — ההכנסה שממשיכה אם בן/בת הזוג האחר/ת נפטר/ת */
  insuredMonthlySalary: number;
  scenarios: ScenariosInput;
}

export interface FamilyScenariosInput {
  primary: FamilyMemberInput;
  spouse: FamilyMemberInput;
  /** יעד הכנסה משפחתי כאחוז מהכנסת הבסיס (ברירת מחדל 70%) */
  incomeTargetPct?: number;
}

export interface FamilyMemberOutcome {
  survivorLabel: string;
  ownContinuingIncome: number;
  productsSurvivorMonthly: number;
  niSurvivorsMonthly: number;
  lumpSum: number;
  totalHouseholdMonthly: number;
  gapMonthly: number;
  deceasedScenario: ScenariosResult;
}

export interface FamilyScenariosResult {
  baselineHouseholdMonthly: number;
  targetMonthly: number;
  ifPrimaryDies: FamilyMemberOutcome;
  ifSpouseDies: FamilyMemberOutcome;
  warnings: string[];
  trace: CalcTrace;
}

export function calcFamilyScenarios(
  input: FamilyScenariosInput,
): Promise<FamilyScenariosResult> {
  return post<FamilyScenariosResult>('/calc/family-scenarios', input);
}

export function spouseExists(): Promise<{ exists: boolean }> {
  return request<{ exists: boolean }>('GET', '/portfolio/spouse/exists');
}

export function loadSpousePortfolio(): Promise<SavedPortfolio> {
  return request<SavedPortfolio>('GET', '/portfolio/spouse');
}

export function saveSpousePortfolio(p: SavedPortfolio): Promise<SavedPortfolio> {
  return request<SavedPortfolio>('PUT', '/portfolio/spouse', p);
}

export function removeSpousePortfolio(): Promise<{ ok: true }> {
  return request<{ ok: true }>('DELETE', '/portfolio/spouse');
}

// ---------- ציון בריאות פנסיוני (מפרט 7.1) ----------

export interface HealthScoreProductInput {
  type: ProductType;
  frozen?: boolean;
  currentBalance: number;
  feeFromBalancePct: number;
  feeFromDepositPct: number;
  hasBeneficiaries: boolean;
  equityPct?: number;
  ageDependentTrack?: boolean;
}

export interface HealthScoreInput {
  age: number;
  replacementRatePct: number | null;
  deathCoverageRatio: number | null;
  disabilityCoverageRatio: number | null;
  products: HealthScoreProductInput[];
}

export interface HealthComponent {
  key:
    | 'replacement'
    | 'fees'
    | 'death_coverage'
    | 'disability_coverage'
    | 'track_fit'
    | 'hygiene';
  label: string;
  score: number;
  max: number;
  detail: string;
  recommendation?: string;
}

export interface HealthScoreResult {
  total: number;
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  gradeLabel: string;
  components: HealthComponent[];
  topRecommendations: string[];
  trace: CalcTrace;
}

export function calcHealthScore(input: HealthScoreInput): Promise<HealthScoreResult> {
  return post<HealthScoreResult>('/calc/health-score', input);
}

// ---------- הטבות מס בהפקדה (מפרט 6.1) ----------

export interface TaxBenefitsInput {
  employmentStatus: 'EMPLOYEE' | 'SELF_EMPLOYED';
  /** שכיר: שכר ברוטו חודשי; עצמאי: הכנסה שנתית ÷ 12 */
  monthlyIncome: number;
  /** סך ההפקדות השנתיות שלך (תגמולי עובד / הפקדות עצמאי) */
  annualOwnDeposits: number;
  marginalTaxRatePct?: number;
}

export interface TaxBenefitsResult {
  params: {
    qualifyingIncomeEmployeeMonthly: number;
    employeeCreditDepositPct: number;
    creditRatePct: number;
    qualifyingIncomeSelfAnnual: number;
    selfCreditPct: number;
    selfDeductionPct: number;
  };
  qualifyingIncomeAnnual: number;
  maxBenefitedDeposits: number;
  benefitedDeposits: number;
  taxCredit: number;
  deductionValue: number;
  totalAnnualSaving: number;
  remainingDepositAllowance: number;
  potentialExtraSaving: number;
  warnings: string[];
  trace: CalcTrace;
}

export function calcTaxBenefits(input: TaxBenefitsInput): Promise<TaxBenefitsResult> {
  return post<TaxBenefitsResult>('/calc/tax-benefits', input);
}

// ---------- פרישה מדומה (קצבה מגיל 60 תוך המשך עבודה) ----------

export interface SimulatedPensionInput {
  currentAge: number;
  startAge: number;
  legalRetirementAge: number;
  balanceNow: number;
  monthlyDeposit: number;
  annualReturnPct: number;
  conversionFactorAtStart: number;
  conversionFactorAtLegal: number;
  marginalTaxRatePct: number;
}

export interface SimulatedPensionResult {
  balanceAtStart: number;
  balanceAtLegal: number;
  earlyMonthlyGross: number;
  earlyMonthlyNetWhileWorking: number;
  waitMonthlyGross: number;
  windowMonths: number;
  totalNetDuringWindow: number;
  monthlyLossAfterLegal: number;
  breakEvenAge: number | null;
  warnings: string[];
  trace: CalcTrace;
}

export function calcSimulatedPension(
  input: SimulatedPensionInput,
): Promise<SimulatedPensionResult> {
  return post<SimulatedPensionResult>('/calc/simulated-pension', input);
}

// ---------- עזיבת עבודה (מפרט 5.4) ----------

export interface JobExitInput {
  severanceBalance: number;
  yearsOfService: number;
  lastMonthlySalary: number;
  yearsToRetirement: number;
  annualReturnPct: number;
  conversionFactor: number;
  marginalTaxRatePct: number;
}

export interface JobExitResult {
  exemptAmount: number;
  taxableAmount: number;
  taxOnTaxable: number;
  netToday: number;
  balanceAtRetirement: number;
  monthlyAnnuityLoss: number;
  kibuaExemptCapitalLoss: number;
  kibuaMonthlyExemptionLoss: number;
  warnings: string[];
  trace: CalcTrace;
}

export function calcJobExit(input: JobExitInput): Promise<JobExitResult> {
  return post<JobExitResult>('/calc/job-exit', input);
}

// ---------- קליטת דוח שנתי מ-PDF ----------

export interface ExtractedProduct {
  name: string;
  type: string;
  currentBalance: number;
  monthlyDeposit?: number;
  feeFromDepositPct?: number;
  feeFromBalancePct?: number;
  insuredMonthlySalary?: number;
  joinDate?: string;
  /** ביטוח חיים/מנהלים: סכום ביטוח למקרה מוות */
  deathBenefitAmount?: number;
  /** מוצרי ביטוח: פרמיה חודשית */
  monthlyPremium?: number;
  notes?: string;
}

export interface ExtractReportResult {
  products: ExtractedProduct[];
  reportYear?: number;
  managingBody?: string;
  notes: string[];
  model: string;
}

export function aiExtractReport(pdfBase64: string): Promise<ExtractReportResult> {
  return request<ExtractReportResult>('POST', '/ai/extract-report', { pdfBase64 });
}



// ---------- משיכה הדרגתית בפרישה ----------

export interface DecumulationInput {
  capitalAtRetirement: number;
  retirementAge: number;
  annualReturnPct: number;
  monthlyWithdrawal?: number;
  targetAge?: number;
}

export interface DecumulationResult {
  sustainableMonthly: number | null;
  targetAge: number;
  depletionAge: number | null;
  monthsUntilDepletion: number | null;
  totalWithdrawn: number;
  series: SeriesPoint[];
  warnings: string[];
  trace: CalcTrace;
}

export function calcDecumulation(input: DecumulationInput): Promise<DecumulationResult> {
  return post<DecumulationResult>('/calc/decumulation', input);
}

// ---------- השוואת דמי ניהול לשוק (מפרט 7.2) ----------

export interface FeeComparisonProductResult {
  id: string;
  name: string;
  type: ProductType;
  actual: { deposit: number; balance: number };
  marketAvg: { deposit: number; balance: number };
  annualExcessCost: number;
  gapAtRetirement: number;
  verdict: 'cheaper' | 'similar' | 'expensive';
  detail: string;
}

export interface FeeComparisonResult {
  products: FeeComparisonProductResult[];
  totalAnnualExcessCost: number;
  totalGapAtRetirement: number;
  warnings: string[];
  trace: CalcTrace;
}

export function calcFeeComparison(input: {
  months: number;
  annualReturnPct: number;
  annualSalaryGrowthPct: number;
  products: {
    id: string;
    name: string;
    type: ProductType;
    currentBalance: number;
    monthlyDeposit: number;
    feeFromDepositPct: number;
    feeFromBalancePct: number;
  }[];
}): Promise<FeeComparisonResult> {
  return post<FeeComparisonResult>('/calc/fee-comparison', input);
}

// ---------- מנוע תובנות (מפרט 7.3) ----------

export type InsightSeverity = 'critical' | 'warning' | 'info';
export type InsightCategory =
  | 'coverage'
  | 'fees'
  | 'tax'
  | 'hygiene'
  | 'track_fit'
  | 'replacement';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  category: InsightCategory;
  title: string;
  detail: string;
  estimatedAnnualImpact?: number;
}

export interface InsightsResult {
  insights: Insight[];
  trace: CalcTrace;
}

export function calcInsights(input: {
  scenarios?: ScenariosResult | null;
  healthScore?: HealthScoreResult | null;
  feeComparison?: FeeComparisonResult | null;
  taxBenefits?: TaxBenefitsResult | null;
}): Promise<InsightsResult> {
  return post<InsightsResult>('/calc/insights', input);
}

// ---------- סימולטור מסלול חיים ----------

export type LifePathEventType =
  | 'JOB_EXIT_WITHDRAW'
  | 'UNEMPLOYMENT_GAP'
  | 'PARENTAL_LEAVE'
  | 'SALARY_CHANGE';

export interface LifePathEvent {
  id: string;
  type: LifePathEventType;
  /** חודשים מהיום שבו האירוע מתרחש (0 = היום) */
  atMonth: number;
  label?: string;
  severanceWithdrawn?: number;
  yearsOfServiceAtExit?: number;
  lastMonthlySalaryAtExit?: number;
  marginalTaxRatePct?: number;
  durationMonths?: number;
  depositDuringPct?: number;
  newMonthlyDeposit?: number;
}

export interface LifePathEventOutcome {
  id: string;
  type: LifePathEventType;
  label: string;
  monthOccurred: number;
  detail: string;
  balanceImpact: number;
}

export interface LifePathResult {
  series: SeriesPoint[];
  baselineSeries: SeriesPoint[];
  baselineFinalBalance: number;
  finalBalance: number;
  baselineMonthlyAnnuity: number;
  finalMonthlyAnnuity: number;
  totalImpact: number;
  events: LifePathEventOutcome[];
  warnings: string[];
  trace: CalcTrace;
}

export function calcLifePath(input: {
  currentBalance: number;
  monthlyDeposit: number;
  feeFromDepositPct: number;
  feeFromBalancePct: number;
  annualReturnPct: number;
  annualSalaryGrowthPct: number;
  months: number;
  conversionFactor: number;
  events: LifePathEvent[];
}): Promise<LifePathResult> {
  return post<LifePathResult>('/calc/life-path', input);
}

// ---------- בחירת מסלול קצבה (4.3 + 5.2) ----------

export interface AnnuityTrackOption {
  id: string;
  label: string;
  conversionFactor: number;
  survivorPct: number;
  guaranteedMonths: number;
}

export interface AnnuityTrackInput {
  balanceAtRetirement: number;
  options: AnnuityTrackOption[];
  hasSpouse: boolean;
  retirementAge: number;
  retireeLifeExpectancyAge: number;
  spouseAgeAtRetirement?: number;
  spouseLifeExpectancyAge?: number;
}

export interface AnnuityTrackOutcome {
  id: string;
  label: string;
  monthlyAnnuity: number;
  survivorMonthly: number;
  survivorPct: number;
  guaranteedMonths: number;
  totalExpectedPayout: number;
  breakEvenAge?: number | null;
}

export interface AnnuityTrackResult {
  options: AnnuityTrackOutcome[];
  warnings: string[];
  trace: CalcTrace;
}

export function calcAnnuityTrack(input: AnnuityTrackInput): Promise<AnnuityTrackResult> {
  return post<AnnuityTrackResult>('/calc/annuity-track', input);
}

// ---------- קיבוע זכויות (סעיף 9א / טופס 161ד) ----------

export interface PastGrant {
  /** שנת קבלת המענק הפטור */
  year: number;
  /** סכום המענק הפטור (צמוד למדד ליום הזכאות) */
  amount: number;
  employer?: string;
}

export interface RightsFixationInput {
  eligibilityYear: number;
  expectedMonthlyPension: number;
  pastGrants?: PastGrant[];
  desiredLumpSum?: number;
  marginalTaxRatePct?: number;
}

export interface FixationScenario {
  key: 'full_pension' | 'max_lump_sum' | 'custom';
  label: string;
  lumpSum: number;
  monthlyExemption: number;
  taxableMonthlyPension: number;
  estMonthlyTaxSaved: number | null;
  detail: string;
}

export interface RightsFixationResult {
  params: {
    annuityCeilingMonthly: number;
    exemptionPct: number;
    factor: number;
    offsetMultiplier: number;
    grantWindowYears: number;
  };
  exemptCapitalCeiling: number;
  countedGrantsTotal: number;
  grantOffset: number;
  remainingExemptCapital: number;
  scenarios: FixationScenario[];
  warnings: string[];
  trace: CalcTrace;
}

export function calcRightsFixation(
  input: RightsFixationInput,
): Promise<RightsFixationResult> {
  return post<RightsFixationResult>('/calc/rights-fixation', input);
}

export function loadPortfolio(): Promise<SavedPortfolio> {
  return request<SavedPortfolio>('GET', '/portfolio');
}

export function savePortfolio(p: SavedPortfolio): Promise<SavedPortfolio> {
  return request<SavedPortfolio>('PUT', '/portfolio', p);
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    throw new UnauthorizedError('נדרשת התחברות מחדש');
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `שגיאת שרת (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const post = <T,>(path: string, body: unknown) => request<T>('POST', path, body);

export function calcProjection(input: ProjectionInput): Promise<ProjectionResult> {
  return post<ProjectionResult>('/calc/projection', input);
}

export function calcAnnuity(
  balanceAtRetirement: number,
  conversionFactor: number,
): Promise<AnnuityResult> {
  return post<AnnuityResult>('/calc/annuity', {
    balanceAtRetirement,
    conversionFactor,
  });
}

// ---------- ייצוא PDF אמיתי (מפרט סעיף 8) ----------

/**
 * שולח את ה-HTML המעוצב (מ-report.ts) לשרת שמריץ Puppeteer ומחזיר PDF
 * וקטורי אמיתי, ומפעיל הורדה. בשונה מ-openReport (טאב להדפסת דפדפן) —
 * זה קובץ PDF שיורד ישירות, עם טקסט בר-חיפוש/סימון.
 */
export async function downloadReportPdf(html: string, fileName: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/report/pdf`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ html }),
  });
  if (res.status === 401) throw new UnauthorizedError('נדרשת התחברות מחדש');
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `שגיאת שרת (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
