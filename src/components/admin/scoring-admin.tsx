"use client";

import { useMemo, useState } from "react";
import { Button, QuietButton } from "@/components/button";
import { QuestionRenderer } from "@/components/form/question-renderer";
import { Input } from "@/components/input";
import type { RuntimeFormConfig } from "@/lib/form-config";
import { getSecondaryFormConfig } from "@/lib/secondary-scoring";
import {
  computeOverallFromForm,
  questionContribution,
  type AnswerMap,
} from "@/lib/scoring";

type Summary = {
  total: number;
  changed: number;
  maxDelta: number;
  committed: boolean;
  movers: Array<{
    filmId: number;
    title: string;
    before: number;
    after: number;
    delta: number;
  }>;
};

export function ScoringAdmin({
  initialForm,
}: {
  initialForm: RuntimeFormConfig;
}) {
  const [form, setForm] = useState(initialForm);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const primary = useMemo(() => safeCompute(form, answers), [form, answers]);
  const secondary = useMemo(
    () => safeCompute(getSecondaryFormConfig(form), answers),
    [form, answers],
  );

  async function mutate(payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/form", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
      form?: RuntimeFormConfig;
      error?: string;
    };
    if (!response.ok || !body.form)
      return setMessage(body.error ?? "Could not save scoring settings.");
    setForm(body.form);
    setMessage("Scoring draft saved.");
  }
  async function recompute(commit: boolean) {
    if (
      commit &&
      !window.confirm("Apply the published formula to all existing ratings?")
    )
      return;
    const response = await fetch("/api/admin/recompute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commit }),
    });
    const body = (await response.json()) as Summary & { error?: string };
    if (!response.ok) return setMessage(body.error ?? "Recompute failed.");
    setSummary(body);
    setMessage(
      commit ? "Recompute committed." : "Dry run complete; no ratings changed.",
    );
  }

  return (
    <div>
      <header className="page-heading">
        <p className="eyebrow">Draft scoring model</p>
        <h1>Scoring</h1>
        <p>
          Configure Overall and Secondary Score independently, then test both
          formulas before publishing.
        </p>
      </header>
      {message ? (
        <p
          role="status"
          className="panel text-paper-300 mb-5 px-4 py-3 text-sm"
        >
          {message}
        </p>
      ) : null}
      <div className="grid gap-6 2xl:grid-cols-2">
        <FormulaCard
          title="Overall"
          form={form}
          secondary={false}
          mutate={mutate}
        />
        <FormulaCard
          title="Secondary Score"
          form={form}
          secondary
          mutate={mutate}
        />
      </div>
      <section className="panel mt-6 p-5">
        <p className="eyebrow">Scoring sandbox</p>
        <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_20rem]">
          <div className="space-y-5">
            {form.questions
              .filter((q) => q.scored || q.secondaryScored)
              .map((question) => (
                <label key={question.id} className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    {question.label}
                  </span>
                  <QuestionRenderer
                    question={question}
                    value={answers[question.id]}
                    onChange={(value) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: value,
                      }))
                    }
                  />
                </label>
              ))}
          </div>
          <div className="space-y-4">
            <ScoreResult title="Overall" result={primary} form={form} />
            <ScoreResult
              title="Secondary"
              result={secondary}
              form={getSecondaryFormConfig(form)}
            />
          </div>
        </div>
      </section>
      <section className="panel mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Existing ratings</p>
            <h2 className="mt-1 text-xl font-semibold">
              Recompute published scores
            </h2>
          </div>
          <div className="flex gap-3">
            <QuietButton onClick={() => void recompute(false)}>
              Dry run
            </QuietButton>
            <Button onClick={() => void recompute(true)}>
              Commit recompute
            </Button>
          </div>
        </div>
        {summary ? (
          <div className="mt-5">
            <p className="text-paper-300 text-sm">
              {summary.changed} of {summary.total} films change · max delta{" "}
              {summary.maxDelta.toFixed(4)}
            </p>
            <div className="mt-3 space-y-1 text-sm">
              {summary.movers.map((row) => (
                <p key={row.filmId} className="flex justify-between">
                  <span>{row.title}</span>
                  <span className="text-paper-500 tabular-nums">
                    {row.before.toFixed(3)} → {row.after.toFixed(3)} (
                    {row.delta >= 0 ? "+" : ""}
                    {row.delta.toFixed(3)})
                  </span>
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function FormulaCard({
  title,
  form,
  secondary,
  mutate,
}: {
  title: string;
  form: RuntimeFormConfig;
  secondary: boolean;
  mutate: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const scored = form.questions.filter((q) =>
    secondary ? q.secondaryScored : q.scored,
  );
  const divisorMode = secondary ? form.secondaryDivisorMode : form.divisorMode;
  const manualDivisor = secondary
    ? form.secondaryManualDivisor
    : form.manualDivisor;
  const maxes = scored.map((q) => ({
    id: q.id,
    max: questionContribution(
      secondary
        ? getSecondaryFormConfig({ ...form, questions: [q] }).questions[0]!
        : q,
      {},
    ).maxPoints,
  }));
  const autoDivisor = maxes.reduce((sum, row) => sum + row.max, 0);
  const divisor = divisorMode === "auto" ? autoDivisor : (manualDivisor ?? 0);
  return (
    <section className="panel overflow-hidden">
      <header className="border-hairline border-b p-5">
        <p className="eyebrow">{title}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
          <select
            className="select-field"
            value={divisorMode}
            onChange={(event) =>
              void mutate({
                action: "update_form",
                data: secondary
                  ? { secondaryDivisorMode: event.target.value }
                  : { divisorMode: event.target.value },
              })
            }
          >
            <option value="manual">Manual divisor</option>
            <option value="auto">Auto divisor</option>
          </select>
          <Input
            type="number"
            step="any"
            value={manualDivisor ?? ""}
            disabled={divisorMode === "auto"}
            onChange={(event) =>
              void mutate({
                action: "update_form",
                data: secondary
                  ? { secondaryManualDivisor: Number(event.target.value) }
                  : { manualDivisor: Number(event.target.value) },
              })
            }
          />
          <span className="text-paper-500 self-center text-xs">
            Auto: {autoDivisor.toFixed(2)}
          </span>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-ink-850 text-paper-500 text-xs">
            <tr>
              <th className="px-4 py-3">Question</th>
              <th>Weight</th>
              <th>Offset</th>
              <th>Min / max</th>
              <th>Max points</th>
              <th>% share</th>
              <th>Blank policy</th>
            </tr>
          </thead>
          <tbody className="divide-hairline divide-y">
            {scored.map((q) => {
              const max = maxes.find(({ id }) => id === q.id)?.max ?? 0;
              return (
                <tr key={q.id}>
                  <td className="text-paper-100 px-4 py-3">{q.label}</td>
                  <td>{secondary ? q.secondaryWeight : q.weight}</td>
                  <td>{secondary ? q.secondaryOffset : q.offset}</td>
                  <td>
                    {q.min ?? "—"} / {q.max ?? "—"}
                  </td>
                  <td>{max.toFixed(2)}</td>
                  <td>
                    {divisor > 0
                      ? `${((max / divisor) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td>
                    <select
                      className="select-field h-8"
                      value={secondary ? q.secondaryBlankPolicy : q.blankPolicy}
                      onChange={(event) =>
                        void mutate({
                          action: "update_question",
                          questionId: q.id,
                          data: secondary
                            ? { secondaryBlankPolicy: event.target.value }
                            : { blankPolicy: event.target.value },
                        })
                      }
                    >
                      <option value="exclude_and_renormalize">Exclude</option>
                      <option value="treat_as_zero">Zero</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function safeCompute(
  form: Parameters<typeof computeOverallFromForm>[0],
  answers: AnswerMap,
) {
  try {
    return computeOverallFromForm(form, answers);
  } catch {
    return null;
  }
}
function ScoreResult({
  title,
  result,
  form,
}: {
  title: string;
  result: ReturnType<typeof computeOverallFromForm> | null;
  form: Parameters<typeof computeOverallFromForm>[0];
}) {
  return (
    <div className="rounded-ui border-hairline bg-ink-850 border p-4">
      <p className="eyebrow">{title}</p>
      <p className="text-accent-400 mt-2 text-3xl font-bold">
        {result ? result.overall.toFixed(3) : "—"}
      </p>
      {result ? (
        <div className="text-paper-500 mt-3 space-y-1 text-xs">
          {result.terms
            .filter(
              (term) =>
                form.questions.find((q) => q.id === term.questionId)?.scored,
            )
            .map((term) => (
              <p key={term.questionId} className="flex justify-between">
                <span>
                  {form.questions.find((q) => q.id === term.questionId)?.key}
                </span>
                <span>
                  {term.counted ? term.points.toFixed(2) : term.reason}
                </span>
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
}
