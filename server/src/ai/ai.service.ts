import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret, maskKey } from './crypto.util';
import { AiToolsService } from './ai-tools.service';

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
  analyzedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  text: string;
  /** הכלים שהמודל הפעיל — לשקיפות בממשק */
  toolCalls: { name: string }[];
  provider: AiProvider;
  model: string;
}

export interface AiUsageView {
  /** עלות מוערכת החודש ($) */
  monthCostUsd: number;
  monthInputTokens: number;
  monthOutputTokens: number;
  /** תקרת התקציב ($); null = ללא הגבלה */
  budgetUsd: number | null;
  /** ניצול באחוזים מהתקציב (null כשאין תקציב) */
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

/** אומדן מחירים גס ($ למיליון טוקנים) — להערכת עלות בלבד, לא חיוב בפועל */
const PRICE_TABLE: { match: RegExp; inPerM: number; outPerM: number }[] = [
  { match: /opus/i, inPerM: 15, outPerM: 75 },
  { match: /sonnet/i, inPerM: 3, outPerM: 15 },
  { match: /haiku/i, inPerM: 1, outPerM: 5 },
  { match: /gpt-5/i, inPerM: 1.25, outPerM: 10 },
  { match: /gpt-4/i, inPerM: 2.5, outPerM: 10 },
];

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICE_TABLE.find((t) => t.match.test(model)) ?? { inPerM: 3, outPerM: 15 };
  return (
    Math.round(((inputTokens * p.inPerM + outputTokens * p.outPerM) / 1_000_000) * 10_000) /
    10_000
  );
}

/** מוצר שחולץ מדוח שנתי — טיוטה לאישור המשתמש לפני הוספה לתיק */
export interface ExtractedProduct {
  name: string;
  type: string;
  currentBalance: number;
  monthlyDeposit?: number;
  feeFromDepositPct?: number;
  feeFromBalancePct?: number;
  insuredMonthlySalary?: number;
  joinDate?: string;
  /** ביטוח חיים/מנהלים: סכום הביטוח למקרה מוות */
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

/** סכמת החילוץ — Structured Output דרך כלי כפוי */
const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'report_data',
  description: 'הנתונים המובנים שחולצו מהדוח השנתי',
  input_schema: {
    type: 'object',
    properties: {
      reportYear: { type: 'number', description: 'שנת הדוח' },
      managingBody: { type: 'string', description: 'הגוף המנהל (חברה)' },
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'שם המוצר/הקופה כולל הגוף המנהל, למשל "קרן פנסיה מקיפה - מנורה"',
            },
            type: {
              type: 'string',
              enum: [
                'PENSION_COMPREHENSIVE',
                'PENSION_GENERAL',
                'MANAGERS_INSURANCE',
                'PROVIDENT_FUND',
                'PROVIDENT_INVESTMENT',
                'IRA',
                'STUDY_FUND',
                'LIFE_INSURANCE',
                'DISABILITY_INSURANCE',
              ],
            },
            currentBalance: {
              type: 'number',
              description: 'יתרה צבורה בסוף התקופה (₪); 0 למוצרי ביטוח טהורים',
            },
            monthlyDeposit: {
              type: 'number',
              description: 'הפקדה חודשית ממוצעת (סך שנתי ÷ 12) אם מופיעה',
            },
            feeFromDepositPct: { type: 'number', description: 'דמי ניהול מהפקדה (%)' },
            feeFromBalancePct: { type: 'number', description: 'דמי ניהול מצבירה (% שנתי)' },
            insuredMonthlySalary: { type: 'number', description: 'שכר מבוטח (₪) אם מופיע' },
            joinDate: { type: 'string', description: 'תאריך הצטרפות (yyyy-mm-dd) אם מופיע' },
            deathBenefitAmount: {
              type: 'number',
              description: 'סכום ביטוח למקרה מוות (₪) — בביטוח חיים/מנהלים',
            },
            monthlyPremium: {
              type: 'number',
              description:
                'עלות כיסויים/פרמיה חודשית (₪). בקרן פנסיה: סכום השורות "עלות הביטוח לסיכוני נכות" + "עלות הביטוח לשאירים" (שנתי ÷ 12). לעולם לא "שחרור מתשלום הפקדות" ולא אחוז מההפקדות',
            },
            notes: { type: 'string', description: 'הערה חשובה שחולצה (מסלול, כיסויים)' },
          },
          required: ['name', 'type', 'currentBalance'],
        },
      },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'הערות: נתונים שלא נמצאו, אי-ודאויות, אזהרות',
      },
    },
    required: ['products', 'notes'],
  } as Anthropic.Tool.InputSchema,
};

/** ברירות מחדל — הדגמים המתקדמים בכל ספק */
const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-5.1',
};

const SYSTEM_PROMPT = `אתה אנליסט פנסיוני בכיר במערכת PensiaMng — מערכת ישראלית לתכנון פנסיה.

כללי ברזל:
1. לעולם אל תחשב מחדש מספרים פנסיוניים — כל המספרים שתקבל חושבו במנוע חישוב דטרמיניסטי ומאומת. תפקידך לפרש, להסביר ולהמליץ בלבד.
2. אל תמציא נתונים שלא קיבלת. אם חסר נתון — ציין זאת כשאלה פתוחה.
3. הקשר ישראלי: תקנוני קרנות פנסיה, דמי ניהול, קרן השתלמות, ביטוח מנהלים, גיל פרישה לפי חוק.
4. ענה בעברית בלבד, בטון מקצועי אך נגיש.

מבנה התשובה (Markdown):
## תמונת מצב
שורה-שתיים המסכמות את מצב התיק.
## תובנות מרכזיות
3–5 תובנות, מהחשובה ביותר. כל תובנה: מה רואים בנתונים + למה זה משנה.
## סיכונים ופערים
מה חשוף, מה כפול, מה חסר.
## המלצות פעולה
ממוספרות, מסודרות לפי השפעה כספית צפויה. לכל אחת: פעולה קונקרטית + הערכת כדאיות.
## שאלות לבירור
נתונים חסרים שישפרו את הניתוח.

סיים תמיד ב: "_ניתוח זה נוצר על ידי AI לצורך המחשה ואינו מהווה ייעוץ פנסיוני כהגדרתו בחוק._"`;

const CHAT_SYSTEM_PROMPT = `אתה יועץ צ'אט פנסיוני במערכת PensiaMng הישראלית.

כללי ברזל:
1. לעולם אל תחשב מספרים פנסיוניים בעצמך — לרשותך כלים שמפעילים את מנוע החישוב הדטרמיניסטי של המערכת על התיק השמור של המשתמש. הפעל אותם וצטט את תוצאותיהם.
2. כשחסר לך מידע על התיק — קרא ל-get_portfolio_summary לפני שאתה עונה.
3. לשאלות "מה אם" (גיל פרישה אחר, תשואה אחרת) — הפעל calc_projection עם הפרמטרים המתאימים, ואם רלוונטי השווה מול המצב הנוכחי (שתי קריאות).
4. ענה בעברית, קצר וממוקד: המספרים המרכזיים + מסקנה. אל תחזור על כל הפלט של הכלי.
5. אם המשתמש שואל על נתון שלא קיים בתיק — אמור זאת והצע להזין אותו במערכת.
6. הכלים פועלים על התיק כפי שנשמר — אם המשתמש מזכיר נתון שסותר את התיק, ציין שהתשובה לפי הנתונים השמורים.

סיים תשובות עם המלצה מהותית ב: "_המידע להמחשה בלבד ואינו ייעוץ פנסיוני כהגדרתו בחוק._"`;

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tools: AiToolsService,
  ) {}

  private secret(): string {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }

  /** רשומת הלקוח (התיק) של המשתמש — נוצרת אוטומטית בהרשמה */
  private async clientIdFor(userId: string): Promise<string | null> {
    const client = await this.prisma.client.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return client?.id ?? null;
  }

  /** הניתוח האחרון שנשמר — נטען עם התיק כדי לא לנתח מחדש בכל כניסה */
  async getLastAnalysis(userId: string): Promise<LastAnalysis | null> {
    const clientId = await this.clientIdFor(userId);
    if (!clientId) return null;
    const c = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        lastAiAnalysisText: true,
        lastAiAnalysisProvider: true,
        lastAiAnalysisModel: true,
        lastAiAnalysisAt: true,
      },
    });
    if (!c?.lastAiAnalysisText || !c.lastAiAnalysisAt) return null;
    return {
      text: c.lastAiAnalysisText,
      provider: (c.lastAiAnalysisProvider as AiProvider) ?? 'anthropic',
      model: c.lastAiAnalysisModel ?? '',
      analyzedAt: c.lastAiAnalysisAt.toISOString(),
    };
  }

  async getSettings(userId: string): Promise<AiSettingsView | null> {
    const s = await this.prisma.aiSettings.findUnique({ where: { userId } });
    if (!s) return null;
    let mask: string | null = null;
    try {
      mask = maskKey(decryptSecret(s.apiKeyEnc, this.secret()));
    } catch {
      mask = null;
    }
    return {
      provider: s.provider as AiProvider,
      model: s.model,
      hasKey: true,
      keyMask: mask,
      monthlyBudgetUsd: s.monthlyBudgetUsd !== null ? Number(s.monthlyBudgetUsd) : null,
    };
  }

  async saveSettings(
    userId: string,
    dto: {
      provider: AiProvider;
      apiKey?: string;
      model?: string;
      monthlyBudgetUsd?: number | null;
    },
  ): Promise<AiSettingsView> {
    if (dto.provider !== 'anthropic' && dto.provider !== 'openai') {
      throw new BadRequestException('ספק לא נתמך');
    }
    const existing = await this.prisma.aiSettings.findUnique({ where: { userId } });
    const model = dto.model?.trim() || DEFAULT_MODELS[dto.provider];

    let apiKeyEnc = existing?.apiKeyEnc;
    if (dto.apiKey?.trim()) {
      apiKeyEnc = encryptSecret(dto.apiKey.trim(), this.secret());
    }
    if (!apiKeyEnc) {
      throw new BadRequestException('נדרש מפתח API בהגדרה ראשונה');
    }

    const budget =
      dto.monthlyBudgetUsd === undefined
        ? undefined
        : dto.monthlyBudgetUsd === null || dto.monthlyBudgetUsd <= 0
          ? null
          : dto.monthlyBudgetUsd;
    await this.prisma.aiSettings.upsert({
      where: { userId },
      create: {
        userId,
        provider: dto.provider,
        apiKeyEnc,
        model,
        monthlyBudgetUsd: budget ?? null,
      },
      update: { provider: dto.provider, apiKeyEnc, model, monthlyBudgetUsd: budget },
    });
    return (await this.getSettings(userId))!;
  }

  private async clientFor(userId: string): Promise<{
    provider: AiProvider;
    model: string;
    apiKey: string;
  }> {
    const s = await this.prisma.aiSettings.findUnique({ where: { userId } });
    if (!s) throw new BadRequestException('לא הוגדרו הגדרות AI — פתח את הגדרות ה-AI והזן מפתח');
    return {
      provider: s.provider as AiProvider,
      model: s.model,
      apiKey: decryptSecret(s.apiKeyEnc, this.secret()),
    };
  }

  /** רשימת מודלים זמינים מהספק — אימות עקיף של המפתח */
  async listModels(userId: string): Promise<AiModelInfo[]> {
    const { provider, apiKey } = await this.clientFor(userId);
    try {
      if (provider === 'anthropic') {
        const client = new Anthropic({ apiKey });
        const models: AiModelInfo[] = [];
        for await (const m of client.models.list()) {
          models.push({ id: m.id, label: m.display_name ?? m.id });
        }
        return models;
      }
      const client = new OpenAI({ apiKey });
      const page = await client.models.list();
      return page.data
        .filter((m) => /^(gpt-|o\d)/.test(m.id) && !/(embed|audio|tts|whisper|image|dall|realtime|transcribe|moderation)/.test(m.id))
        .sort((a, b) => b.id.localeCompare(a.id))
        .map((m) => ({ id: m.id, label: m.id }));
    } catch (e) {
      throw new UnauthorizedException(
        `החיבור לספק נכשל — בדוק את המפתח (${(e as Error).message})`,
      );
    }
  }

  /** שומר את הניתוח האחרון על רשומת הלקוח — כדי לא לנתח מחדש בכל כניסה */
  private async saveLast(userId: string, result: AnalyzeResult): Promise<void> {
    const clientId = await this.clientIdFor(userId);
    if (!clientId) return;
    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        lastAiAnalysisText: result.text,
        lastAiAnalysisProvider: result.provider,
        lastAiAnalysisModel: result.model,
        lastAiAnalysisAt: new Date(),
      },
    });
  }

  /** רישום קריאה ביומן ה-AI — טוקנים ואומדן עלות, ללא תוכן */
  private async logUsage(
    userId: string,
    capability: string,
    provider: AiProvider,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<void> {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          capability,
          provider,
          model,
          inputTokens,
          outputTokens,
          costUsd: estimateCostUsd(model, inputTokens, outputTokens),
        },
      });
    } catch {
      // כשל ברישום היומן לא מפיל את הקריאה עצמה
    }
  }

  /** ניצול החודש הנוכחי + התקציב + יומן אחרון */
  async getUsage(userId: string): Promise<AiUsageView> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [agg, entries, settings] = await Promise.all([
      this.prisma.aiUsageLog.aggregate({
        where: { userId, createdAt: { gte: monthStart } },
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      }),
      this.prisma.aiUsageLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.aiSettings.findUnique({ where: { userId } }),
    ]);
    const monthCostUsd = Number(agg._sum.costUsd ?? 0);
    const budgetUsd =
      settings?.monthlyBudgetUsd != null ? Number(settings.monthlyBudgetUsd) : null;
    return {
      monthCostUsd: Math.round(monthCostUsd * 100) / 100,
      monthInputTokens: agg._sum.inputTokens ?? 0,
      monthOutputTokens: agg._sum.outputTokens ?? 0,
      budgetUsd,
      usagePct:
        budgetUsd && budgetUsd > 0
          ? Math.round((monthCostUsd / budgetUsd) * 100)
          : null,
      entries: entries.map((e) => ({
        capability: e.capability,
        provider: e.provider,
        model: e.model,
        inputTokens: e.inputTokens,
        outputTokens: e.outputTokens,
        costUsd: Number(e.costUsd),
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  /** אכיפת תקרת התקציב החודשי — נבדקת לפני כל קריאה לספק */
  private async enforceBudget(userId: string): Promise<void> {
    const usage = await this.getUsage(userId);
    if (usage.budgetUsd !== null && usage.monthCostUsd >= usage.budgetUsd) {
      throw new BadRequestException(
        `תקרת התקציב החודשי ל-AI (${usage.budgetUsd}$) נוצלה במלואה — הגדל את התקציב בהגדרות ה-AI או המתן לחודש הבא`,
      );
    }
  }

  /** ניתוח חכם של התיק — הנתונים חושבו במנוע; ה-AI מפרש וממליץ */
  async analyze(userId: string, context: unknown): Promise<AnalyzeResult> {
    await this.enforceBudget(userId);
    const { provider, model, apiKey } = await this.clientFor(userId);
    const userContent = `להלן נתוני התיק הפנסיוני (כולם חושבו במנוע הדטרמיניסטי של המערכת). נתח והמלץ:\n\n\`\`\`json\n${JSON.stringify(context, null, 1)}\n\`\`\`\n\nחשוב: ענה בעברית בלבד, מההתחלה ועד הסוף.`;

    try {
      let result: AnalyzeResult;
      if (provider === 'anthropic') {
        const client = new Anthropic({ apiKey });
        const resp = await client.messages.create({
          model,
          max_tokens: 8000,
          thinking: { type: 'adaptive' },
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        });
        const text = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        await this.logUsage(
          userId,
          'analyze',
          provider,
          resp.model,
          resp.usage.input_tokens,
          resp.usage.output_tokens,
        );
        result = { text, provider, model: resp.model };
      } else {
        const client = new OpenAI({ apiKey });
        const resp = await client.chat.completions.create({
          model,
          max_completion_tokens: 8000,
          // מודלי o1/gpt-5+ (הסקה) מחליפים את role:'system' ב-role:'developer' —
          // הוראת "ענה בעברית בלבד" נדחקת אחרת ומודלים אלה נוטים לחזור לאנגלית
          messages: [
            { role: 'developer', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
        });
        await this.logUsage(
          userId,
          'analyze',
          provider,
          resp.model,
          resp.usage?.prompt_tokens ?? 0,
          resp.usage?.completion_tokens ?? 0,
        );
        result = {
          text: resp.choices[0]?.message?.content ?? '',
          provider,
          model: resp.model,
        };
      }
      await this.saveLast(userId, result);
      return result;
    } catch (e) {
      throw new BadRequestException(
        `קריאת ה-AI נכשלה (${provider}/${model}): ${(e as Error).message}`,
      );
    }
  }

  /**
   * יועץ צ'אט עם Tool Use (מפרט 10א) — המודל מפעיל את מנוע החישוב
   * דרך כלים ולעולם לא מחשב בעצמו. לולאה עד 6 סבבי כלים.
   */
  async chat(userId: string, messages: ChatMessage[]): Promise<ChatResult> {
    if (!messages?.length) throw new BadRequestException('שיחה ריקה');
    await this.enforceBudget(userId);
    const { provider, model, apiKey } = await this.clientFor(userId);
    const toolDefs = this.tools.defs();
    const toolLog: { name: string }[] = [];
    const MAX_TURNS = 6;
    let totalIn = 0;
    let totalOut = 0;

    const runTool = async (name: string, args: unknown): Promise<string> => {
      toolLog.push({ name });
      try {
        return JSON.stringify(await this.tools.execute(userId, name, args));
      } catch (e) {
        return JSON.stringify({ שגיאה: (e as Error).message });
      }
    };

    try {
      if (provider === 'anthropic') {
        const client = new Anthropic({ apiKey });
        const tools: Anthropic.Tool[] = toolDefs.map((d) => ({
          name: d.name,
          description: d.description,
          input_schema: d.schema as Anthropic.Tool.InputSchema,
        }));
        const msgs: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const resp = await client.messages.create({
            model,
            max_tokens: 4000,
            system: CHAT_SYSTEM_PROMPT,
            tools,
            messages: msgs,
          });
          totalIn += resp.usage.input_tokens;
          totalOut += resp.usage.output_tokens;
          if (resp.stop_reason === 'tool_use') {
            msgs.push({ role: 'assistant', content: resp.content });
            const results: Anthropic.ToolResultBlockParam[] = [];
            for (const block of resp.content) {
              if (block.type === 'tool_use') {
                results.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: await runTool(block.name, block.input),
                });
              }
            }
            msgs.push({ role: 'user', content: results });
            continue;
          }
          const text = resp.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('\n');
          await this.logUsage(userId, 'chat', provider, resp.model, totalIn, totalOut);
          return { text, toolCalls: toolLog, provider, model: resp.model };
        }
        throw new Error('חריגה ממספר סבבי הכלים המרבי');
      }

      const client = new OpenAI({ apiKey });
      const tools: OpenAI.Chat.ChatCompletionTool[] = toolDefs.map((d) => ({
        type: 'function',
        function: { name: d.name, description: d.description, parameters: d.schema },
      }));
      const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'developer', content: CHAT_SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const resp = await client.chat.completions.create({
          model,
          max_completion_tokens: 4000,
          tools,
          messages: msgs,
        });
        const msg = resp.choices[0]?.message;
        if (!msg) throw new Error('תשובה ריקה מהמודל');
        totalIn += resp.usage?.prompt_tokens ?? 0;
        totalOut += resp.usage?.completion_tokens ?? 0;
        if (msg.tool_calls?.length) {
          msgs.push(msg);
          for (const tc of msg.tool_calls) {
            if (tc.type !== 'function') continue;
            msgs.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: await runTool(
                tc.function.name,
                JSON.parse(tc.function.arguments || '{}'),
              ),
            });
          }
          continue;
        }
        await this.logUsage(userId, 'chat', provider, resp.model, totalIn, totalOut);
        return {
          text: msg.content ?? '',
          toolCalls: toolLog,
          provider,
          model: resp.model,
        };
      }
      throw new Error('חריגה ממספר סבבי הכלים המרבי');
    } catch (e) {
      throw new BadRequestException(
        `שיחת ה-AI נכשלה (${provider}/${model}): ${(e as Error).message}`,
      );
    }
  }

  /**
   * קליטת דוח שנתי מ-PDF (מפרט 10א, שלב 3) — חילוץ מובנה של מוצרים,
   * יתרות ודמי ניהול. התוצאה היא טיוטה בלבד — המשתמש מאשר לפני הוספה.
   * נתמך כרגע עם ספק Anthropic (תמיכה מובנית ב-PDF).
   */
  async extractReport(userId: string, pdfBase64: string): Promise<ExtractReportResult> {
    if (!pdfBase64?.trim()) throw new BadRequestException('לא התקבל קובץ');
    // ~15MB בקידוד base64 — מגבלה שמכסה כל דוח שנתי סביר
    if (pdfBase64.length > 20_000_000) {
      throw new BadRequestException('הקובץ גדול מדי (עד ~15MB)');
    }
    await this.enforceBudget(userId);
    const { provider, model, apiKey } = await this.clientFor(userId);
    if (provider !== 'anthropic') {
      throw new BadRequestException(
        'קליטת דוח PDF זמינה כרגע עם ספק Claude (Anthropic) בלבד — החלף ספק בהגדרות ה-AI ונסה שוב',
      );
    }

    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model,
        max_tokens: 8000,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'report_data' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              },
              {
                type: 'text',
                text: 'זהו דוח שנתי מגוף פנסיוני ישראלי (קרן פנסיה / קופת גמל / קרן השתלמות / ביטוח מנהלים). חלץ את הנתונים המובנים: כל מוצר עם יתרה צבורה, הפקדות, דמי ניהול (בדוק היטב אם באחוזים או בש"ח — המר לאחוזים לפי היתרה/ההפקדה), שכר מבוטח ותאריך הצטרפות. עלות כיסויים חודשית: חשב מהשורות "עלות הביטוח לסיכוני נכות" ו"עלות הביטוח לשאירים" (סכום שנתי חלקי 12) — אל תשתמש ב"שחרור מתשלום הפקדות" או באחוז ההפקדות לכיסוי. אל תמציא נתונים שאינם בדוח — השאר שדות חסרים ריקים וציין זאת בהערות.',
              },
            ],
          },
        ],
      });
      await this.logUsage(
        userId,
        'extract_report',
        provider,
        resp.model,
        resp.usage.input_tokens,
        resp.usage.output_tokens,
      );
      const toolUse = resp.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      if (!toolUse) throw new Error('המודל לא החזיר נתונים מובנים');
      const data = toolUse.input as {
        products?: ExtractedProduct[];
        reportYear?: number;
        managingBody?: string;
        notes?: string[];
      };
      return {
        products: data.products ?? [],
        reportYear: data.reportYear,
        managingBody: data.managingBody,
        notes: data.notes ?? [],
        model: resp.model,
      };
    } catch (e) {
      throw new BadRequestException(
        `קליטת הדוח נכשלה (${provider}/${model}): ${(e as Error).message}`,
      );
    }
  }
}
