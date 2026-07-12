import { useRef, useState } from 'react';
import {
  aiExtractReport,
  UnauthorizedError,
  type ExtractedProduct,
  type ExtractReportResult,
} from './api';

/**
 * קליטת דוח שנתי מ-PDF באמצעות AI (מפרט 10א, שלב 3).
 * הקובץ נשלח לספק ה-AI רק בהסכמה מפורשת פר-קובץ; התוצאה היא טיוטה
 * שהמשתמש סוקר, מסמן ומאשר לפני ההוספה לתיק.
 */

interface Props {
  aiConfigured: boolean;
  onUnauthorized: () => void;
  /** מוסיף את המוצרים המאושרים לתיק (App ממפה לטיפוס המלא) */
  onAdd: (items: ExtractedProduct[]) => void;
}

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

/** אייקון מסמך — SVG שיורש את צבע הטקסט (אימוג'י מרונדר חיוור על רקע כהה) */
const DocIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ verticalAlign: '-2px', marginInlineEnd: 6 }}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="13" y2="17" />
  </svg>
);

export function ReportImport(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractReportResult | null>(null);
  const [checked, setChecked] = useState<boolean[]>([]);

  async function onFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('יש לבחור קובץ PDF');
      return;
    }
    // הסכמה מפורשת פר-קובץ (מפרט 10א.4) — הקובץ המלא נשלח לספק חיצוני
    const ok = window.confirm(
      `הקובץ "${file.name}" יישלח במלואו לספק ה-AI שהגדרת לצורך חילוץ הנתונים.\n\nמומלץ לוודא שהדוח אינו כולל פרטים שאינך מעוניין לשלוח. להמשיך?`,
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const s = reader.result as string;
          resolve(s.slice(s.indexOf(',') + 1)); // מסיר את קידומת ה-data URL
        };
        reader.onerror = () => reject(new Error('קריאת הקובץ נכשלה'));
        reader.readAsDataURL(file);
      });
      const r = await aiExtractReport(base64);
      setResult(r);
      setChecked(r.products.map(() => true));
      if (r.products.length === 0) {
        setError('לא זוהו מוצרים בדוח — ודא שזהו דוח שנתי מגוף פנסיוני');
      }
    } catch (e) {
      if (e instanceof UnauthorizedError) return props.onUnauthorized();
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onConfirm() {
    if (!result) return;
    props.onAdd(result.products.filter((_, i) => checked[i]));
    setResult(null);
  }

  return (
    <div className="report-import">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <button
        className="add-chip"
        disabled={busy}
        title={
          props.aiConfigured
            ? 'העלה דוח שנתי מגוף פנסיוני — ה-AI יחלץ את הנתונים לאישורך'
            : 'דורש הגדרת AI (ספק Claude)'
        }
        onClick={() => {
          if (!props.aiConfigured) {
            setError('קליטת דוח דורשת הגדרת AI — פתח את הגדרות ה-AI בכפתור שבראש המסך והזן מפתח');
            return;
          }
          fileRef.current?.click();
        }}
      >
        {busy ? (
          'מחלץ נתונים… (עד דקה)'
        ) : (
          <>
            {DocIcon}
            קלוט דוח שנתי (AI)
          </>
        )}
      </button>
      {error && <div className="error">{error}</div>}

      {result && result.products.length > 0 && (
        <div className="card import-review">
          <h3 className="card-title">
            נתונים שחולצו {result.managingBody ? `— ${result.managingBody}` : ''}
            {result.reportYear ? ` (דוח ${result.reportYear})` : ''}
          </h3>
          <p className="hint">
            טיוטה בלבד — בדוק את המספרים מול הדוח, בטל סימון של מה שלא רלוונטי, ואשר.
            שדות חסרים יקבלו ברירות מחדל שניתן לערוך בכרטיס המוצר.
          </p>
          <div className="import-list">
            {result.products.map((p, i) => (
              <label key={i} className="import-item">
                <input
                  type="checkbox"
                  checked={checked[i] ?? false}
                  onChange={(e) =>
                    setChecked(checked.map((c, ii) => (ii === i ? e.target.checked : c)))
                  }
                />
                <div className="import-item-body">
                  <strong>{p.name}</strong>
                  <span className="import-detail">
                    יתרה: {nis(p.currentBalance)}
                    {p.monthlyDeposit ? ` · הפקדה: ${nis(p.monthlyDeposit)}` : ''}
                    {p.feeFromBalancePct !== undefined
                      ? ` · ד"נ מצבירה: ${p.feeFromBalancePct}%`
                      : ''}
                    {p.feeFromDepositPct !== undefined
                      ? ` · ד"נ מהפקדה: ${p.feeFromDepositPct}%`
                      : ''}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </span>
                </div>
              </label>
            ))}
          </div>
          {result.notes.length > 0 && (
            <div className="warnings">
              {result.notes.map((n, i) => (
                <div key={i} className="warning-item">⚠ {n}</div>
              ))}
            </div>
          )}
          <div className="import-actions">
            <button
              className="calc-btn"
              onClick={onConfirm}
              disabled={!checked.some(Boolean)}
            >
              הוסף {checked.filter(Boolean).length} מוצרים לתיק
            </button>
            <button className="trace-toggle" onClick={() => setResult(null)}>
              בטל
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
