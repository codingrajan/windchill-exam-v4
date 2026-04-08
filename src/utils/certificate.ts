export function buildCertificateHTML(opts: {
  name: string;
  score: number;
  date: string;
  examTitle: string;
  totalQuestions: number;
  correct: number;
  ptcLogoUrl: string;
  pluralLogoUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Certificate of Achievement</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 32px; }
  .cert { width: 800px; border: 8px solid #4f46e5; border-radius: 24px; padding: 60px 72px; text-align: center; position: relative; background: #fff; }
  .cert::before { content: ''; position: absolute; inset: 12px; border: 2px solid #e0e7ff; border-radius: 16px; pointer-events: none; }
  .logo-row { display: flex; align-items: center; justify-content: center; gap: 24px; margin-bottom: 12px; }
  .logo-img { height: 48px; object-fit: contain; border-radius: 10px; border: 1px solid #e4e4e7; padding: 6px; background: #fff; }
  .logo-x { font-size: 18px; font-weight: 800; color: #a1a1aa; }
  .platform-label { font-size: 11px; font-weight: 700; color: #6366f1; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 32px; }
  .subtitle { font-size: 13px; font-weight: 600; color: #a1a1aa; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  h1 { font-size: 36px; font-weight: 800; color: #18181b; margin-bottom: 24px; }
  .presented { font-size: 14px; color: #71717a; margin-bottom: 8px; font-weight: 600; }
  .name { font-size: 48px; font-weight: 800; color: #4f46e5; margin-bottom: 8px; border-bottom: 3px solid #e0e7ff; padding-bottom: 16px; }
  .exam-title { font-size: 16px; color: #52525b; font-weight: 600; margin: 24px 0; }
  .score-circle { width: 120px; height: 120px; border-radius: 50%; background: #f0fdf4; border: 6px solid #059669; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; margin: 16px 0; }
  .score-pct { font-size: 32px; font-weight: 800; color: #059669; line-height: 1; }
  .score-label { font-size: 10px; font-weight: 700; color: #059669; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
  .meta { font-size: 12px; color: #a1a1aa; margin-top: 8px; font-weight: 600; }
  .pass-badge { display: inline-block; background: #f0fdf4; color: #059669; border: 2px solid #bbf7d0; border-radius: 100px; padding: 8px 28px; font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-top: 24px; }
  .footer { margin-top: 40px; padding-top: 24px; border-top: 2px solid #f4f4f5; font-size: 11px; color: #d4d4d8; font-weight: 600; letter-spacing: 1px; }
</style>
</head>
<body>
<div class="cert">
  <div class="logo-row">
    <img class="logo-img" src="${opts.ptcLogoUrl}" alt="PTC" />
    <span class="logo-x">&times;</span>
    <img class="logo-img" src="${opts.pluralLogoUrl}" alt="Plural" />
  </div>
  <div class="platform-label">PTC &times; Plural Mock Exam</div>
  <div class="subtitle">Certificate of Achievement</div>
  <h1>This certifies that</h1>
  <div class="presented">the following candidate has successfully passed</div>
  <div class="name">${opts.name}</div>
  <div class="exam-title">${opts.examTitle}</div>
  <div class="score-circle">
    <div class="score-pct">${opts.score}%</div>
    <div class="score-label">Score</div>
  </div>
  <div class="meta">${opts.correct} of ${opts.totalQuestions} questions correct &nbsp;&middot;&nbsp; Issued ${opts.date}</div>
  <div class="pass-badge">&#10003; Passed</div>
  <div class="footer">PTC &times; Plural Windchill Exam Platform &nbsp;&bull;&nbsp; Issued on ${opts.date}</div>
</div>
</body>
</html>`;
}
