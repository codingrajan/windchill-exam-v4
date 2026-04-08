import { useEffect, useMemo, useState } from 'react';
import { loadQuestionPool, QUESTION_POOL_FILES, getQuestionDomain, isMultiAnswerQuestion } from '../../utils/examLogic';
import type { Question } from '../../types/index';

const SOURCE_MANUALS = [
  'Windchill Technical Essentials course manual.pdf',
  'Windchill Advanced Configuration course manual.pdf',
] as const;

function MetricCard({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'warn' | 'good' }) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : 'text-zinc-900';

  return (
    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function toSortedEntries(counts: Map<string, number>) {
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

export default function ContentIntelligenceTab() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadQuestionPool()
      .then(setQuestions)
      .catch((error) => console.error('Content intelligence load error:', error))
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const domainCounts = new Map<string, number>();
    const sectionCounts = new Map<string, number>();
    const difficultyCounts = new Map<string, number>();
    const sourceManualCounts = new Map<string, number>();
    const misconceptionCounts = new Map<string, number>();
    const objectiveCounts = new Map<string, number>();
    const domainObjectiveCounts = new Map<string, Map<string, number>>();
    let objectiveTagged = 0;
    let sourceManualTagged = 0;
    let sourceSectionTagged = 0;
    let misconceptionTagged = 0;
    let releaseVersionTagged = 0;
    let multiResponseCount = 0;

    questions.forEach((question) => {
      const domain = question.domain?.trim() || question.topic?.trim() || 'Unclassified';
      const section = getQuestionDomain(question);
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
      sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
      difficultyCounts.set(question.difficulty, (difficultyCounts.get(question.difficulty) ?? 0) + 1);

      if (question.objective?.trim()) {
        objectiveTagged += 1;
        objectiveCounts.set(question.objective, (objectiveCounts.get(question.objective) ?? 0) + 1);
        if (!domainObjectiveCounts.has(domain)) domainObjectiveCounts.set(domain, new Map<string, number>());
        const domainObjectives = domainObjectiveCounts.get(domain)!;
        domainObjectives.set(question.objective, (domainObjectives.get(question.objective) ?? 0) + 1);
      }

      if (question.sourceManual?.trim()) {
        sourceManualTagged += 1;
        sourceManualCounts.set(question.sourceManual, (sourceManualCounts.get(question.sourceManual) ?? 0) + 1);
      }
      if (question.sourceSection?.trim()) sourceSectionTagged += 1;
      if (question.misconceptionTag?.trim()) {
        misconceptionTagged += 1;
        misconceptionCounts.set(question.misconceptionTag, (misconceptionCounts.get(question.misconceptionTag) ?? 0) + 1);
      }
      if (question.releaseVersion?.trim()) releaseVersionTagged += 1;
      if (isMultiAnswerQuestion(question)) multiResponseCount += 1;
    });

    return {
      domainCounts: toSortedEntries(domainCounts),
      sectionCounts: toSortedEntries(sectionCounts),
      difficultyCounts: toSortedEntries(difficultyCounts),
      sourceManualCounts: toSortedEntries(sourceManualCounts),
      misconceptionCounts: toSortedEntries(misconceptionCounts),
      objectiveCounts: toSortedEntries(objectiveCounts),
      domainObjectiveSummaries: toSortedEntries(domainCounts).map(([domain, count]) => {
        const objectives = toSortedEntries(domainObjectiveCounts.get(domain) ?? new Map<string, number>());
        const dominantObjectiveCount = objectives[0]?.[1] ?? 0;
        return {
          domain,
          count,
          objectiveCount: objectives.length,
          dominantObjective: objectives[0]?.[0] ?? 'Unspecified objective',
          dominantObjectivePercent: count ? Math.round((dominantObjectiveCount / count) * 100) : 0,
          flags: [
            ...(count >= 80 ? ['Broad bucket'] : []),
            ...(objectives.length <= 2 ? ['Thin objective split'] : []),
            ...(count && dominantObjectiveCount / count >= 0.6 ? ['One objective dominates'] : []),
          ],
          objectives,
        };
      }),
      objectiveTagged,
      sourceManualTagged,
      sourceSectionTagged,
      misconceptionTagged,
      releaseVersionTagged,
      multiResponseCount,
    };
  }, [questions]);

  if (loading) {
    return (
      <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm h-72 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Content Intelligence</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <MetricCard label="Questions" value={questions.length} />
            <MetricCard label="Question Files" value={QUESTION_POOL_FILES.length} />
            <MetricCard label="Source Manuals" value={SOURCE_MANUALS.length} />
            <MetricCard label="Multi-Response" value={`${metrics.multiResponseCount} (${questions.length ? Math.round((metrics.multiResponseCount / questions.length) * 100) : 0}%)`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Metadata Coverage</p>
              <div className="space-y-3">
                {[
                  ['Objectives', metrics.objectiveTagged],
                  ['Source Manual', metrics.sourceManualTagged],
                  ['Source Section', metrics.sourceSectionTagged],
                  ['Misconception Tag', metrics.misconceptionTagged],
                  ['Release Version', metrics.releaseVersionTagged],
                ].map(([label, count]) => {
                  const numericCount = Number(count);
                  const percent = questions.length ? Math.round((numericCount / questions.length) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-zinc-700">{label}</span>
                        <span className={`text-xs font-semibold ${percent >= 85 ? 'text-emerald-600' : percent >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                          {numericCount}/{questions.length} ({percent}%)
                        </span>
                      </div>
                      <div className="h-2 bg-white rounded-full overflow-hidden border border-zinc-100">
                        <div className={`h-full ${percent >= 85 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Source Artifacts</p>
              <div className="space-y-2 mb-4">
                {SOURCE_MANUALS.map((manual) => (
                  <div key={manual} className="bg-white border border-zinc-100 rounded-xl px-4 py-3 text-sm font-medium text-zinc-700">
                    {manual}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Objective Tagged" value={metrics.objectiveTagged} tone={metrics.objectiveTagged >= 425 ? 'good' : 'warn'} />
                <MetricCard label="Manual Tagged" value={metrics.sourceManualTagged} tone={metrics.sourceManualTagged === 0 ? 'warn' : 'good'} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Taxonomy Freeze Flags</p>
          </div>
          <div className="p-5 space-y-3">
            {metrics.domainObjectiveSummaries.map((summary) => (
              <div key={summary.domain} className="border border-zinc-100 rounded-2xl p-4 bg-zinc-50">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{summary.domain}</p>
                    <p className="text-xs text-zinc-500">
                      {summary.count} questions | {summary.objectiveCount} objectives | dominant: {summary.dominantObjective} ({summary.dominantObjectivePercent}%)
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {summary.flags.length > 0 ? summary.flags.map((flag) => (
                      <span key={flag} className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                        {flag}
                      </span>
                    )) : (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        Stable
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {summary.objectives.slice(0, 3).map(([objective, count]) => (
                    <div key={objective} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-zinc-700">{objective}</span>
                      <span className="text-zinc-500">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Objective Density</p>
          </div>
          <div className="p-5 space-y-3">
            {metrics.objectiveCounts.slice(0, 12).map(([objective, count]) => {
              const percent = questions.length ? Math.round((count / questions.length) * 100) : 0;
              return (
                <div key={objective}>
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <span className="text-sm font-medium text-zinc-700">{objective}</span>
                    <span className="text-xs font-semibold text-zinc-500">{count} ({percent}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-fuchsia-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Section Coverage</p>
          </div>
          <div className="p-5 space-y-3">
            {metrics.sectionCounts.map(([section, count]) => {
              const percent = questions.length ? Math.round((count / questions.length) * 100) : 0;
              return (
                <div key={section}>
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <span className="text-sm font-medium text-zinc-700">{section}</span>
                    <span className="text-xs font-semibold text-zinc-500">{count} ({percent}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Domain Coverage</p>
          </div>
          <div className="p-5 space-y-3">
            {metrics.domainCounts.map(([domain, count]) => {
              const percent = questions.length ? Math.round((count / questions.length) * 100) : 0;
              return (
                <div key={domain}>
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <span className="text-sm font-medium text-zinc-700">{domain}</span>
                    <span className="text-xs font-semibold text-zinc-500">{count} ({percent}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Difficulty Coverage</p>
          </div>
          <div className="p-5 space-y-3">
            {metrics.difficultyCounts.map(([difficulty, count]) => {
              const percent = questions.length ? Math.round((count / questions.length) * 100) : 0;
              return (
                <div key={difficulty}>
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <span className="text-sm font-medium capitalize text-zinc-700">{difficulty}</span>
                    <span className="text-xs font-semibold text-zinc-500">{count} ({percent}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        difficulty === 'hard'
                          ? 'bg-red-400'
                          : difficulty === 'medium'
                            ? 'bg-amber-400'
                            : difficulty === 'easy'
                              ? 'bg-emerald-400'
                              : 'bg-zinc-400'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Source Manual Split</p>
          </div>
          <div className="p-5 space-y-3">
            {metrics.sourceManualCounts.map(([manual, count]) => {
              const percent = questions.length ? Math.round((count / questions.length) * 100) : 0;
              return (
                <div key={manual}>
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <span className="text-sm font-medium text-zinc-700">{manual}</span>
                    <span className="text-xs font-semibold text-zinc-500">{count} ({percent}%)</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Misconception Tags</p>
        </div>
        <div className="p-5 space-y-3">
          {metrics.misconceptionCounts.slice(0, 12).map(([tag, count]) => {
            const percent = questions.length ? Math.round((count / questions.length) * 100) : 0;
            return (
              <div key={tag}>
                <div className="flex items-center justify-between mb-1.5 gap-3">
                  <span className="text-sm font-medium text-zinc-700">{tag}</span>
                  <span className="text-xs font-semibold text-zinc-500">{count} ({percent}%)</span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
