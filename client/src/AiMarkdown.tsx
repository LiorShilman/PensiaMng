import type { ReactNode } from 'react';

/** רינדור Markdown מינימלי לתשובות AI — כותרות, מודגש, רשימות, טבלאות, דיסקליימר */

/** מודגש **כך** — פיצול פשוט */
function bold(line: string): ReactNode[] {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p));
}

const isTableLine = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isSeparatorLine = (l: string) => /^\s*\|[\s\-:|]+\|\s*$/.test(l);

function renderLine(line: string, key: number): ReactNode {
  const content = bold(line);
  if (line.startsWith('## ')) {
    return (
      <h4 key={key} className="ai-h">
        {line.slice(3)}
      </h4>
    );
  }
  if (line.startsWith('# ')) {
    return (
      <h4 key={key} className="ai-h">
        {line.slice(2)}
      </h4>
    );
  }
  if (/^[-*•] /.test(line)) {
    return (
      <div key={key} className="ai-li">
        <span className="ai-bullet">•</span>
        <span>{content.map((c, i) => (typeof c === 'string' && i === 0 ? c.slice(2) : c))}</span>
      </div>
    );
  }
  if (/^\d+[.)] /.test(line)) {
    return (
      <div key={key} className="ai-li num">
        {content}
      </div>
    );
  }
  if (line.startsWith('_') && line.endsWith('_') && line.length > 2) {
    return (
      <p key={key} className="ai-disclaimer">
        {line.slice(1, -1)}
      </p>
    );
  }
  if (line.trim() === '') return <div key={key} className="ai-space" />;
  return <p key={key}>{content}</p>;
}

export function AiMarkdown(props: { text: string }) {
  const lines = props.text.split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    if (isTableLine(lines[i])) {
      // איסוף בלוק טבלה רציף ופירוקו לתאים (שורת ה-|---| נזרקת)
      const block: string[] = [];
      while (i < lines.length && isTableLine(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      const rows = block
        .filter((l) => !isSeparatorLine(l))
        .map((l) =>
          l
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim()),
        )
        .filter((r) => r.some((c) => c !== ''));
      if (rows.length > 0) {
        out.push(
          <div key={key++} className="ai-table-wrap">
            <table className="ai-table">
              <thead>
                <tr>
                  {rows[0].map((c, j) => (
                    <th key={j}>{bold(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, j) => (
                      <td key={j}>{bold(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }
    out.push(renderLine(lines[i], key++));
    i++;
  }

  return <div className="ai-md">{out}</div>;
}
