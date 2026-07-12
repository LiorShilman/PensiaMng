import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ClientRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TRACK_DEFS } from '../calc-engine/tracks';
import type { ProductType } from '../calc-engine/types';

export { ClientRole };

/** הנחות התכנון של התיק — נשמרות כ-JSON על הלקוח */
export interface PlanAssumptions {
  annualReturnPct: number;
  annualSalaryGrowthPct: number;
  /** עקיפה ידנית של גיל הפרישה החוקי (60–75); ריק = לפי חוק */
  plannedRetirementAge?: number;
  /** שדה מדור קודם — נשמר לתאימות עם תיקים שנשמרו לפני מעבר לתאריך לידה */
  yearsToRetirement?: number;
}

/** פרופיל אישי — נשמר על רשומת הלקוח עצמה */
export interface ClientProfile {
  /** שם/כינוי להצגה — משמש בעיקר בתיק בן/בת הזוג (מבט זוגי) */
  fullName?: string;
  gender: 'MALE' | 'FEMALE';
  /** ISO yyyy-mm-dd */
  birthDate: string;
  maritalStatus?: 'SINGLE' | 'MARRIED' | 'COMMON_LAW' | 'DIVORCED' | 'WIDOWED';
  /** שכר חודשי מבוטח (₪) — בסיס לקצבאות שאירים ונכות */
  insuredMonthlySalary?: number;
  /** ילדים — תאריכי לידה (זכאות יתום עד גיל 21) */
  children?: { birthDate: string; name?: string }[];
}

/** מוצר בתיק — הצורה שהפרונט עובד איתה */
export interface SavedProduct {
  id: string;
  name: string;
  type: ProductType;
  currentBalance: number;
  monthlyDeposit: number;
  feeFromDepositPct: number;
  feeFromBalancePct: number;
  monthlyCoverageCost: number;
  conversionFactor?: number;
  /** שכר מבוטח בקרן זו — ריק = השכר הגלובלי */
  insuredMonthlySalary?: number;
  /** קרן לא פעילה (מוקפאת) — למשל לאחר חלוקה בגירושין; ללא הפקדות וללא כיסויים */
  frozen?: boolean;
  /** כיסויים ביטוחיים (קרנות פנסיה) */
  survivorsPct?: number;
  disabilityPct?: number;
  survivorsWaiver?: boolean;
  /** סכום ביטוח למקרה מוות (ביטוח מנהלים) */
  deathBenefitAmount?: number;
  /** מוטבים — ריק = יורשים על פי דין */
  beneficiaries?: { name: string; pct: number }[];
  /** הקצאת מסלולי השקעה — ריק = הנחת התשואה הגלובלית */
  tracks?: { category: string; pct: number }[];
  /** תאריך פתיחת הקרן — לוותק ונזילות */
  joinDate?: string;
  /** מטריה ביטוחית (אכ"ע פרטי) */
  umbrella?: boolean;
  /** היסטוריית ניוד — מקור הכספים אם הועברו ממוצר אחר */
  transfers?: {
    fromProvider: string;
    fromType?: string;
    transferDate: string;
    note?: string;
  }[];
}

export interface SavedPortfolio {
  assumptions: PlanAssumptions | null;
  profile: ClientProfile | null;
  products: SavedProduct[];
}

const DEFAULT_JOIN_DATE = new Date('2020-01-01');

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * הלקוח (התיק) של המשתמש. תיק ראשי נוצר אוטומטית בהרשמה; תיק בן/בת זוג
   * (מבט זוגי, מפרט §9 פריט 5) נוצר אוטומטית עם ערכי ברירת מחדל בפעם
   * הראשונה שהוא נטען או נשמר.
   */
  private async clientOf(userId: string, role: ClientRole = ClientRole.PRIMARY) {
    const client = await this.prisma.client.findUnique({
      where: { userId_role: { userId, role } },
    });
    if (client) return client;
    if (role === ClientRole.PRIMARY) {
      throw new NotFoundException('לא נמצא תיק למשתמש — פנה לתמיכה');
    }
    return this.prisma.client.create({
      data: {
        userId,
        role,
        fullName: 'בן/בת הזוג',
        birthDate: new Date('1985-01-01'),
        gender: 'FEMALE',
        maritalStatus: 'MARRIED',
        employmentStatus: 'EMPLOYEE',
      },
    });
  }

  /** האם קיים כבר תיק בן/בת זוג שמור (מבט זוגי הופעל) */
  async hasSpouse(userId: string): Promise<boolean> {
    const client = await this.prisma.client.findUnique({
      where: { userId_role: { userId, role: ClientRole.SPOUSE } },
    });
    return client !== null;
  }

  /** מסיר את תיק בן/בת הזוג (וכל מוצריו/ילדיו) — מכבה את מבט הזוג */
  async deleteSpouse(userId: string): Promise<void> {
    await this.prisma.client.deleteMany({
      where: { userId, role: ClientRole.SPOUSE },
    });
  }

  async load(
    userId: string,
    role: ClientRole = ClientRole.PRIMARY,
  ): Promise<SavedPortfolio> {
    const client = await this.clientOf(userId, role);
    const [products, children] = await Promise.all([
      this.prisma.product.findMany({
        where: { clientId: client.id },
        orderBy: { createdAt: 'asc' },
        include: {
          beneficiaries: true,
          tracks: { include: { track: true } },
          transfers: { orderBy: { transferDate: 'asc' } },
        },
      }),
      this.prisma.child.findMany({
        where: { clientId: client.id },
        orderBy: { birthDate: 'asc' },
      }),
    ]);

    return {
      assumptions:
        (client.planAssumptions as unknown as PlanAssumptions) ?? null,
      profile: {
        fullName: client.fullName,
        gender: client.gender as ClientProfile['gender'],
        birthDate: client.birthDate.toISOString().slice(0, 10),
        maritalStatus: client.maritalStatus as ClientProfile['maritalStatus'],
        insuredMonthlySalary: client.insuredSalary
          ? Number(client.insuredSalary)
          : undefined,
        children: children.map((c) => ({
          birthDate: c.birthDate.toISOString().slice(0, 10),
          name: c.name ?? undefined,
        })),
      },
      products: products.map((p) => ({
        id: p.id,
        name: p.provider,
        type: p.type as ProductType,
        joinDate: p.joinDate.toISOString().slice(0, 10),
        currentBalance: Number(p.balanceTotal),
        monthlyDeposit: Number(p.depositTotal ?? 0),
        feeFromDepositPct: Number(p.feeFromDeposit),
        feeFromBalancePct: Number(p.feeFromBalance),
        monthlyCoverageCost: Number(p.monthlyCoverageCost ?? 0),
        conversionFactor: p.conversionFactor
          ? Number(p.conversionFactor)
          : undefined,
        insuredMonthlySalary: p.insuredSalary
          ? Number(p.insuredSalary)
          : undefined,
        frozen: p.status === 'FROZEN',
        umbrella: p.umbrellaFlag,
        survivorsPct: p.survivorsPct ? Number(p.survivorsPct) : undefined,
        disabilityPct: p.disabilityPct ? Number(p.disabilityPct) : undefined,
        survivorsWaiver: p.survivorsWaiver,
        deathBenefitAmount: p.deathBenefitAmount
          ? Number(p.deathBenefitAmount)
          : undefined,
        beneficiaries: p.beneficiaries.map((b) => ({
          name: b.name,
          pct: Number(b.percentage),
        })),
        tracks: p.tracks.map((a) => ({
          category: a.track.category,
          pct: Number(a.percentage),
        })),
        transfers: p.transfers.map((t) => ({
          fromProvider: t.fromProvider,
          fromType: t.fromType ?? undefined,
          transferDate: t.transferDate.toISOString().slice(0, 10),
          note: t.note ?? undefined,
        })),
      })),
    };
  }

  /** שמירה מלאה: מחליף את כל מוצרי התיק ואת ההנחות (upsert פשוט ל-MVP) */
  async save(
    userId: string,
    portfolio: SavedPortfolio,
    role: ClientRole = ClientRole.PRIMARY,
  ): Promise<SavedPortfolio> {
    const client = await this.clientOf(userId, role);

    await this.prisma.$transaction([
      this.prisma.client.update({
        where: { id: client.id },
        data: {
          planAssumptions:
            portfolio.assumptions as unknown as Prisma.InputJsonValue,
          ...(portfolio.profile
            ? {
                ...(portfolio.profile.fullName?.trim()
                  ? { fullName: portfolio.profile.fullName.trim() }
                  : {}),
                gender: portfolio.profile.gender,
                birthDate: new Date(portfolio.profile.birthDate),
                ...(portfolio.profile.maritalStatus
                  ? { maritalStatus: portfolio.profile.maritalStatus }
                  : {}),
                insuredSalary: portfolio.profile.insuredMonthlySalary ?? null,
              }
            : {}),
        },
      }),
      this.prisma.child.deleteMany({ where: { clientId: client.id } }),
      this.prisma.child.createMany({
        data: (portfolio.profile?.children ?? []).map((c) => ({
          clientId: client.id,
          birthDate: new Date(c.birthDate),
          name: c.name ?? null,
        })),
      }),
      this.prisma.product.deleteMany({ where: { clientId: client.id } }),
      // יצירה פר-מוצר (ולא createMany) כדי לאפשר מוטבים מקוננים
      ...portfolio.products.map((p) =>
        this.prisma.product.create({
          data: {
            clientId: client.id,
            type: p.type,
            provider: p.name,
            joinDate: p.joinDate ? new Date(p.joinDate) : DEFAULT_JOIN_DATE,
            balanceTotal: p.currentBalance,
            depositTotal: p.monthlyDeposit,
            feeFromDeposit: p.feeFromDepositPct,
            feeFromBalance: p.feeFromBalancePct,
            monthlyCoverageCost: p.monthlyCoverageCost,
            conversionFactor: p.conversionFactor ?? null,
            insuredSalary: p.insuredMonthlySalary ?? null,
            status: p.frozen ? ('FROZEN' as const) : ('ACTIVE' as const),
            umbrellaFlag: p.umbrella ?? false,
            survivorsPct: p.survivorsPct ?? null,
            disabilityPct: p.disabilityPct ?? null,
            survivorsWaiver: p.survivorsWaiver ?? false,
            deathBenefitAmount: p.deathBenefitAmount ?? null,
            beneficiaries: {
              create: (p.beneficiaries ?? [])
                .filter((b) => b.name.trim() && b.pct > 0)
                .map((b) => ({ name: b.name.trim(), percentage: b.pct })),
            },
            transfers: {
              create: (p.transfers ?? [])
                .filter((t) => t.fromProvider.trim() && t.transferDate)
                .map((t) => ({
                  fromProvider: t.fromProvider.trim(),
                  fromType: t.fromType?.trim() || null,
                  transferDate: new Date(t.transferDate),
                  note: t.note?.trim() || null,
                })),
            },
            tracks: {
              create: (p.tracks ?? [])
                .filter((t) => t.pct > 0)
                .map((t) => {
                  const def = TRACK_DEFS.find((d) => d.category === t.category);
                  return {
                    percentage: t.pct,
                    track: {
                      connectOrCreate: {
                        where: { category: t.category },
                        create: {
                          category: t.category,
                          name: def?.label ?? t.category,
                          riskLevel: def?.riskLevel ?? 4,
                          defaultReturn: def?.realReturnPct ?? 3.74,
                        },
                      },
                    },
                  };
                }),
            },
          },
        }),
      ),
    ]);

    return this.load(userId, role);
  }
}
