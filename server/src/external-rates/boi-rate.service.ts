import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/**
 * ריבית בנק ישראל — משיכה מ-API הציבורי הרשמי (בלי אימות/מפתח).
 * מתעדכן רק במועדי החלטת ריבית (כל 6-7 שבועות) — נשמר בזיכרון עם TTL
 * של יממה כדי לא לפנות לשרת החיצוני בכל בקשה.
 */

export interface BoiInterestRate {
  currentInterest: number;
  nextInterestDate: string;
  lastPublishedDate: string;
}

const BOI_API_URL = 'https://boi.org.il/PublicApi/GetInterest';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class BoiRateService {
  private cache: { data: BoiInterestRate; fetchedAt: number } | null = null;

  async getBoiInterestRate(): Promise<BoiInterestRate> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.data;
    }

    let res: Response;
    try {
      res = await fetch(BOI_API_URL, { signal: AbortSignal.timeout(8000) });
    } catch {
      throw new ServiceUnavailableException(
        'לא ניתן להתחבר כרגע לשירות בנק ישראל — נסה שוב מאוחר יותר',
      );
    }
    if (!res.ok) {
      throw new ServiceUnavailableException(
        'שירות בנק ישראל החזיר שגיאה — נסה שוב מאוחר יותר',
      );
    }

    const data = (await res.json()) as BoiInterestRate;
    this.cache = { data, fetchedAt: Date.now() };
    return data;
  }
}
