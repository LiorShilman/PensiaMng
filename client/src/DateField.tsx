import { useEffect, useRef, useState } from 'react';
import { IconCalendar } from './icons';

/**
 * שדה תאריך שמציג תמיד dd/mm/yyyy, ללא קשר להגדרות שפה/אזור של המכשיר.
 * ל-<input type="date"> הרגיל אין שליטה על התצוגה — הדפדפן מצייר את הטקסט
 * לפי locale המכשיר (למשל מכשירים ניידים מסוימים מציגים mm/dd). הפתרון:
 * שדה טקסט עם התבנית הקבועה שלנו + לוח שנה נייטיבי מוסתר (מופעל דרך כפתור)
 * לחוויית הבחירה הנוחה. הערך המאוחסן תמיד ISO (yyyy-mm-dd), כמו קודם.
 */

interface Props {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
}

function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function displayToIso(display: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(display.trim());
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3];
  const d = new Date(`${year}-${month}-${day}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  if (d.getDate() !== Number(day) || d.getMonth() + 1 !== Number(month)) return null;
  return `${year}-${month}-${day}`;
}

export function DateField(props: Props) {
  const [text, setText] = useState(() => isoToDisplay(props.value));
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(isoToDisplay(props.value));
  }, [props.value]);

  return (
    <div className="date-field">
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const iso = displayToIso(v);
          if (iso) props.onChange(iso);
        }}
        onBlur={() => setText(isoToDisplay(props.value))}
      />
      <button
        type="button"
        className="date-field-pick"
        title="בחר תאריך מלוח שנה"
        onClick={() => {
          const el = nativeRef.current;
          if (!el) return;
          const withPicker = el as HTMLInputElement & { showPicker?: () => void };
          if (typeof withPicker.showPicker === 'function') {
            withPicker.showPicker();
          } else {
            el.focus();
          }
        }}
      >
        {IconCalendar}
      </button>
      <input
        ref={nativeRef}
        type="date"
        className="date-field-native"
        tabIndex={-1}
        aria-hidden="true"
        value={props.value}
        min={props.min}
        max={props.max}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
