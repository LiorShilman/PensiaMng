import { useEffect, useState } from 'react';
import {
  getTrainingHistory,
  getTrainingScenario,
  submitTrainingAnswer,
  UnauthorizedError,
  type TrainingHistory,
  type TrainingScenarioView,
  type TrainingSubmitResult,
  type TrainingUserAnswer,
  type GapRange,
} from './api';

const nis = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

/** טווחי הפער לבחירה — תואם ל-GAP_RANGE_ORDER בשרת */
const GAP_RANGES: { value: GapRange; label: string }[] = [
  { value: 'UNDER_5K', label: 'עד ₪5,000' },
  { value: 'K5_15K', label: '₪5,000–15,000' },
  { value: 'K15_30K', label: '₪15,000–30,000' },
  { value: 'OVER_30K', label: 'מעל ₪30,000' },
];

export function TrainingScenario(props: { onClose: () => void; onUnauthorized: () => void }) {
  const [history, setHistory] = useState<TrainingHistory | null>(null);
  const [scenario, setScenario] = useState<TrainingScenarioView | null>(null);
  const [choice, setChoice] = useState<'FUND' | 'ALTERNATIVE' | null>(null);
  const [gapRange, setGapRange] = useState<GapRange | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [result, setResult] = useState<TrainingSubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTrainingHistory()
      .then(setHistory)
      .catch((e) => {
        if (e instanceof UnauthorizedError) props.onUnauthorized();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onGenerate() {
    setBusy(true);
    setError(null);
    setResult(null);
    setChoice(null);
    setGapRange(null);
    setShowHint(false);
    try {
      const s = await getTrainingScenario();
      setScenario(s);
    } catch (e) {
      if (e instanceof UnauthorizedError) return props.onUnauthorized();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!scenario || !choice) {
      setError('יש לבחור איזו הלוואה עדיפה');
      return;
    }
    if (!gapRange) {
      setError('יש לבחור טווח פער');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const userAnswer: TrainingUserAnswer = { choice, gapRange };
      const r = await submitTrainingAnswer(scenario.attemptId, userAnswer);
      setResult(r);
      getTrainingHistory().then(setHistory).catch(() => undefined);
    } catch (e) {
      if (e instanceof UnauthorizedError) return props.onUnauthorized();
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card ai-panel">
      <div className="ai-panel-head">
        <h2 className="card-title">אימון תרחישים — הלוואת קרן מול הלוואה חיצונית</h2>
        <button className="remove-btn" onClick={props.onClose} title="סגור">
          ✕
        </button>
      </div>

      <p className="hint">
        AI ממציא לקוח בדוי ודילמה — אתה מנחש מה עדיף לו, ומנוע החישוב הדטרמיניסטי של המערכת
        (לא ה-AI) חושף את התשובה הנכונה.
      </p>

      {history && history.count > 0 && (
        <p className="hint">
          עד כה: {history.count} תרחישים · ציון ממוצע {history.averageScore ?? 0}
        </p>
      )}

      {error && <div className="error">{error}</div>}

      {!scenario && (
        <div className="ai-panel-actions">
          <button className="calc-btn" onClick={onGenerate} disabled={busy}>
            {busy ? 'יוצר תרחיש…' : 'תן לי דילמה'}
          </button>
        </div>
      )}

      {scenario && !result && (
        <>
          <div className="card fixation-scenario custom training-story">
            <h4>
              {scenario.scenario.clientName}, גיל {scenario.scenario.age}
            </h4>
            <p>{scenario.scenario.storyText}</p>
            <dl>
              <dt>סכום ההלוואה המבוקש</dt>
              <dd>{nis(scenario.scenario.loanAmount)}</dd>
              <dt>תקופה</dt>
              <dd>{scenario.scenario.months} חודשים</dd>
              <dt>ריבית הלוואת הקרן</dt>
              <dd>{scenario.scenario.fundLoanAnnualRatePct}% שנתי</dd>
              <dt>ריבית ההלוואה החלופית</dt>
              <dd>{scenario.scenario.alternativeAnnualRatePct}% שנתי</dd>
              <dt>הסכום המשועבד</dt>
              <dd>{scenario.scenario.collateralFrozen ? 'מפסיק לצבור תשואה בזמן ההלוואה' : 'ממשיך לצבור תשואה כרגיל'}</dd>
            </dl>
          </div>

          <div className="training-answer">
            <div className="training-choice">
              <span className="field-label">מה עדיף?</span>
              <div className="training-choice-btns">
                <button
                  className={`training-choice-btn ${choice === 'FUND' ? 'selected' : ''}`}
                  onClick={() => setChoice('FUND')}
                >
                  הלוואת הקרן
                </button>
                <button
                  className={`training-choice-btn ${choice === 'ALTERNATIVE' ? 'selected' : ''}`}
                  onClick={() => setChoice('ALTERNATIVE')}
                >
                  הלוואה חלופית
                </button>
              </div>
            </div>

            <div className="training-choice">
              <span className="field-label">בכמה בערך זולה האפשרות שבחרת בסה"כ?</span>
              <div className="training-choice-btns">
                {GAP_RANGES.map((r) => (
                  <button
                    key={r.value}
                    className={`training-choice-btn ${gapRange === r.value ? 'selected' : ''}`}
                    onClick={() => setGapRange(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="calc-btn" onClick={onSubmit} disabled={busy}>
              {busy ? 'בודק…' : 'בדוק אותי'}
            </button>
          </div>

          <button className="trace-toggle" onClick={() => setShowHint((v) => !v)}>
            {showHint ? 'הסתר את כלל האצבע' : 'איך מעריכים בעל-פה? הצג כלל אצבע'}
          </button>
          {showHint && (
            <p className="hint">
              סך הריבית בהלוואה בערך: סכום × ריבית שנתית × שנים ÷ 2 (חצי, כי הקרן יורדת
              בהדרגה). חשב כך לכל אחת מההלוואות והשווה. אם הסכום המשועבד מפסיק לצבור תשואה —
              הוסף להלוואת הקרן גם את התשואה שאבדה: בערך סכום × תשואה שנתית × שנים.
            </p>
          )}
        </>
      )}

      {scenario && result && (
        <>
          <div className="fixation-scenarios">
            <div className="card fixation-scenario custom">
              <h4>ההצעה שלך</h4>
              <dl>
                <dt>מה בחרת</dt>
                <dd>{choice === 'FUND' ? 'הלוואת הקרן' : 'הלוואה חלופית'}</dd>
                <dt>הטווח שהערכת</dt>
                <dd>{GAP_RANGES.find((r) => r.value === gapRange)?.label ?? '—'}</dd>
              </dl>
            </div>
            <div className="card fixation-scenario custom">
              <h4>התשובה של מנוע החישוב</h4>
              <dl>
                <dt>עלות כוללת — הלוואת הקרן</dt>
                <dd className={result.engineAnswer.totalCostGap <= 0 ? 'good' : 'excess'}>
                  {nis(result.engineAnswer.fundLoan.totalCost)}
                </dd>
                <dt>עלות כוללת — הלוואה חלופית</dt>
                <dd className={result.engineAnswer.totalCostGap >= 0 ? 'good' : 'excess'}>
                  {nis(result.engineAnswer.alternativeLoan.totalInterest)}
                </dd>
                <dt>הפער בפועל</dt>
                <dd>{nis(Math.abs(result.engineAnswer.totalCostGap))}</dd>
              </dl>
            </div>
          </div>

          <div className="fixation-summary">
            <div className="scenario-stat">
              <div className={`stat-value ${result.score >= 50 ? 'good' : 'excess'}`}>
                {result.score}/100
              </div>
              <div className="stat-label">{result.verdict}</div>
            </div>
          </div>

          {result.engineAnswer.warnings.length > 0 && (
            <div className="warnings" style={{ marginTop: 16 }}>
              {result.engineAnswer.warnings.map((w, i) => (
                <div key={i} className="warning-item">
                  ⚠ {w}
                </div>
              ))}
            </div>
          )}

          <div className="ai-panel-actions" style={{ marginTop: 16 }}>
            <button className="calc-btn" onClick={onGenerate} disabled={busy}>
              {busy ? 'יוצר תרחיש…' : 'תרחיש נוסף'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
