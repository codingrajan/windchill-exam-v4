export function buildReportSummaryHTML(opts: {
  name: string;
  score: number;
  passed: boolean;
  date: string;
  examTitle: string;
  trackLabel: string;
  totalQuestions: number;
  correct: number;
  timeTakenLabel: string;
  strongestDomain: string;
  weakestDomain: string;
  benchmarkMessage?: string;
  focusAreas?: string[];
}): string {
  const focusItems = (opts.focusAreas ?? [])
    .map((item) => `<li>${item}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Exam Summary</title>
<style>
  @page { margin: 18mm; }
  body { font-family: Arial, sans-serif; color: #18181b; background: #fff; margin: 0; }
  .sheet { max-width: 840px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 28px; margin: 0 0 8px; }
  .meta { color: #52525b; font-size: 13px; margin-bottom: 24px; }
  .status { display: inline-block; padding: 6px 12px; border-radius: 999px; font-weight: 700; font-size: 12px; margin-bottom: 20px; background: ${opts.passed ? '#ecfdf5' : '#fef2f2'}; color: ${opts.passed ? '#047857' : '#b91c1c'}; border: 1px solid ${opts.passed ? '#a7f3d0' : '#fecaca'}; }
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }
  .card { border: 1px solid #e4e4e7; border-radius: 14px; padding: 14px; background: #fafafa; }
  .card .label { font-size: 11px; text-transform: uppercase; color: #71717a; font-weight: 700; margin-bottom: 6px; }
  .card .value { font-size: 24px; font-weight: 800; }
  .panel { border: 1px solid #e4e4e7; border-radius: 16px; padding: 16px; margin-bottom: 16px; }
  .panel h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: #52525b; margin: 0 0 10px; }
  ul { margin: 8px 0 0 18px; padding: 0; }
  li { margin: 0 0 6px; }
</style>
</head>
<body>
  <div class="sheet">
    <h1>${opts.name}</h1>
    <div class="meta">${opts.examTitle} · ${opts.trackLabel} · ${opts.date}</div>
    <div class="status">${opts.passed ? 'Passed' : 'Needs Improvement'}</div>
    <div class="grid">
      <div class="card"><div class="label">Score</div><div class="value">${opts.score}%</div></div>
      <div class="card"><div class="label">Correct</div><div class="value">${opts.correct}/${opts.totalQuestions}</div></div>
      <div class="card"><div class="label">Time</div><div class="value">${opts.timeTakenLabel}</div></div>
      <div class="card"><div class="label">Result</div><div class="value">${opts.passed ? 'PASS' : 'FAIL'}</div></div>
    </div>
    <div class="panel">
      <h2>Section Signals</h2>
      <p><strong>Strongest:</strong> ${opts.strongestDomain}</p>
      <p><strong>Weakest:</strong> ${opts.weakestDomain}</p>
    </div>
    ${opts.benchmarkMessage ? `<div class="panel"><h2>Benchmark</h2><p>${opts.benchmarkMessage}</p></div>` : ''}
    ${focusItems ? `<div class="panel"><h2>Next Focus</h2><ul>${focusItems}</ul></div>` : ''}
  </div>
</body>
</html>`;
}
