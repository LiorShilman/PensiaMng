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

export type AiProvider = 'anthropic' | 'openai';

export interface AiSettingsView {
  provider: AiProvider;
  model: string;
  hasKey: boolean;
  keyMask: string | null;
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

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
    };
  }

  async saveSettings(
    userId: string,
    dto: { provider: AiProvider; apiKey?: string; model?: string },
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

    await this.prisma.aiSettings.upsert({
      where: { userId },
      create: { userId, provider: dto.provider, apiKeyEnc, model },
      update: { provider: dto.provider, apiKeyEnc, model },
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

  /** ניתוח חכם של התיק — הנתונים חושבו במנוע; ה-AI מפרש וממליץ */
  async analyze(userId: string, context: unknown): Promise<AnalyzeResult> {
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
}
