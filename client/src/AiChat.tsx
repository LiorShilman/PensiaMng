import { useEffect, useRef, useState } from 'react';
import { aiChat, UnauthorizedError, type ChatMessage } from './api';
import { AiMarkdown } from './AiMarkdown';
import { IconMessage, IconWrench } from './icons';

/**
 * יועץ צ'אט AI עם Tool Use (מפרט 10א) — המודל מפעיל את מנוע החישוב
 * של המערכת על התיק השמור ולעולם לא מחשב בעצמו. ההיסטוריה נשמרת
 * בזיכרון הדפדפן לאורך הביקור בלבד (מפרט: מקומית בלבד).
 */

interface Props {
  onUnauthorized: () => void;
}

interface UiMessage extends ChatMessage {
  /** הכלים שהופעלו כדי לענות (להצגה שקופה) */
  tools?: string[];
}

const TOOL_LABELS: Record<string, string> = {
  get_portfolio_summary: 'קריאת תמונת התיק',
  calc_projection: 'חישוב תחזית פרישה',
  calc_insurance_scenarios: 'חישוב תרחישי ביטוח',
  calc_rights_fixation: 'סימולציית קיבוע זכויות',
  calc_tax_benefits: 'חישוב הטבות מס',
};

const SUGGESTIONS = [
  'מה יקרה לקצבה שלי אם אפרוש בגיל 62?',
  'איפה הפערים הכי גדולים בתיק שלי?',
  'כמה אשלם דמי ניהול עד הפרישה ומה אפשר לעשות?',
  'האם כדאי לי היוון בקיבוע זכויות?',
];

export function AiChat(props: Props) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // גלילה בתוך תיבת ההודעות בלבד — scrollIntoView גולל את כל הדף (באג)
  useEffect(() => {
    if (messages.length === 0) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  // גובה אוטומטי לתיבת הקלט — גדל עם השורות (עד תקרה), וחוזר לגובה שורה
  // אחת אחרי שליחה שמנקה את input
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history: UiMessage[] = [...messages, { role: 'user', content }];
    setMessages(history);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const r = await aiChat(history.map(({ role, content }) => ({ role, content })));
      setMessages([
        ...history,
        {
          role: 'assistant',
          content: r.text,
          tools: r.toolCalls.map((t) => TOOL_LABELS[t.name] ?? t.name),
        },
      ]);
    } catch (e) {
      if (e instanceof UnauthorizedError) return props.onUnauthorized();
      setError((e as Error).message);
      // מחזירים את שאלת המשתמש לתיבה כדי שלא תלך לאיבוד
      setMessages(messages);
      setInput(content);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card chat-card">
      <div className="chat-head">
        <h3 className="card-title">
          {IconMessage}
          שאל את היועץ
          <span
            className="tip"
            data-tip="שאלות חופשיות על התיק השמור שלך. המודל לא מחשב בעצמו — הוא מפעיל את מנוע החישוב של המערכת (תחזית, תרחישים, קיבוע, מס) ומפרש את התוצאות. ההיסטוריה נשמרת רק בדפדפן ונמחקת ברענון."
            tabIndex={0}
          >
            ⓘ
          </span>
        </h3>
        {messages.length > 0 && (
          <button className="trace-toggle" onClick={() => setMessages([])}>
            נקה שיחה
          </button>
        )}
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-suggestions">
            <p className="hint">היועץ עובד על התיק השמור — שמור את התיק לפני שאלות. נסה למשל:</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chat-suggestion" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.tools && m.tools.length > 0 && (
              <div className="chat-tools">
                {[...new Set(m.tools)].map((t) => (
                  <span key={t} className="tool-chip">{IconWrench} {t}</span>
                ))}
              </div>
            )}
            {m.role === 'assistant' ? (
              <AiMarkdown text={m.content} />
            ) : (
              <p>{m.content}</p>
            )}
          </div>
        ))}
        {busy && (
          <div className="chat-msg assistant chat-busy">
            מפעיל את מנוע החישוב… (עד דקה)
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>

      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="שאל שאלה על התיק שלך… (Shift+Enter לירידת שורה)"
          value={input}
          disabled={busy}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button
          className="calc-btn chat-send"
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
        >
          שלח
        </button>
      </div>
    </div>
  );
}
