import type ExcelJS from 'exceljs';
import type {
  ClientProfile,
  PortfolioProductInput,
  PortfolioResult,
  ScenariosResult,
} from './api';

/**
 * ייצוא התיק והתחזיות ל-Excel (מפרט סעיף 8) — נבנה כולו בדפדפן,
 * ללא מעורבות שרת. שלוש גיליונות: תיק, תחזית, תרחישי ביטוח.
 */

interface ExportData {
  userName: string;
  profile: ClientProfile;
  products: PortfolioProductInput[];
  result: PortfolioResult;
  scenarios: ScenariosResult | null;
  typeLabel: (t: PortfolioProductInput['type']) => string;
}

/** ייצוא Excel דורש ספריה כבדה (~1MB) — נטענת רק בלחיצה על הכפתור, לא בטעינת הדף */
export async function exportPortfolioExcel(d: ExportData): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;

  const HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' },
  };
  const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } };

  function styleHeaderRow(row: ExcelJS.Row) {
    row.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    });
    row.height = 20;
  }

  function autoWidth(ws: ExcelJS.Worksheet, widths: number[]) {
    widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PensiaMng';
  wb.created = new Date();

  // ---------- גיליון 1: התיק הפנסיוני ----------
  const wsPortfolio = wb.addWorksheet('התיק הפנסיוני', {
    views: [{ rightToLeft: true }],
  });
  wsPortfolio.addRow([
    'שם המוצר',
    'סוג',
    'סטטוס',
    'יתרה נוכחית (₪)',
    'הפקדה חודשית (₪)',
    'ד"נ מהפקדה (%)',
    'ד"נ מצבירה (%)',
    'צבירה בפרישה (₪)',
    'אופן משיכה',
  ]);
  styleHeaderRow(wsPortfolio.getRow(1));
  for (const p of d.products) {
    const res = d.result.products.find((x) => x.id === p.id);
    const withdrawal = res
      ? res.isAnnuity && res.monthlyAnnuity
        ? `${res.monthlyAnnuity.central.toLocaleString('he-IL')} ₪/חודש`
        : 'הון חד־פעמי'
      : 'ביטוח בלבד';
    wsPortfolio.addRow([
      p.name,
      d.typeLabel(p.type),
      p.frozen ? 'לא פעילה' : 'פעילה',
      p.currentBalance,
      p.monthlyDeposit,
      p.feeFromDepositPct,
      p.feeFromBalancePct,
      res ? res.projection.central.finalBalance : null,
      withdrawal,
    ]);
  }
  autoWidth(wsPortfolio, [26, 20, 10, 16, 16, 12, 12, 16, 18]);
  wsPortfolio.getColumn(4).numFmt = '#,##0';
  wsPortfolio.getColumn(5).numFmt = '#,##0';
  wsPortfolio.getColumn(8).numFmt = '#,##0';

  // ---------- גיליון 2: תחזית לפרישה ----------
  const wsForecast = wb.addWorksheet('תחזית לפרישה', { views: [{ rightToLeft: true }] });
  wsForecast.addRow(['תרחיש', 'סך צבירה (₪)', 'קצבה חודשית (₪)', 'הון נזיל (₪)', 'סך דמי ניהול (₪)', 'שיעור תחלופה (%)']);
  styleHeaderRow(wsForecast.getRow(1));
  const scenarioLabels: Record<'pessimistic' | 'central' | 'optimistic', string> = {
    pessimistic: 'פסימי',
    central: 'מרכזי',
    optimistic: 'אופטימי',
  };
  (['pessimistic', 'central', 'optimistic'] as const).forEach((key) => {
    const t = d.result.totals[key];
    wsForecast.addRow([
      scenarioLabels[key],
      t.totalBalance,
      t.totalMonthlyAnnuity + t.niOldAgeMonthly,
      t.totalLumpSum,
      t.totalFeesPaid,
      t.replacementRatePct ?? '—',
    ]);
  });
  autoWidth(wsForecast, [14, 18, 18, 16, 18, 16]);
  [2, 3, 4, 5].forEach((c) => (wsForecast.getColumn(c).numFmt = '#,##0'));

  // ---------- גיליון 3: תרחישי ביטוח ----------
  if (d.scenarios) {
    const wsIns = wb.addWorksheet('תרחישי ביטוח', { views: [{ rightToLeft: true }] });
    wsIns.addRow(['מקרה מוות — לפי מוצר']);
    wsIns.getRow(1).font = { bold: true, size: 13 };
    wsIns.addRow(['מוצר', 'קצבה חודשית (₪)', 'סכום חד־פעמי (₪)', 'הסבר']);
    styleHeaderRow(wsIns.getRow(2));
    for (const p of d.scenarios.death.products) {
      wsIns.addRow([p.name, p.survivorMonthly, p.lumpSum, p.detail]);
    }
    wsIns.addRow([]);
    const deathSummaryRow = wsIns.rowCount + 1;
    wsIns.addRow([
      'סה"כ',
      d.scenarios.death.totalSurvivorMonthly + d.scenarios.death.niSurvivorsMonthly,
      d.scenarios.death.totalLumpSum,
      `יעד: ${d.scenarios.death.targetMonthly.toLocaleString('he-IL')} ₪ · פער: ${d.scenarios.death.gapMonthly.toLocaleString('he-IL')} ₪`,
    ]);
    wsIns.getRow(deathSummaryRow).font = { bold: true };

    wsIns.addRow([]);
    wsIns.addRow(['אובדן כושר עבודה (נכות) — לפי מוצר']);
    wsIns.getRow(wsIns.rowCount).font = { bold: true, size: 13 };
    wsIns.addRow(['מוצר', 'קצבת נכות חודשית (₪)', '', 'הסבר']);
    styleHeaderRow(wsIns.getRow(wsIns.rowCount));
    for (const p of d.scenarios.disability.products) {
      wsIns.addRow([p.name, p.disabilityMonthly, '', p.detail]);
    }
    wsIns.addRow([]);
    const disSummaryRow = wsIns.rowCount + 1;
    wsIns.addRow([
      'סה"כ',
      d.scenarios.disability.totalDisabilityMonthly + d.scenarios.disability.niDisabilityMonthly,
      '',
      `יעד: ${d.scenarios.disability.targetMonthly.toLocaleString('he-IL')} ₪ · פער: ${d.scenarios.disability.gapMonthly.toLocaleString('he-IL')} ₪`,
    ]);
    wsIns.getRow(disSummaryRow).font = { bold: true };

    if (d.scenarios.warnings.length > 0) {
      wsIns.addRow([]);
      wsIns.addRow(['אזהרות']);
      wsIns.getRow(wsIns.rowCount).font = { bold: true, size: 13 };
      for (const w of d.scenarios.warnings) wsIns.addRow([w]);
    }
    autoWidth(wsIns, [24, 18, 18, 60]);
    wsIns.getColumn(2).numFmt = '#,##0';
    wsIns.getColumn(3).numFmt = '#,##0';
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `PensiaMng-${d.userName.replace(/\s+/g, '_')}-${date}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
