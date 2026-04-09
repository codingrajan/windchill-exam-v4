import type { Question } from '../../types/index';

export default function QuestionPrompt({
  question,
  index,
  compact = false,
}: {
  question: Question;
  index?: number;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-zinc-900 leading-relaxed`}>
        {typeof index === 'number' && <span className="text-zinc-400 mr-1">Q{index + 1}.</span>}
        {question.question}
      </p>
      {!compact && question.codeSnippet && (
        <pre className="overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-950 px-4 py-4 text-[12px] leading-6 text-zinc-100">
          <code>{question.codeSnippet}</code>
        </pre>
      )}
    </div>
  );
}
