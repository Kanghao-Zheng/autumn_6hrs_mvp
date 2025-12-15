import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

type Step = {
  text: string;
  status: "done" | "active" | "pending";
};

function extractSteps(content: string): string[] {
  const lines = content
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  const steps: string[] = [];
  for (const line of lines) {
    const stepMatch = /^STEP\s*:\s*(.+)$/i.exec(line);
    if (stepMatch) {
      steps.push(stepMatch[1]!.trim());
      continue;
    }

    const bulletMatch = /^[-*]\s+(.+)$/.exec(line);
    if (bulletMatch) {
      steps.push(bulletMatch[1]!.trim());
    }
  }

  return steps;
}

function buildChecklist(steps: string[], isStreaming: boolean): Step[] {
  if (steps.length === 0) return [];

  const lastIndex = steps.length - 1;
  return steps.map((text, idx) => {
    if (!isStreaming) return { text, status: "done" };
    if (idx < lastIndex) return { text, status: "done" };
    return { text, status: "active" };
  });
}

export function ThinkingBlock({ content, isStreaming = false }: ThinkingBlockProps) {
  const extractedSteps = extractSteps(content);
  const checklist = buildChecklist(extractedSteps, isStreaming);
  const hasChecklist = checklist.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {isStreaming ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Autumn Working...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Analysis Complete
          </>
        )}
      </div>

      {hasChecklist ? (
        <div className="mt-3 space-y-2">
          {checklist.map((step, idx) => {
            const icon =
              step.status === "done" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              ) : step.status === "active" ? (
                <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-slate-500" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 text-slate-300" />
              );

            const textClass =
              step.status === "done"
                ? "text-slate-700"
                : step.status === "active"
                  ? "text-slate-800"
                  : "text-slate-400";

            return (
              <div key={`${step.text}-${idx}`} className="flex gap-2">
                {icon}
                <div className={`text-sm ${textClass}`}>{step.text}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
          {content}
        </div>
      )}
    </div>
  );
}

