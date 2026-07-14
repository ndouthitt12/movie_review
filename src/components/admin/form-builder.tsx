"use client";

import { useMemo, useState } from "react";
import { Button, QuietButton } from "@/components/button";
import { QuestionRenderer } from "@/components/form/question-renderer";
import { Input } from "@/components/input";
import type { RuntimeFormConfig, RuntimeQuestionConfig } from "@/lib/form-config";
import { evaluateFormConditions, type AnswerMap } from "@/lib/scoring";

const inputTypes = ["slider", "short_text", "paragraph", "dropdown", "multi_select", "multiple_choice", "integer"] as const;
const optionTypes = new Set(["dropdown", "multi_select", "multiple_choice"]);

type BuilderProps = { initialForm: RuntimeFormConfig };

export function FormBuilder({ initialForm }: BuilderProps) {
  const [form, setForm] = useState(initialForm);
  const [selectedId, setSelectedId] = useState(initialForm.questions[0]?.id ?? null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [message, setMessage] = useState("");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const states = useMemo(() => evaluateFormConditions(form, answers), [form, answers]);
  const selected = form.questions.find(({ id }) => id === selectedId) ?? null;

  async function mutate(payload: Record<string, unknown>) {
    setMessage("");
    const response = await fetch("/api/admin/form", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { form?: RuntimeFormConfig; error?: string };
    if (!response.ok || !body.form) {
      setMessage(body.error ?? "Could not update the draft.");
      return false;
    }
    setForm(body.form);
    setMessage("Draft saved.");
    return true;
  }

  async function publish() {
    const response = await fetch("/api/admin/form/publish", { method: "POST" });
    const body = (await response.json()) as { error?: string; errors?: string[] };
    setMessage(response.ok ? "Draft published. A fresh draft will be created on the next edit." : (body.errors?.join(" ") ?? body.error ?? "Publish failed."));
  }

  async function dropBefore(targetId: number) {
    if (draggedId == null || draggedId === targetId) return;
    const ids = form.questions.map(({ id }) => id).filter((id) => id !== draggedId);
    ids.splice(ids.indexOf(targetId), 0, draggedId);
    await mutate({ action: "reorder", orderedIds: ids });
    setDraggedId(null);
  }

  return (
    <div>
      <header className="page-heading flex max-w-none flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Draft form · version {form.id}</p>
          <h1>Form Builder</h1>
          <p>Build the next rating form without changing historical ratings.</p>
        </div>
        <Button onClick={() => void publish()}>Publish draft</Button>
      </header>
      {message ? <p role="status" className="panel mb-5 px-4 py-3 text-sm text-paper-300">{message}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(28rem,1fr)_minmax(25rem,1fr)]">
        <section className="space-y-5">
          <AddQuestion sections={form.sections} onAdd={mutate} />
          {form.sections.map((section) => {
            const sectionQuestions = form.questions.filter(({ sectionId }) => sectionId === section.id);
            return (
              <div key={section.id} className="panel overflow-hidden">
                <header className="border-b border-hairline bg-ink-850 px-4 py-3">
                  <h2 className="font-semibold text-paper-100">{section.title}</h2>
                </header>
                <div className="divide-y divide-hairline">
                  {sectionQuestions.map((question) => (
                    <button
                      key={question.id}
                      type="button"
                      draggable
                      onDragStart={() => setDraggedId(question.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => void dropBefore(question.id)}
                      onClick={() => setSelectedId(question.id)}
                      className={`block w-full px-4 py-4 text-left hover:bg-ink-850 ${selectedId === question.id ? "bg-ink-850" : ""}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="font-medium text-paper-100">{question.label}</span>
                        <span className="text-xs text-paper-500">Drag to reorder</span>
                      </span>
                      <span className="mt-2 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-wide text-paper-500">
                        <Badge>{question.type}</Badge>
                        {question.required ? <Badge>required</Badge> : null}
                        {question.scored ? <Badge>overall · {question.weight ?? "no weight"}</Badge> : null}
                        {question.secondaryScored ? <Badge>secondary · {question.secondaryWeight ?? "no weight"}</Badge> : null}
                        {question.conditions.length ? <Badge>conditional</Badge> : null}
                        {question.rcaEnabled ? <Badge>RCA</Badge> : null}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {form.questions.some(({ sectionId }) => sectionId == null) ? (
            <div className="panel divide-y divide-hairline">
              {form.questions.filter(({ sectionId }) => sectionId == null).map((question) => (
                <button key={question.id} type="button" onClick={() => setSelectedId(question.id)} className="block w-full px-4 py-3 text-left">{question.label}</button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="space-y-6">
          {selected ? <QuestionEditor key={selected.id} question={selected} form={form} mutate={mutate} /> : null}
          <div className="panel p-5">
            <p className="eyebrow">Live preview</p>
            <div className="mt-5 space-y-5">
              {form.questions.map((question) => {
                const state = states[question.id] ?? { visible: true, enabled: true };
                if (!state.visible) return null;
                return (
                  <label key={question.id} className={`block ${state.enabled ? "" : "opacity-45"}`}>
                    <span className="mb-2 block text-sm font-semibold text-paper-100">{question.label}{question.required ? " *" : ""}</span>
                    <QuestionRenderer question={question} value={answers[question.id]} disabled={!state.enabled} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />
                  </label>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-ui border border-hairline px-2 py-1">{children}</span>;
}

function AddQuestion({ sections, onAdd }: { sections: RuntimeFormConfig["sections"]; onAdd: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<(typeof inputTypes)[number]>("slider");
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? 0);
  async function add(event: React.FormEvent) {
    event.preventDefault();
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "q_");
    if (await onAdd({ action: "add_question", data: { key, label, type, sectionId: sectionId || null } })) setLabel("");
  }
  return (
    <form onSubmit={add} className="panel grid gap-3 p-4 sm:grid-cols-[1fr_10rem_10rem_auto]">
      <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="New question label" required />
      <select className="select-field" value={type} onChange={(event) => setType(event.target.value as typeof type)}>{inputTypes.map((value) => <option key={value}>{value}</option>)}</select>
      <select className="select-field" value={sectionId} onChange={(event) => setSectionId(Number(event.target.value))}>{sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select>
      <Button type="submit">Add</Button>
    </form>
  );
}

function QuestionEditor({ question, form, mutate }: { question: RuntimeQuestionConfig; form: RuntimeFormConfig; mutate: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [draft, setDraft] = useState(question);
  const [optionLabel, setOptionLabel] = useState("");
  const [optionScore, setOptionScore] = useState("0");
  const [optionNull, setOptionNull] = useState(false);
  const possibleSources = form.questions.filter((candidate) => candidate.sortOrder < question.sortOrder);
  const [sourceId, setSourceId] = useState(possibleSources[0]?.id ?? 0);
  const source = form.questions.find(({ id }) => id === sourceId);
  const [conditionValue, setConditionValue] = useState<number | null>(source?.options[0]?.id ?? null);

  function set<K extends keyof RuntimeQuestionConfig>(key: K, value: RuntimeQuestionConfig[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const data: Record<string, unknown> = { ...draft };
    for (const key of ["id", "options", "conditions", "sortOrder", "archivedAt"]) delete data[key];
    await mutate({ action: "update_question", questionId: question.id, data });
  }
  async function addOption(event: React.FormEvent) {
    event.preventDefault();
    if (await mutate({ action: "save_option", questionId: question.id, data: { label: optionLabel, valueScore: optionNull ? null : Number(optionScore), isNull: optionNull, sortOrder: question.options.length * 10 + 10 } })) setOptionLabel("");
  }
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-3"><p className="eyebrow">Question editor</p><QuietButton type="button" onClick={() => void mutate({ action: "archive_question", questionId: question.id })}>Archive</QuietButton></div>
      <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Label"><Input value={draft.label} onChange={(event) => set("label", event.target.value)} /></Field>
        <Field label="Stable key"><Input value={draft.key} onChange={(event) => set("key", event.target.value)} /></Field>
        <Field label="Help text" wide><Input value={draft.helpText} onChange={(event) => set("helpText", event.target.value)} /></Field>
        <Field label="Type"><select className="select-field" value={draft.type} onChange={(event) => set("type", event.target.value as RuntimeQuestionConfig["type"])}>{inputTypes.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Section"><select className="select-field" value={draft.sectionId ?? ""} onChange={(event) => set("sectionId", event.target.value ? Number(event.target.value) : null)}>{form.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></Field>
        <NumberField label="Minimum" value={draft.min} onChange={(value) => set("min", value)} />
        <NumberField label="Maximum" value={draft.max} onChange={(value) => set("max", value)} />
        <NumberField label="Overall weight" value={draft.weight} onChange={(value) => set("weight", value)} />
        <NumberField label="Overall offset" value={draft.offset} onChange={(value) => set("offset", value ?? 0)} />
        <NumberField label="Secondary weight" value={draft.secondaryWeight} onChange={(value) => set("secondaryWeight", value)} />
        <NumberField label="Secondary offset" value={draft.secondaryOffset} onChange={(value) => set("secondaryOffset", value ?? 0)} />
        <Field label="Overall blank policy"><select className="select-field" value={draft.blankPolicy} onChange={(event) => set("blankPolicy", event.target.value as RuntimeQuestionConfig["blankPolicy"])}><option value="exclude_and_renormalize">Exclude + renormalize</option><option value="treat_as_zero">Treat as zero</option></select></Field>
        <Field label="Secondary blank policy"><select className="select-field" value={draft.secondaryBlankPolicy} onChange={(event) => set("secondaryBlankPolicy", event.target.value as RuntimeQuestionConfig["blankPolicy"])}><option value="exclude_and_renormalize">Exclude + renormalize</option><option value="treat_as_zero">Treat as zero</option></select></Field>
        {draft.type === "multi_select" ? <Field label="Multi-select scoring"><select className="select-field" value={draft.multiSelectScoring ?? "avg"} onChange={(event) => set("multiSelectScoring", event.target.value as "sum" | "avg")}><option value="avg">Average</option><option value="sum">Sum</option></select></Field> : null}
        <div className="flex flex-wrap gap-4 text-sm text-paper-300 sm:col-span-2">
          <Check label="Required" checked={draft.required} onChange={(value) => set("required", value)} />
          <Check label="Overall scored" checked={draft.scored} onChange={(value) => set("scored", value)} />
          <Check label="Secondary scored" checked={draft.secondaryScored} onChange={(value) => set("secondaryScored", value)} />
          <Check label="Allow N/A" checked={draft.allowNa} onChange={(value) => set("allowNa", value)} />
          <Check label="RCA enabled" checked={draft.rcaEnabled} onChange={(value) => set("rcaEnabled", value)} />
        </div>
        <Button type="submit" className="sm:col-span-2">Save question</Button>
      </form>

      {optionTypes.has(question.type) ? (
        <div className="mt-7 border-t border-hairline pt-5">
          <p className="eyebrow">Options</p>
          <div className="mt-3 space-y-2">{question.options.map((option) => <OptionEditorRow key={option.id} questionId={question.id} option={option} mutate={mutate} />)}</div>
          <form onSubmit={addOption} className="mt-3 grid gap-2 sm:grid-cols-[1fr_7rem_auto_auto]">
            <Input value={optionLabel} onChange={(event) => setOptionLabel(event.target.value)} placeholder="Option label" required />
            {optionNull ? <span className="flex items-center text-xs text-paper-500">N/A — not counted</span> : <Input aria-label="Option score" type="number" step="any" value={optionScore} onChange={(event) => setOptionScore(event.target.value)} />}
            <Check label="Null response" checked={optionNull} onChange={setOptionNull} />
            <QuietButton type="submit">Add option</QuietButton>
          </form>
        </div>
      ) : null}

      <div className="mt-7 border-t border-hairline pt-5">
        <p className="eyebrow">Conditions · {question.conditionLogic}</p>
        {question.conditions.map((condition) => <div key={condition.id} className="mt-2 flex justify-between gap-3 text-sm text-paper-300"><span>{condition.effect} when question {condition.sourceQuestionId} {condition.operator} {String(condition.value)}</span><button type="button" className="link-button" onClick={() => void mutate({ action: "delete_condition", conditionId: condition.id })}>Remove</button></div>)}
        {possibleSources.length ? <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
          <select className="select-field" value={sourceId} onChange={(event) => { const id = Number(event.target.value); setSourceId(id); setConditionValue(form.questions.find((q) => q.id === id)?.options[0]?.id ?? null); }}>{possibleSources.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select>
          {source?.options.length ? <select className="select-field" value={conditionValue ?? ""} onChange={(event) => setConditionValue(Number(event.target.value))}>{source.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : <Input type="number" placeholder="Value" onChange={(event) => setConditionValue(Number(event.target.value))} />}
          <select id={`condition-effect-${question.id}`} className="select-field"><option value="show">Show</option><option value="disable">Disable</option></select>
          <QuietButton type="button" onClick={() => void mutate({ action: "add_condition", questionId: question.id, data: { sourceQuestionId: sourceId, operator: "equals", value: conditionValue, effect: (document.getElementById(`condition-effect-${question.id}`) as HTMLSelectElement)?.value ?? "show" } })}>Add</QuietButton>
        </div> : <p className="mt-2 text-sm text-paper-500">Move another question before this one to use it as a condition source.</p>}
      </div>
    </div>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`text-xs text-paper-500 ${wide ? "sm:col-span-2" : ""}`}>{label}<span className="mt-1 block">{children}</span></label>; }
function NumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) { return <Field label={label}><Input type="number" step="any" value={value ?? ""} onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))} /></Field>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 text-xs text-paper-300"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }

function OptionEditorRow({ questionId, option, mutate }: { questionId: number; option: RuntimeQuestionConfig["options"][number]; mutate: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [label, setLabel] = useState(option.label);
  const [score, setScore] = useState(option.valueScore == null ? "" : String(option.valueScore));
  const [isNull, setIsNull] = useState(option.isNull);
  return <div className="grid items-center gap-2 sm:grid-cols-[1fr_7rem_auto_auto_auto]">
    <Input aria-label={`Label for ${option.label}`} value={label} onChange={(event) => setLabel(event.target.value)} />
    {isNull ? <Badge>N/A — not counted</Badge> : <Input aria-label={`Score for ${option.label}`} type="number" step="any" value={score} onChange={(event) => setScore(event.target.value)} />}
    <Check label="Null" checked={isNull} onChange={(value) => { setIsNull(value); if (value) setScore(""); }} />
    <QuietButton type="button" onClick={() => void mutate({ action: "save_option", questionId, optionId: option.id, data: { label, valueScore: isNull || score === "" ? null : Number(score), isNull, sortOrder: option.sortOrder } })}>Save</QuietButton>
    <button className="link-button" type="button" onClick={() => void mutate({ action: "archive_option", optionId: option.id })}>Archive</button>
  </div>;
}
