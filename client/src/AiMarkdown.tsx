/** רינדור Markdown מינימלי לתשובות AI — כותרות, מודגש, רשימות, דיסקליימר */
export function AiMarkdown(props: { text: string }) {
  const lines = props.text.split('\n');
  const render = (line: string, key: number) => {
    // מודגש **כך** — פיצול פשוט
    const parts = line.split(/\*\*(.+?)\*\*/g);
    const content = parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p));
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
    if (line.startsWith('_') && line.endsWith('_')) {
      return (
        <p key={key} className="ai-disclaimer">
          {line.slice(1, -1)}
        </p>
      );
    }
    if (line.trim() === '') return <div key={key} className="ai-space" />;
    return <p key={key}>{content}</p>;
  };
  return <div className="ai-md">{lines.map(render)}</div>;
}
