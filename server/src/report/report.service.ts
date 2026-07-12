import { Injectable, InternalServerErrorException } from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer';

/**
 * הפקת PDF אמיתי מ-HTML מעוצב (מפרט סעיף 8) — לא צילום מסך, טקסט וקטורי
 * בר-חיפוש/סימון. ה-HTML נבנה בצד הלקוח (report.ts, אותה תבנית שמשמשת
 * גם ל"הדפסה/שמירה כ-PDF" מהדפדפן) ומועבר לכאן כמו שהוא.
 *
 * אבטחה: מריצים כל בקשה בדפדפן headless חדש עם JS מושבת — ה-HTML הזה
 * הוא לא תוכן משתמש חופשי, אבל עדיין לא רוצים לתת לו הזדמנות להריץ קוד
 * או לבצע קריאות רשת מהשרת (SSRF) דרך <script>/onclick.
 */
@Injectable()
export class ReportService {
  async renderPdf(html: string): Promise<Buffer> {
    let browser: Browser | undefined;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setJavaScriptEnabled(false);
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      await page.emulateMediaType('print');
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
      return Buffer.from(pdf);
    } catch (e) {
      throw new InternalServerErrorException(
        `יצירת ה-PDF נכשלה: ${(e as Error).message}`,
      );
    } finally {
      await browser?.close();
    }
  }
}
