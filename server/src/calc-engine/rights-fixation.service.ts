import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  calcRightsFixation,
  defaultParamsFor,
} from './rights-fixation';
import type {
  RightsFixationInput,
  RightsFixationParams,
  RightsFixationResult,
} from './rights-fixation';

/**
 * עוטף את מנוע קיבוע הזכויות הטהור בטעינת פרמטרים רגולטוריים מה-DB
 * (מפרט סעיף 12): ערך שקיים ב-RegulatoryParameter לשנת הזכאות גובר
 * על ברירת המחדל המתועדת בקוד.
 */
@Injectable()
export class RightsFixationService {
  constructor(private readonly prisma: PrismaService) {}

  private async dbParamsFor(
    eligibilityYear: number,
  ): Promise<Partial<RightsFixationParams>> {
    const asOf = new Date(`${eligibilityYear}-06-30`);
    const rows = await this.prisma.regulatoryParameter.findMany({
      where: {
        key: {
          in: [
            'annuity_ceiling_monthly',
            'pension_exemption_pct',
            'fixation_factor',
            'grant_offset_multiplier',
            'grant_window_years',
          ],
        },
        validFrom: { lte: asOf },
        OR: [{ validTo: null }, { validTo: { gte: asOf } }],
      },
      orderBy: { validFrom: 'desc' },
    });

    const firstOf = (key: string) => rows.find((r) => r.key === key);
    const overrides: Partial<RightsFixationParams> = {};
    const ceiling = firstOf('annuity_ceiling_monthly');
    if (ceiling) overrides.annuityCeilingMonthly = Number(ceiling.value);
    const pct = firstOf('pension_exemption_pct');
    if (pct) overrides.exemptionPct = Number(pct.value);
    const factor = firstOf('fixation_factor');
    if (factor) overrides.factor = Number(factor.value);
    const mult = firstOf('grant_offset_multiplier');
    if (mult) overrides.offsetMultiplier = Number(mult.value);
    const window = firstOf('grant_window_years');
    if (window) overrides.grantWindowYears = Number(window.value);
    return overrides;
  }

  async calc(input: RightsFixationInput): Promise<RightsFixationResult> {
    // מוודא ששנת הזכאות תקינה לפני גישה ל-DB (אותה ולידציה של המנוע)
    defaultParamsFor(Math.max(2012, Math.trunc(input.eligibilityYear || 0)));
    let dbOverrides: Partial<RightsFixationParams> = {};
    try {
      dbOverrides = await this.dbParamsFor(input.eligibilityYear);
    } catch {
      // DB לא זמין / טבלה ריקה — ממשיכים עם ברירות המחדל בקוד
    }
    return calcRightsFixation({
      ...input,
      paramsOverride: { ...dbOverrides, ...input.paramsOverride },
    });
  }
}
