import type {
  AnnuityTrackResult,
  ClientProfile,
  DecumulationResult,
  FeeComparisonResult,
  FundLoanResult,
  FundSwitchResult,
  HealthScoreResult,
  InsightsResult,
  JobExitResult,
  PortfolioProductInput,
  PortfolioResult,
  RetirementResult,
  RightsFixationResult,
  ScenariosResult,
  Section190Result,
  SimulatedPensionResult,
  TaxBenefitsResult,
} from './api';

/**
 * דוח תמונת מצב מעוצב (מפרט סעיף 8) — HTML להדפסה/שמירה כ-PDF.
 * עיצוב בהיר ומקצועי (דוח מודפס), RTL מלא, כולל ניתוח ה-AI אם קיים.
 */

interface ReportData {
  userName: string;
  profile: ClientProfile;
  products: PortfolioProductInput[];
  result: PortfolioResult;
  scenarios: ScenariosResult | null;
  retirement: RetirementResult | null;
  fixation: RightsFixationResult | null;
  health: HealthScoreResult | null;
  simPension: SimulatedPensionResult | null;
  taxBenefits: TaxBenefitsResult | null;
  jobExit: JobExitResult | null;
  decum: DecumulationResult | null;
  annuityTrack: AnnuityTrackResult | null;
  fundSwitch: FundSwitchResult | null;
  section190: Section190Result | null;
  fundLoan: FundLoanResult | null;
  feeComparison: FeeComparisonResult | null;
  insights: InsightsResult | null;
  aiText: string | null;
  aiMeta: string | null;
  typeLabel: (t: PortfolioProductInput['type']) => string;
}

/* בונים ידנית (ולא style:'currency') כי הצבת סימן ה-₪ האוטומטית של
   ה-locale מסתמכת על הקשר bidi RTL — ומתהפכת בתאים עם direction:ltr (td.num) */
const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Markdown מינימלי → HTML (כותרות, מודגש, רשימות) */
function mdToHtml(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      const safe = esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      if (line.startsWith('## ')) return `<h3>${safe.slice(3)}</h3>`;
      if (line.startsWith('# ')) return `<h3>${safe.slice(2)}</h3>`;
      if (/^[-*•] /.test(line)) return `<li>${safe.slice(2)}</li>`;
      if (/^\d+[.)] /.test(line)) return `<li class="num">${safe}</li>`;
      if (line.startsWith('_') && line.endsWith('_') && line.length > 2)
        return `<p class="disclaimer">${safe.slice(1, -1)}</p>`;
      if (line.trim() === '') return '';
      return `<p>${safe}</p>`;
    })
    .join('\n');
}

/** בונה את מחרוזת ה-HTML המלאה של הדוח — פונקציה טהורה (בלי גישה ל-window), לשימוש גם בפתיחת טאב וגם ביצירת PDF אמיתי בשרת */
export function buildReportHtml(d: ReportData): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const c = d.result.totals.central;

  const productRows = d.products
    .map((p) => {
      const res = d.result.products.find((x) => x.id === p.id);
      return `<tr>
        <td class="strong">${esc(p.name)}</td>
        <td>${esc(d.typeLabel(p.type))}${p.frozen ? ' <span class="tag">לא פעילה</span>' : ''}</td>
        <td class="num">${nis(p.currentBalance)}</td>
        <td class="num">${nis(p.monthlyDeposit)}</td>
        <td class="num">${res ? nis(res.projection.central.finalBalance) : '—'}</td>
        <td class="num">${
          res
            ? res.isAnnuity && res.monthlyAnnuity
              ? nis(res.monthlyAnnuity.central) + ' לחודש'
              : 'הון חד־פעמי'
            : 'ביטוח בלבד'
        }</td>
      </tr>`;
    })
    .join('');

  const transferRows = d.products
    .flatMap((p) => (p.transfers ?? []).map((t) => ({ p, t })))
    .map(
      ({ p, t }) => `<tr>
        <td class="strong">${esc(p.name)}</td>
        <td>${esc(t.fromProvider)}${t.fromType ? ` (${esc(t.fromType)})` : ''}</td>
        <td class="num">${t.transferDate ? esc(new Date(t.transferDate).toLocaleDateString('he-IL')) : '—'}</td>
        <td>${t.note ? esc(t.note) : '—'}</td>
      </tr>`,
    )
    .join('');

  const transfersBlock = transferRows
    ? `
    <h2>היסטוריית ניוד</h2>
    <table>
      <thead><tr><th>מוצר יעד</th><th>מקור הכספים</th><th>תאריך ניוד</th><th>מה אבד/השתנה</th></tr></thead>
      <tbody>${transferRows}</tbody>
    </table>`
    : '';

  const scenariosBlock = d.scenarios
    ? `
    <h2>תרחישי ביטוח — מצב היום</h2>
    <div class="two-col">
      <div class="box">
        <h4>חלילה — מקרה מוות</h4>
        <div class="kv"><span>קצבת שאירים חודשית</span><b>${nis(d.scenarios.death.totalSurvivorMonthly)}</b></div>
        <div class="kv"><span>סכומים חד־פעמיים למוטבים</span><b>${nis(d.scenarios.death.totalLumpSum)}</b></div>
        <div class="kv"><span>יעד (70% מהשכר)</span><b>${nis(d.scenarios.death.targetMonthly)}</b></div>
        <div class="kv ${d.scenarios.death.gapMonthly > 0 ? 'bad' : 'good'}">
          <span>${d.scenarios.death.gapMonthly > 0 ? 'פער חודשי' : 'סטטוס'}</span>
          <b>${d.scenarios.death.gapMonthly > 0 ? nis(d.scenarios.death.gapMonthly) : 'היעד מכוסה ✓'}</b>
        </div>
      </div>
      <div class="box">
        <h4>אובדן כושר עבודה</h4>
        <div class="kv"><span>קצבת נכות חודשית${d.scenarios.disability.excessMonthly > 0 ? ' (לאחר תקרת 75%)' : ''}</span><b>${nis(d.scenarios.disability.totalDisabilityMonthly)}</b></div>
        ${d.scenarios.disability.excessMonthly > 0 ? `<div class="kv bad"><span>כיסוי עודף שלא ניתן לממש</span><b>${nis(d.scenarios.disability.excessMonthly)}</b></div>` : ''}
        <div class="kv ${d.scenarios.disability.gapMonthly > 0 ? 'bad' : 'good'}">
          <span>${d.scenarios.disability.gapMonthly > 0 ? 'פער חודשי' : 'סטטוס'}</span>
          <b>${d.scenarios.disability.gapMonthly > 0 ? nis(d.scenarios.disability.gapMonthly) : 'היעד מכוסה ✓'}</b>
        </div>
      </div>
    </div>
    ${
      d.scenarios.warnings.length
        ? `<div class="warnings"><h4>נקודות לתשומת לב</h4><ul>${d.scenarios.warnings
            .map((w) => `<li>${esc(w)}</li>`)
            .join('')}</ul></div>`
        : ''
    }`
    : '';

  const healthBlock = d.health
    ? `
    <h2>ציון בריאות פנסיוני: ${d.health.total}/100 — ${esc(d.health.gradeLabel)}</h2>
    <table>
      <thead><tr><th>רכיב</th><th>ניקוד</th><th>פירוט</th></tr></thead>
      <tbody>${d.health.components
        .map(
          (c) => `<tr>
        <td class="strong">${esc(c.label)}</td>
        <td class="num">${c.score}/${c.max}</td>
        <td>${esc(c.detail)}</td>
      </tr>`,
        )
        .join('')}</tbody>
    </table>
    ${
      d.health.topRecommendations.length
        ? `<div class="warnings"><h4>המלצות לשיפור (לפי סדר השפעה)</h4><ul>${d.health.topRecommendations
            .map((r) => `<li>${esc(r)}</li>`)
            .join('')}</ul></div>`
        : ''
    }`
    : '';

  const fixationBlock = d.fixation
    ? `
    <h2>קיבוע זכויות (סעיף 9א / טופס 161ד) — סימולציה</h2>
    <div class="cards" style="grid-template-columns: repeat(3, 1fr)">
      <div class="stat"><div class="v">${nis(d.fixation.exemptCapitalCeiling)}</div><div class="l">ההון הפטור המלא (${d.fixation.params.exemptionPct}%)</div></div>
      <div class="stat"><div class="v">${d.fixation.grantOffset > 0 ? '−' + nis(d.fixation.grantOffset) : nis(0)}</div><div class="l">קיזוז מענקי עבר</div></div>
      <div class="stat hero"><div class="v">${nis(d.fixation.remainingExemptCapital)}</div><div class="l">היתרה הפטורה לניצול</div></div>
    </div>
    <table>
      <thead><tr><th>תרחיש</th><th>היוון פטור</th><th>פטור חודשי</th><th>קצבה חייבת</th><th>חיסכון מס מוערך</th></tr></thead>
      <tbody>${d.fixation.scenarios
        .map(
          (s) => `<tr>
        <td class="strong">${esc(s.label)}</td>
        <td class="num">${nis(s.lumpSum)}</td>
        <td class="num">${nis(s.monthlyExemption)}</td>
        <td class="num">${nis(s.taxableMonthlyPension)}</td>
        <td class="num">${s.estMonthlyTaxSaved !== null ? nis(s.estMonthlyTaxSaved) + ' לחודש' : '—'}</td>
      </tr>`,
        )
        .join('')}</tbody>
    </table>
    <p class="disclaimer">קיבוע זכויות הוא בחירה חד-פעמית וכמעט בלתי-הפיכה — הסימולציה להמחשה בלבד וחובה להתייעץ עם יועץ מס מוסמך לפני הגשת טופס 161ד.</p>`
    : '';

  const simPensionBlock = d.simPension
    ? `
    <h2>פרישה מדומה — קצבה מגיל 60 תוך המשך עבודה (סימולציה)</h2>
    <div class="two-col">
      <div class="box">
        <h4>הפעלה מוקדמת</h4>
        <div class="kv"><span>צבירה בהפעלה</span><b>${nis(d.simPension.balanceAtStart)}</b></div>
        <div class="kv"><span>קצבה ברוטו לכל החיים</span><b>${nis(d.simPension.earlyMonthlyGross)}</b></div>
        <div class="kv"><span>נטו בזמן העבודה (אחרי מס שולי)</span><b>${nis(d.simPension.earlyMonthlyNetWhileWorking)}</b></div>
        <div class="kv good"><span>סה"כ נטו עד הגיל החוקי (${d.simPension.windowMonths} חודשים)</span><b>${nis(d.simPension.totalNetDuringWindow)}</b></div>
      </div>
      <div class="box">
        <h4>המתנה לגיל החוקי</h4>
        <div class="kv"><span>צבירה בגיל החוקי</span><b>${nis(d.simPension.balanceAtLegal)}</b></div>
        <div class="kv"><span>קצבה ברוטו לכל החיים</span><b>${nis(d.simPension.waitMonthlyGross)}</b></div>
        <div class="kv good"><span>יתרון חודשי על ההפעלה המוקדמת</span><b>+${nis(d.simPension.monthlyLossAfterLegal)}</b></div>
        ${d.simPension.breakEvenAge !== null ? `<div class="kv"><span>גיל נקודת האיזון (ברוטו)</span><b>${d.simPension.breakEvenAge}</b></div>` : ''}
      </div>
    </div>
    <p class="disclaimer">הקצבה המוקדמת פטורה מדמי ביטוח לאומי ואינה נספרת במבחן ההכנסות לקצבת אזרח ותיק; ההפעלה בלתי הפיכה ומבטלת כיסויים ביטוחיים — חובה להתייעץ עם מתכנן פרישה מוסמך.</p>`
    : '';

  const taxBenefitsBlock = d.taxBenefits
    ? `
    <h2>הטבות מס בהפקדה (סעיף 45א) — שנת המס הנוכחית</h2>
    <div class="cards" style="grid-template-columns: repeat(3, 1fr)">
      <div class="stat hero"><div class="v">${nis(d.taxBenefits.totalAnnualSaving)}</div><div class="l">חיסכון המס השנתי</div></div>
      <div class="stat"><div class="v">${nis(d.taxBenefits.remainingDepositAllowance)}</div><div class="l">תקרה שנותרה לניצול</div></div>
      <div class="stat"><div class="v">${nis(d.taxBenefits.potentialExtraSaving)}</div><div class="l">חיסכון נוסף אם תנוצל במלואה</div></div>
    </div>`
    : '';

  const jobExitBlock = d.jobExit
    ? `
    <h2>עזיבת עבודה (סעיף 5.4) — משיכת פיצויים מול רצף קצבה</h2>
    <div class="two-col">
      <div class="box">
        <h4>משיכה היום</h4>
        <div class="kv"><span>חלק פטור ממס</span><b>${nis(d.jobExit.exemptAmount)}</b></div>
        <div class="kv"><span>חלק חייב במס</span><b>${nis(d.jobExit.taxableAmount)}</b></div>
        <div class="kv bad"><span>מס מוערך</span><b>−${nis(d.jobExit.taxOnTaxable)}</b></div>
        <div class="kv good"><span>נטו ביד</span><b>${nis(d.jobExit.netToday)}</b></div>
      </div>
      <div class="box">
        <h4>רצף קצבה (השארה)</h4>
        <div class="kv"><span>צבירה בפרישה</span><b>${nis(d.jobExit.balanceAtRetirement)}</b></div>
        <div class="kv good"><span>קצבה חודשית שנשמרת</span><b>+${nis(d.jobExit.monthlyAnnuityLoss)}</b></div>
        <div class="kv good"><span>הפטור בקיבוע נשמר</span><b>+${nis(d.jobExit.kibuaMonthlyExemptionLoss)}/ח'</b></div>
      </div>
    </div>
    <p class="disclaimer">משיכת הפיצויים היום מוחקת ${nis(d.jobExit.monthlyAnnuityLoss)} מהקצבה החודשית לכל החיים, ופוגעת ב-${nis(d.jobExit.kibuaExemptCapitalLoss)} מההון הפטור בקיבוע הזכויות — סימולציה להמחשה בלבד.</p>`
    : '';

  const decumBlock = d.decum
    ? `
    <h2>משיכה הדרגתית בפרישה — ניהול ההון הנזיל</h2>
    <div class="cards" style="grid-template-columns: repeat(3, 1fr)">
      ${
        d.decum.sustainableMonthly !== null
          ? `<div class="stat hero"><div class="v">${nis(d.decum.sustainableMonthly)}</div><div class="l">משיכה חודשית בת-קיימא עד גיל ${d.decum.targetAge}</div></div>`
          : ''
      }
      <div class="stat"><div class="v">${d.decum.depletionAge !== null ? 'גיל ' + d.decum.depletionAge : 'לא אוזל'}</div><div class="l">מתי ההון אוזל בקצב שנבדק</div></div>
      <div class="stat"><div class="v">${nis(d.decum.totalWithdrawn)}</div><div class="l">סך המשיכות לאורך הדרך</div></div>
    </div>`
    : '';

  const annuityTrackBlock =
    d.annuityTrack && d.annuityTrack.options.length > 0
      ? `
    <h2>בחירת מסלול קצבה — השוואת מסלולים</h2>
    <table>
      <thead><tr><th>מסלול</th><th>קצבה חודשית</th><th>קצבת שאיר</th><th>הבטחת תשלומים</th><th>נקודת איזון</th></tr></thead>
      <tbody>${d.annuityTrack.options
        .map(
          (o) => `<tr>
        <td class="strong">${esc(o.label)}</td>
        <td class="num">${nis(o.monthlyAnnuity)}</td>
        <td class="num">${o.survivorPct > 0 ? `${nis(o.survivorMonthly)} (${o.survivorPct}%)` : '—'}</td>
        <td class="num">${o.guaranteedMonths === 0 ? 'ללא' : `${o.guaranteedMonths} ח׳`}</td>
        <td>${o.breakEvenAge === undefined ? 'מסלול בסיס' : o.breakEvenAge === null ? 'אינו משתלם באופק הנבדק' : `מגיל ${Math.round(o.breakEvenAge)}`}</td>
      </tr>`,
        )
        .join('')}</tbody>
    </table>
    <p class="disclaimer">ההשוואה מבוססת על תוחלות חיים משוערות שהוזנו (הנחה, לא תחזית) ואינה כוללת את מסלול "קצבה מוכרת" (תיקון 190).</p>`
      : '';

  const fundSwitchBlock = d.fundSwitch
    ? `
    <h2>כדאיות מעבר קרן</h2>
    <div class="two-col">
      <div class="box">
        <h4>המסלול הנוכחי</h4>
        <div class="kv"><span>צבירה בפרישה</span><b>${nis(d.fundSwitch.currentBalanceAtRetirement)}</b></div>
        <div class="kv"><span>סך דמי ניהול</span><b>${nis(d.fundSwitch.currentTotalFeesPaid)}</b></div>
        ${d.fundSwitch.currentMonthlyAnnuity !== null ? `<div class="kv"><span>קצבה חודשית</span><b>${nis(d.fundSwitch.currentMonthlyAnnuity)}</b></div>` : ''}
      </div>
      <div class="box">
        <h4>הקרן המועמדת</h4>
        <div class="kv"><span>צבירה בפרישה</span><b>${nis(d.fundSwitch.candidateBalanceAtRetirement)}</b></div>
        <div class="kv"><span>סך דמי ניהול</span><b>${nis(d.fundSwitch.candidateTotalFeesPaid)}</b></div>
        ${d.fundSwitch.candidateMonthlyAnnuity !== null ? `<div class="kv"><span>קצבה חודשית</span><b>${nis(d.fundSwitch.candidateMonthlyAnnuity)}</b></div>` : ''}
      </div>
    </div>
    <div class="cards" style="grid-template-columns: repeat(2, 1fr); margin-top:10px">
      <div class="stat ${d.fundSwitch.balanceGap >= 0 ? 'hero' : ''}"><div class="v">${d.fundSwitch.balanceGap >= 0 ? '+' : ''}${nis(d.fundSwitch.balanceGap)}</div><div class="l">פער צבירה בפרישה</div></div>
      ${d.fundSwitch.annuityGap !== null ? `<div class="stat"><div class="v">${d.fundSwitch.annuityGap >= 0 ? '+' : ''}${nis(d.fundSwitch.annuityGap)}</div><div class="l">פער קצבה חודשית</div></div>` : ''}
    </div>
    ${
      d.fundSwitch.warnings.length
        ? `<div class="warnings"><ul>${d.fundSwitch.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>`
        : ''
    }`
    : '';

  const section190Block = d.section190
    ? `
    <h2>תיקון 190 — משיכה הונית מול קצבה מוכרת</h2>
    <div class="two-col">
      <div class="box">
        <h4>משיכה הונית</h4>
        <div class="kv"><span>רווח חייב במס</span><b>${nis(d.section190.lumpSum.taxableGain)}</b></div>
        <div class="kv bad"><span>מס (15%)</span><b>−${nis(d.section190.lumpSum.tax)}</b></div>
        <div class="kv good"><span>נטו ביד</span><b>${nis(d.section190.lumpSum.netAmount)}</b></div>
      </div>
      <div class="box">
        <h4>קצבה מוכרת (פטורה ממס)</h4>
        <div class="kv good"><span>קצבה חודשית</span><b>${nis(d.section190.recognizedPension.monthlyAmount)}</b></div>
        <div class="kv"><span>סך הכנסה עד תוחלת חיים</span><b>${nis(d.section190.recognizedPension.totalIncomeToLifeExpectancy)}</b></div>
      </div>
    </div>
    ${
      d.section190.warnings.length
        ? `<div class="warnings"><ul>${d.section190.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>`
        : ''
    }`
    : '';

  const fundLoanBlock = d.fundLoan
    ? `
    <h2>הלוואה מקרן הפנסיה מול הלוואה חלופית</h2>
    <div class="two-col">
      <div class="box">
        <h4>הלוואת הקרן</h4>
        <div class="kv"><span>תשלום חודשי</span><b>${nis(d.fundLoan.fundLoan.monthlyPayment)}</b></div>
        <div class="kv"><span>סך ריבית</span><b>${nis(d.fundLoan.fundLoan.totalInterest)}</b></div>
        ${d.fundLoan.fundLoan.opportunityCost > 0 ? `<div class="kv bad"><span>עלות הזדמנות</span><b>${nis(d.fundLoan.fundLoan.opportunityCost)}</b></div>` : ''}
        <div class="kv bad"><span>עלות כוללת</span><b>${nis(d.fundLoan.fundLoan.totalCost)}</b></div>
      </div>
      <div class="box">
        <h4>הלוואה חלופית</h4>
        <div class="kv"><span>תשלום חודשי</span><b>${nis(d.fundLoan.alternativeLoan.monthlyPayment)}</b></div>
        <div class="kv"><span>סך ריבית</span><b>${nis(d.fundLoan.alternativeLoan.totalInterest)}</b></div>
      </div>
    </div>
    <div class="cards" style="grid-template-columns: repeat(1, 1fr); margin-top:10px">
      <div class="stat hero"><div class="v">${d.fundLoan.totalCostGap >= 0 ? '+' : ''}${nis(d.fundLoan.totalCostGap)}</div><div class="l">${d.fundLoan.totalCostGap <= 0 ? 'הלוואת הקרן זולה יותר בסה"כ ב-' : 'הלוואת הקרן יקרה יותר בסה"כ ב-'}</div></div>
    </div>
    ${
      d.fundLoan.warnings.length
        ? `<div class="warnings"><ul>${d.fundLoan.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>`
        : ''
    }`
    : '';

  const feeComparisonBlock =
    d.feeComparison && d.feeComparison.products.length > 0
      ? `
    <h2>השוואת דמי ניהול לממוצע השוק</h2>
    <table>
      <thead><tr><th>מוצר</th><th>דמי ניהול בפועל</th><th>ממוצע שוק</th><th>עלות עודפת שנתית</th><th>סטטוס</th></tr></thead>
      <tbody>${d.feeComparison.products
        .map(
          (p) => `<tr>
        <td class="strong">${esc(p.name)}</td>
        <td class="num">${p.actual.deposit}% / ${p.actual.balance}%</td>
        <td class="num">${p.marketAvg.deposit}% / ${p.marketAvg.balance}%</td>
        <td class="num">${nis(p.annualExcessCost)}</td>
        <td>${p.verdict === 'expensive' ? '<span class="tag bad">יקר מהממוצע</span>' : p.verdict === 'cheaper' ? '<span class="tag good">זול מהממוצע</span>' : '<span class="tag">דומה לממוצע</span>'}</td>
      </tr>`,
        )
        .join('')}</tbody>
    </table>`
      : '';

  const insightsBlock =
    d.insights && d.insights.insights.length > 0
      ? `
    <h2>תובנות ואיתור בעיות (${d.insights.insights.length})</h2>
    <div class="insights">
      ${d.insights.insights
        .map(
          (i) => `<div class="insight ${i.severity}">
        <div class="insight-head">
          <b>${esc(i.title)}</b>
          ${i.estimatedAnnualImpact && i.estimatedAnnualImpact > 0 ? `<span class="num">${nis(i.estimatedAnnualImpact)}/שנה</span>` : ''}
        </div>
        <p>${esc(i.detail)}</p>
      </div>`,
        )
        .join('')}
    </div>`
      : '';

  const aiBlock = d.aiText
    ? `
    <h2>ניתוח והמלצות AI ${d.aiMeta ? `<span class="ai-src">(${esc(d.aiMeta)})</span>` : ''}</h2>
    <div class="ai">${mdToHtml(d.aiText)}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>דוח תכנון פנסיוני — ${esc(d.userName)} — ${dateStr}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body {
    font-family: 'Segoe UI', 'Heebo', Arial, sans-serif;
    color: #1e293b; background: #fff; padding: 36px 44px;
    line-height: 1.65; font-size: 13px;
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid #4f46e5; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 24px; font-weight: 800; color: #4f46e5; }
  .brand small { display: block; font-size: 12px; color: #64748b; font-weight: 400; }
  .meta { text-align: left; color: #64748b; font-size: 12px; }
  h2 { font-size: 16px; color: #312e81; margin: 24px 0 10px;
    border-inline-start: 4px solid #4f46e5; padding-inline-start: 10px; }
  h3 { font-size: 14px; color: #4338ca; margin: 14px 0 6px; }
  h4 { font-size: 13px; color: #1e293b; margin-bottom: 8px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .stat { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; background: #f8fafc; }
  .stat .v { font-size: 17px; font-weight: 800; color: #0f172a; direction: ltr; text-align: right; }
  .stat .l { font-size: 11px; color: #64748b; margin-top: 2px; }
  .stat.hero { background: #eef2ff; border-color: #c7d2fe; }
  .stat.hero .v { color: #4338ca; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px;
    table-layout: auto; }
  th { text-align: right; color: #64748b; font-weight: 600; padding: 7px 8px;
    border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
  td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; }
  td.num { direction: ltr; text-align: right; font-variant-numeric: tabular-nums;
    white-space: nowrap; }
  td.strong { font-weight: 700; }
  .tag { font-size: 10px; background: #f1f5f9; border: 1px solid #cbd5e1;
    border-radius: 99px; padding: 1px 8px; color: #64748b; }
  .tag.bad { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
  .tag.good { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
  .insights { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
  .insight { border-inline-start: 3px solid #cbd5e1; border-radius: 8px;
    padding: 8px 12px; background: #f8fafc; font-size: 12px; }
  .insight.critical { border-inline-start-color: #b91c1c; }
  .insight.warning { border-inline-start-color: #d97706; }
  .insight.info { border-inline-start-color: #4f46e5; }
  .insight-head { display: flex; justify-content: space-between; align-items: center; }
  .insight-head .num { direction: ltr; font-weight: 700; color: #b91c1c; }
  .insight p { color: #64748b; margin-top: 2px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .box { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
  .kv { display: flex; justify-content: space-between; padding: 4px 0;
    border-bottom: 1px dashed #f1f5f9; font-size: 12px; }
  .kv b { direction: ltr; }
  .kv.good b { color: #15803d; } .kv.bad b { color: #b91c1c; }
  .warnings { margin-top: 12px; background: #fffbeb; border: 1px solid #fde68a;
    border-radius: 10px; padding: 12px 16px; }
  .warnings ul { padding-inline-start: 18px; }
  .ai { border: 1px solid #e0e7ff; border-radius: 10px; padding: 16px 20px; background: #fafaff; }
  .ai li { margin-inline-start: 18px; }
  .ai .disclaimer, .disclaimer { color: #64748b; font-style: italic; font-size: 11px;
    border-top: 1px dashed #e2e8f0; margin-top: 10px; padding-top: 8px; }
  .ai-src { font-size: 11px; color: #94a3b8; font-weight: 400; }
  .foot { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0;
    color: #94a3b8; font-size: 10.5px; text-align: center; }
  @media print {
    body { padding: 10mm 12mm; }
    .no-print { display: none; }
    h2 { break-after: avoid; page-break-after: avoid; }
    .box, .stat, .ai, .insight, .warnings, .kv, tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    table { font-size: 10.5px; }
    th, td { padding: 5px 7px; }
  }
  .print-btn { position: fixed; top: 14px; left: 14px; padding: 10px 22px;
    background: #4f46e5; color: #fff; border: none; border-radius: 8px;
    font-size: 14px; cursor: pointer; font-family: inherit; }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨 הדפס / שמור כ-PDF</button>

  <div class="head">
    <div class="brand">PensiaMng<small>דוח תכנון פנסיוני מקיף</small></div>
    <div class="meta">
      <div><b>${esc(d.userName)}</b></div>
      <div>הופק: ${dateStr}</div>
      ${d.retirement ? `<div>גיל פרישה חוקי: ${esc(d.retirement.legalRetirementAgeLabel)} · פרישה צפויה: ${esc(d.retirement.retirementDate.slice(0, 7))}</div>` : ''}
    </div>
  </div>

  <h2>תחזית לפרישה — תרחיש מרכזי</h2>
  <div class="cards">
    <div class="stat hero"><div class="v">${nis(c.totalBalance)}</div><div class="l">סך צבירה בפרישה</div></div>
    <div class="stat"><div class="v">${nis(c.totalMonthlyAnnuity + c.niOldAgeMonthly)}</div><div class="l">קצבה חודשית${c.niOldAgeMonthly > 0 ? ` (כולל אזרח ותיק ${nis(c.niOldAgeMonthly)})` : ''}</div></div>
    <div class="stat"><div class="v">${c.replacementRatePct !== null ? c.replacementRatePct + '%' : '—'}</div><div class="l">שיעור תחלופה (יעד: 70%+)</div></div>
    <div class="stat"><div class="v">${nis(c.totalLumpSum)}</div><div class="l">הון נזיל חד־פעמי</div></div>
  </div>
  <p style="margin-top:8px;color:#64748b;font-size:11.5px">
    טווח התרחישים: פסימי ${nis(d.result.totals.pessimistic.totalBalance)} · אופטימי ${nis(d.result.totals.optimistic.totalBalance)}
    · סך דמי ניהול חזויים עד הפרישה: ${nis(c.totalFeesPaid)}
  </p>

  <h2>פירוט התיק</h2>
  <table>
    <thead><tr><th>מוצר</th><th>סוג</th><th>יתרה כיום</th><th>הפקדה חודשית</th><th>צבירה בפרישה</th><th>אופן משיכה</th></tr></thead>
    <tbody>${productRows}</tbody>
  </table>

  ${healthBlock}
  ${insightsBlock}
  ${transfersBlock}
  ${scenariosBlock}
  ${fixationBlock}
  ${simPensionBlock}
  ${jobExitBlock}
  ${decumBlock}
  ${annuityTrackBlock}
  ${fundSwitchBlock}
  ${section190Block}
  ${fundLoanBlock}
  ${taxBenefitsBlock}
  ${feeComparisonBlock}
  ${aiBlock}

  <div class="foot">
    הופק על ידי PensiaMng · הדוח מיועד להמחשה ותכנון בלבד ואינו מהווה ייעוץ פנסיוני, ייעוץ מס או ייעוץ השקעות כהגדרתם בחוק ·
    הנתונים הוזנו על ידי המשתמש והתחזיות מבוססות על הנחות — התוצאות בפועל עשויות להיות שונות
  </div>
</body>
</html>`;

  return html;
}

/** פותח את הדוח בטאב חדש להדפסה/שמירה כ-PDF דרך הדפדפן */
export function openReport(d: ReportData): void {
  const blob = new Blob([buildReportHtml(d)], { type: 'text/html;charset=utf-8' });
  window.open(URL.createObjectURL(blob), '_blank');
}
