import { useEffect, useLayoutEffect, useState } from 'react';

export interface TourStep {
  title: string;
  body: string;
  /** מוצא את יעד ההדגשה — פונקציה כדי לתמוך בסלקטורים דינמיים (למשל לפי טקסט כותרת) */
  find: () => HTMLElement | null;
  /** פעולה בטוחה והפיכה בלבד (פתיחת פאנל/אקורדיון) — לעולם לא משנה נתוני תיק */
  beforeShow?: () => void;
  /** תיעוד בלבד — כל צעד שהיעד שלו לא נמצא מדולג אוטומטית, כדי שהסיור לעולם לא ייתקע */
  optional?: boolean;
}

const SETTLE_MS = 380;

export function Tour(props: { steps: TourStep[]; onFinish: () => void }) {
  const { steps, onFinish } = props;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[index];

  useLayoutEffect(() => {
    setRect(null);
    step.beforeShow?.();

    let cancelled = false;
    const target = step.find();
    if (!target) {
      // היעד לא נמצא (למשל תוצאה שטרם חושבה) — מדלגים כדי שהסיור לא ייתקע
      if (index < steps.length - 1) {
        setIndex((i) => i + 1);
      } else {
        onFinish();
      }
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => {
      if (cancelled) return;
      setRect(target.getBoundingClientRect());
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    if (!rect) return;
    const target = step.find();
    if (!target) return;
    const onScrollOrResize = () => setRect(target.getBoundingClientRect());
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect === null]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFinish();
      if (e.key === 'ArrowLeft') onNext();
      if (e.key === 'ArrowRight') onPrev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function onNext() {
    if (index < steps.length - 1) setIndex((i) => i + 1);
    else onFinish();
  }
  function onPrev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  if (!rect) {
    // בזמן איתור/גלילה ליעד — לא מציגים כלום כדי למנוע הבהוב במקום שגוי
    return null;
  }

  const pad = 8;
  const top = Math.max(0, rect.top - pad);
  const left = Math.max(0, rect.left - pad);
  const width = rect.width + pad * 2;
  const height = rect.height + pad * 2;
  const bottom = top + height;

  const spaceBelow = window.innerHeight - bottom;
  const placeBelow = spaceBelow > 200 || rect.top < 200;
  const tooltipTop = placeBelow ? bottom + 14 : undefined;
  const tooltipBottom = !placeBelow ? window.innerHeight - top + 14 : undefined;
  const tooltipLeft = Math.min(
    Math.max(16, left + width / 2 - 170),
    window.innerWidth - 356,
  );

  return (
    <div className="tour-root" role="dialog" aria-modal="true">
      <div className="tour-mask" style={{ top: 0, left: 0, right: 0, height: top }} />
      <div
        className="tour-mask"
        style={{ top: bottom, left: 0, right: 0, bottom: 0 }}
      />
      <div
        className="tour-mask"
        style={{ top, left: 0, width: left, height }}
      />
      <div
        className="tour-mask"
        style={{ top, left: left + width, right: 0, height }}
      />
      <div className="tour-highlight" style={{ top, left, width, height }} />

      <div
        className="tour-tooltip"
        style={{ top: tooltipTop, bottom: tooltipBottom, left: tooltipLeft }}
      >
        <div className="tour-tooltip-head">
          <span className="tour-step-count">
            {index + 1} / {steps.length}
          </span>
          <button className="remove-btn" onClick={onFinish} title="סגור סיור">
            ✕
          </button>
        </div>
        <h4 className="tour-title">{step.title}</h4>
        <p className="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button className="trace-toggle" onClick={onFinish}>
            דלג על הסיור
          </button>
          <div className="tour-nav">
            {index > 0 && (
              <button className="save-btn" onClick={onPrev}>
                הקודם
              </button>
            )}
            <button className="calc-btn" onClick={onNext}>
              {index === steps.length - 1 ? 'סיום' : 'הבא'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
