"use client";

import { useRef, useState } from "react";
import { Button, QuietButton } from "@/components/button";
import { Input } from "@/components/input";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
} from "@/components/ui/icons";
import type {
  RuntimeFormConfig,
  RuntimeQuestionConfig,
} from "@/lib/form-config";
import {
  answerTypes,
  displayTypes,
  isDisplayType,
  typeLabels,
} from "./constants";
import type { Mutate } from "./use-form-draft";

type MovedQuestion = { questionId: number; sectionId: number | null };
const questionDragType = "application/x-form-builder-question";
const sectionDragType = "application/x-form-builder-section";

export function Outline({
  form,
  selectedId,
  onSelect,
  onAddQuestion,
  onReorderQuestions,
  onReorderSections,
  onArchiveQuestion,
  mutate,
}: {
  form: RuntimeFormConfig;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAddQuestion: (data: {
    key: string;
    label: string;
    type: RuntimeQuestionConfig["type"];
    sectionId: number | null;
  }) => Promise<boolean>;
  onReorderQuestions: (
    orderedIds: number[],
    moved: MovedQuestion,
  ) => Promise<void>;
  onReorderSections: (orderedIds: number[]) => Promise<void>;
  onArchiveQuestion: (id: number) => void;
  mutate: Mutate;
}) {
  const [draggedQuestion, setDraggedQuestion] = useState<number | null>(null);
  const [draggedSection, setDraggedSection] = useState<number | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const draggedQuestionRef = useRef<number | null>(null);
  const draggedSectionRef = useRef<number | null>(null);
  const sections = [...form.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const questions = [...form.questions].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const unsectioned = questions.filter(({ sectionId }) => sectionId == null);

  function visualQuestionIds() {
    return [
      ...sections.flatMap((section) =>
        questions
          .filter(({ sectionId }) => sectionId === section.id)
          .map(({ id }) => id),
      ),
      ...unsectioned.map(({ id }) => id),
    ];
  }

  async function dropQuestion(
    sectionId: number | null,
    beforeId: number | null,
  ) {
    const questionId = draggedQuestionRef.current;
    if (questionId == null) return;
    const ordered: number[] = [];
    for (const groupId of [...sections.map(({ id }) => id), null]) {
      const group = questions
        .filter(
          (question) =>
            question.id !== questionId && question.sectionId === groupId,
        )
        .map(({ id }) => id);
      if (groupId === sectionId) {
        if (beforeId == null) group.push(questionId);
        else group.splice(Math.max(0, group.indexOf(beforeId)), 0, questionId);
      }
      ordered.push(...group);
    }
    await onReorderQuestions(ordered, {
      questionId,
      sectionId,
    });
    if (draggedQuestionRef.current === questionId) {
      draggedQuestionRef.current = null;
      setDraggedQuestion(null);
      setDropKey(null);
    }
  }

  async function moveQuestion(questionId: number, direction: -1 | 1) {
    const ordered = visualQuestionIds();
    const index = ordered.indexOf(questionId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const target = form.questions.find(({ id }) => id === ordered[targetIndex]);
    [ordered[index], ordered[targetIndex]] = [
      ordered[targetIndex]!,
      ordered[index]!,
    ];
    await onReorderQuestions(ordered, {
      questionId,
      sectionId: target?.sectionId ?? null,
    });
  }

  async function dropSection(beforeId: number | null) {
    const sectionId = draggedSectionRef.current;
    if (sectionId == null) return;
    const ordered = sections
      .map(({ id }) => id)
      .filter((id) => id !== sectionId);
    if (beforeId == null) ordered.push(sectionId);
    else ordered.splice(Math.max(0, ordered.indexOf(beforeId)), 0, sectionId);
    await onReorderSections(ordered);
    if (draggedSectionRef.current === sectionId) {
      draggedSectionRef.current = null;
      setDraggedSection(null);
      setDropKey(null);
    }
  }

  async function moveSection(sectionId: number, direction: -1 | 1) {
    const ordered = sections.map(({ id }) => id);
    const index = ordered.indexOf(sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
    await onReorderSections(ordered);
  }

  return (
    <aside className="panel min-w-0 overflow-hidden xl:sticky xl:top-6">
      <header className="border-hairline border-b px-4 py-4">
        <p className="eyebrow">Form outline</p>
        <p className="text-paper-500 mt-1 text-xs">
          Select a row to edit. Drag by the handle to reorder.
        </p>
      </header>

      <div>
        {sections.map((section) => {
          const scoped = questions.filter(
            ({ sectionId }) => sectionId === section.id,
          );
          return (
            <div key={section.id}>
              <DropLine
                active={dropKey === `section-${section.id}`}
                onOver={() => {
                  if (draggedSection != null)
                    setDropKey(`section-${section.id}`);
                }}
                onDrop={() => void dropSection(section.id)}
              />
              <SectionHeader
                section={section}
                mutate={mutate}
                onDragStart={() => {
                  draggedSectionRef.current = section.id;
                  setDraggedSection(section.id);
                }}
                onDragEnd={() => {
                  draggedSectionRef.current = null;
                  setDraggedSection(null);
                  setDropKey(null);
                }}
                onMove={(direction) => void moveSection(section.id, direction)}
              />
              <QuestionRows
                questions={scoped}
                sectionId={section.id}
                selectedId={selectedId}
                dropKey={dropKey}
                dragging={draggedQuestion != null}
                onSelect={onSelect}
                onDragStart={(id) => {
                  draggedQuestionRef.current = id;
                  setDraggedQuestion(id);
                }}
                onDragEnd={() => {
                  draggedQuestionRef.current = null;
                  setDraggedQuestion(null);
                  setDropKey(null);
                }}
                onDropKey={setDropKey}
                onDrop={(beforeId) => void dropQuestion(section.id, beforeId)}
                onMove={(id, direction) => void moveQuestion(id, direction)}
                onArchive={onArchiveQuestion}
                visualOrder={visualQuestionIds()}
              />
              <AddQuestionRow
                sectionId={section.id}
                existingKeys={form.questions.map(({ key }) => key)}
                onAdd={onAddQuestion}
              />
            </div>
          );
        })}

        {unsectioned.length ? (
          <div>
            <div className="border-hairline bg-ink-850 border-y px-4 py-3">
              <h3 className="text-paper-300 text-xs font-semibold tracking-wide uppercase">
                Unsectioned
              </h3>
            </div>
            <QuestionRows
              questions={unsectioned}
              sectionId={null}
              selectedId={selectedId}
              dropKey={dropKey}
              dragging={draggedQuestion != null}
              onSelect={onSelect}
              onDragStart={(id) => {
                draggedQuestionRef.current = id;
                setDraggedQuestion(id);
              }}
              onDragEnd={() => {
                draggedQuestionRef.current = null;
                setDraggedQuestion(null);
                setDropKey(null);
              }}
              onDropKey={setDropKey}
              onDrop={(beforeId) => void dropQuestion(null, beforeId)}
              onMove={(id, direction) => void moveQuestion(id, direction)}
              onArchive={onArchiveQuestion}
              visualOrder={visualQuestionIds()}
            />
            <AddQuestionRow
              sectionId={null}
              existingKeys={form.questions.map(({ key }) => key)}
              onAdd={onAddQuestion}
            />
          </div>
        ) : null}

        <DropLine
          active={dropKey === "section-end"}
          onOver={() => {
            if (draggedSection != null) setDropKey("section-end");
          }}
          onDrop={() => void dropSection(null)}
        />
      </div>

      <AddSection mutate={mutate} />
    </aside>
  );
}

function SectionHeader({
  section,
  mutate,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  section: RuntimeFormConfig["sections"][number];
  mutate: Mutate;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(section.title);

  async function save() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(section.title);
      setEditing(false);
      return;
    }
    if (trimmed !== section.title)
      await mutate({
        action: "update_section",
        sectionId: section.id,
        data: { title: trimmed },
      });
    setEditing(false);
  }

  return (
    <header className="border-hairline bg-ink-850 flex items-center gap-2 border-b px-3 py-2.5">
      <DragHandle
        label={`Reorder section ${section.title}`}
        dragType={sectionDragType}
        dragId={section.id}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onMove={onMove}
      />
      {editing ? (
        <Input
          autoFocus
          aria-label={`Rename section ${section.title}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void save()}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
            if (event.key === "Escape") {
              setTitle(section.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="text-paper-100 min-w-0 flex-1 truncate text-left text-xs font-bold tracking-wide uppercase"
          onClick={() => setEditing(true)}
        >
          {section.title}
        </button>
      )}
      <details className="relative">
        <summary
          className="text-paper-500 hover:text-paper-100 cursor-pointer list-none px-2 py-1 text-lg"
          aria-label={`Actions for ${section.title}`}
        >
          ⋯
        </summary>
        <div className="rounded-ui border-hairline bg-ink-900 absolute top-full right-0 z-20 w-32 border p-1 shadow-xl">
          <button
            type="button"
            className="hover:bg-ink-850 w-full px-2 py-2 text-left text-xs"
            onClick={() => setEditing(true)}
          >
            Rename
          </button>
          <button
            type="button"
            className="w-full px-2 py-2 text-left text-xs text-red-300 hover:bg-red-950/50"
            onClick={() => {
              if (
                window.confirm(
                  `Archive “${section.title}”? Its questions will move to Unsectioned.`,
                )
              )
                void mutate({
                  action: "archive_section",
                  sectionId: section.id,
                });
            }}
          >
            Archive
          </button>
        </div>
      </details>
    </header>
  );
}

function QuestionRows({
  questions,
  sectionId,
  selectedId,
  dropKey,
  dragging,
  onSelect,
  onDragStart,
  onDragEnd,
  onDropKey,
  onDrop,
  onMove,
  onArchive,
  visualOrder,
}: {
  questions: RuntimeQuestionConfig[];
  sectionId: number | null;
  selectedId: number | null;
  dropKey: string | null;
  dragging: boolean;
  onSelect: (id: number) => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onDropKey: (key: string | null) => void;
  onDrop: (beforeId: number | null) => void;
  onMove: (id: number, direction: -1 | 1) => void;
  onArchive: (id: number) => void;
  visualOrder: number[];
}) {
  return (
    <div>
      {questions.map((question, index) => {
        const afterId = questions[index + 1]?.id ?? null;
        const visualIndex = visualOrder.indexOf(question.id);
        const beforeIdForPointer = (clientY: number, element: HTMLElement) => {
          const bounds = element.getBoundingClientRect();
          return clientY < bounds.top + bounds.height / 2
            ? question.id
            : afterId;
        };
        const showDropPosition = (beforeId: number | null) =>
          onDropKey(
            beforeId == null
              ? `question-end-${sectionId ?? "none"}`
              : `question-${beforeId}`,
          );

        return (
          <div key={question.id}>
            <DropLine
              active={dropKey === `question-${question.id}`}
              onOver={() => {
                if (dragging) onDropKey(`question-${question.id}`);
              }}
              onDrop={() => onDrop(question.id)}
            />
            <div
              className={`border-hairline flex items-center gap-2 border-b px-3 py-2 transition-colors ${
                selectedId === question.id
                  ? "bg-accent-400/10 shadow-[inset_3px_0_0_var(--color-accent-400)]"
                  : "hover:bg-ink-850"
              }`}
              onDragOver={(event) => {
                if (
                  !dragging ||
                  !event.dataTransfer.types.includes(questionDragType)
                )
                  return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                showDropPosition(
                  beforeIdForPointer(event.clientY, event.currentTarget),
                );
              }}
              onDrop={(event) => {
                if (!event.dataTransfer.types.includes(questionDragType))
                  return;
                event.preventDefault();
                onDrop(beforeIdForPointer(event.clientY, event.currentTarget));
              }}
            >
              <DragHandle
                label={`Reorder ${question.label}`}
                dragType={questionDragType}
                dragId={question.id}
                onDragStart={() => onDragStart(question.id)}
                onDragEnd={onDragEnd}
                onMove={(direction) => onMove(question.id, direction)}
              />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onSelect(question.id)}
              >
                <span
                  className={`text-paper-100 block truncate text-sm ${isDisplayType(question.type) ? "italic" : ""}`}
                >
                  {question.type === "divider" ? "Divider" : question.label}
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="rounded-ui border-hairline text-paper-500 border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase">
                    {typeLabels[question.type]}
                  </span>
                  <Indicators question={question} />
                </span>
              </button>
              <div className="ml-1 flex shrink-0 items-center gap-0.5">
                <OutlineAction
                  label={`Move ${question.label} up`}
                  disabled={visualIndex <= 0}
                  onClick={() => onMove(question.id, -1)}
                >
                  <ChevronUpIcon className="h-4 w-4" />
                </OutlineAction>
                <OutlineAction
                  label={`Move ${question.label} down`}
                  disabled={
                    visualIndex < 0 || visualIndex === visualOrder.length - 1
                  }
                  onClick={() => onMove(question.id, 1)}
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </OutlineAction>
                <OutlineAction
                  label={`Archive ${question.label}`}
                  danger
                  onClick={() => onArchive(question.id)}
                >
                  <TrashIcon className="h-4 w-4" />
                </OutlineAction>
              </div>
            </div>
          </div>
        );
      })}
      <DropLine
        active={dropKey === `question-end-${sectionId ?? "none"}`}
        onOver={() => {
          if (dragging) onDropKey(`question-end-${sectionId ?? "none"}`);
        }}
        onDrop={() => onDrop(null)}
      />
    </div>
  );
}

function OutlineAction({
  label,
  disabled = false,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`rounded-ui inline-flex h-7 w-7 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
        danger
          ? "text-paper-500 hover:bg-red-950/50 hover:text-red-300"
          : "text-paper-500 hover:bg-ink-800 hover:text-paper-100"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Indicators({ question }: { question: RuntimeQuestionConfig }) {
  const items = [
    question.conditions.length ? ["Conditional", "bg-sky"] : null,
    question.rcaEnabled ? ["RCA enabled", "bg-positive"] : null,
    question.scored || question.secondaryScored
      ? ["Scored", "bg-accent-400"]
      : null,
  ].filter(Boolean) as string[][];
  return (
    <span className="flex gap-1.5">
      {items.map(([label, color]) => (
        <span
          key={label}
          title={label}
          aria-label={label}
          className={`h-1.5 w-1.5 rounded-full ${color}`}
        />
      ))}
    </span>
  );
}

function DragHandle({
  label,
  dragType,
  dragId,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  label: string;
  dragType: string;
  dragId: number;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <button
      type="button"
      draggable
      aria-label={label}
      title={`${label}. Use arrow keys for keyboard reordering.`}
      className="text-paper-500 hover:text-paper-100 cursor-grab touch-none px-1 py-2 text-base active:cursor-grabbing"
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(dragType, String(dragId));
        event.dataTransfer.setData("text/plain", String(dragId));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onMove(-1);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onMove(1);
        }
      }}
    >
      ⠿
    </button>
  );
}

function DropLine({
  active,
  onOver,
  onDrop,
}: {
  active: boolean;
  onOver: () => void;
  onDrop: () => void;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative h-1 ${active ? "bg-accent-400" : "bg-transparent"}`}
      onDragEnter={(event) => {
        event.preventDefault();
        onOver();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    />
  );
}

function AddQuestionRow({
  sectionId,
  existingKeys,
  onAdd,
}: {
  sectionId: number | null;
  existingKeys: string[];
  onAdd: (data: {
    key: string;
    label: string;
    type: RuntimeQuestionConfig["type"];
    sectionId: number | null;
  }) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<RuntimeQuestionConfig["type"]>("short_text");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const base =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/^[^a-z]+/, "q_") || "element";
    let key = base;
    let suffix = 2;
    while (existingKeys.includes(key)) key = `${base}_${suffix++}`;
    if (await onAdd({ key, label, type, sectionId })) {
      setLabel("");
      setType("short_text");
      setOpen(false);
    }
  }

  return open ? (
    <form
      onSubmit={add}
      className="border-hairline bg-ink-850 grid gap-2 border-b p-3"
    >
      <Input
        autoFocus
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder={
          type === "divider" ? "Divider label (builder only)" : "Title"
        }
        required
      />
      <select
        aria-label="Question type"
        className="select-field"
        value={type}
        onChange={(event) =>
          setType(event.target.value as RuntimeQuestionConfig["type"])
        }
      >
        <optgroup label="Answer fields">
          {answerTypes.map((value) => (
            <option key={value} value={value}>
              {typeLabels[value]}
            </option>
          ))}
        </optgroup>
        <optgroup label="Layout">
          {displayTypes.map((value) => (
            <option key={value} value={value}>
              {typeLabels[value]}
            </option>
          ))}
        </optgroup>
      </select>
      <div className="flex gap-2">
        <Button type="submit">Add</Button>
        <QuietButton type="button" onClick={() => setOpen(false)}>
          Cancel
        </QuietButton>
      </div>
    </form>
  ) : (
    <button
      type="button"
      className="text-paper-500 hover:bg-ink-850 hover:text-accent-400 border-hairline w-full border-b px-4 py-2.5 text-left text-xs"
      onClick={() => setOpen(true)}
    >
      + Add question
    </button>
  );
}

function AddSection({ mutate }: { mutate: Mutate }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  if (!open)
    return (
      <button
        type="button"
        className="text-accent-400 hover:bg-ink-850 w-full px-4 py-3 text-left text-xs font-semibold"
        onClick={() => setOpen(true)}
      >
        + Add section
      </button>
    );
  return (
    <form
      className="border-hairline bg-ink-850 grid gap-2 border-t p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const next = await mutate({
          action: "add_section",
          data: { title },
        });
        if (next) {
          setTitle("");
          setOpen(false);
        }
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Section title"
        required
      />
      <div className="flex gap-2">
        <Button type="submit">Add</Button>
        <QuietButton type="button" onClick={() => setOpen(false)}>
          Cancel
        </QuietButton>
      </div>
    </form>
  );
}
