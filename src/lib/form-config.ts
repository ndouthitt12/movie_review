import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  formSections,
  formVersions,
  questionConditions,
  questionOptions,
  questions,
} from "@/db/schema";
import type { FormConfig, QuestionConfig } from "./scoring";

export type RuntimeQuestionConfig = Omit<QuestionConfig, "options" | "conditions"> & {
  label: string;
  helpText: string;
  sectionId: number | null;
  sortOrder: number;
  rcaEnabled: boolean;
  archivedAt: string | null;
  secondaryScored: boolean;
  secondaryWeight: number | null;
  secondaryOffset: number;
  secondaryBlankPolicy: QuestionConfig["blankPolicy"];
  conditions: Array<QuestionConfig["conditions"][number] & { id: number }>;
  options: Array<
    QuestionConfig["options"][number] & { label: string; sortOrder: number }
  >;
};

export type RuntimeFormConfig = Omit<FormConfig, "questions"> & {
  id: number;
  label: string;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  secondaryDivisorMode: "auto" | "manual";
  secondaryManualDivisor: number | null;
  sections: Array<{ id: number; title: string; sortOrder: number }>;
  questions: RuntimeQuestionConfig[];
};

function assembleForm(
  version: typeof formVersions.$inferSelect,
  includeArchived: boolean,
): RuntimeFormConfig {
  const sectionRows = db
    .select()
    .from(formSections)
    .where(eq(formSections.formVersionId, version.id))
    .orderBy(asc(formSections.sortOrder), asc(formSections.id))
    .all();
  const questionRows = db
    .select()
    .from(questions)
    .where(
      includeArchived
        ? eq(questions.formVersionId, version.id)
        : and(
            eq(questions.formVersionId, version.id),
            isNull(questions.archivedAt),
          ),
    )
    .orderBy(asc(questions.sortOrder), asc(questions.id))
    .all();
  const questionIds = questionRows.map(({ id }) => id);
  const optionRows = questionIds.length
    ? db
        .select()
        .from(questionOptions)
        .where(
          includeArchived
            ? inArray(questionOptions.questionId, questionIds)
            : and(
                inArray(questionOptions.questionId, questionIds),
                isNull(questionOptions.archivedAt),
              ),
        )
        .orderBy(asc(questionOptions.sortOrder), asc(questionOptions.id))
        .all()
    : [];
  const conditionRows = questionIds.length
    ? db
        .select()
        .from(questionConditions)
        .where(inArray(questionConditions.questionId, questionIds))
        .orderBy(asc(questionConditions.id))
        .all()
    : [];

  return {
    id: version.id,
    label: version.label,
    status: version.status,
    divisorMode: version.divisorMode,
    manualDivisor: version.manualDivisor,
    publishedAt: version.publishedAt,
    secondaryDivisorMode: version.secondaryDivisorMode,
    secondaryManualDivisor: version.secondaryManualDivisor,
    sections: sectionRows.map((section) => ({
      id: section.id,
      title: section.title,
      sortOrder: section.sortOrder,
    })),
    questions: questionRows.map((question) => ({
      id: question.id,
      key: question.key,
      label: question.label,
      helpText: question.helpText,
      type: question.type,
      sectionId: question.sectionId,
      sortOrder: question.sortOrder,
      required: question.required,
      scored: question.scored,
      weight: question.weight,
      secondaryScored: question.secondaryScored,
      secondaryWeight: question.secondaryWeight,
      min: question.min,
      max: question.max,
      offset: question.offset,
      secondaryOffset: question.secondaryOffset,
      blankPolicy: question.blankPolicy,
      secondaryBlankPolicy: question.secondaryBlankPolicy,
      multiSelectScoring: question.multiSelectScoring,
      allowNa: question.allowNa,
      conditionLogic: question.conditionLogic,
      rcaEnabled: question.rcaEnabled,
      archivedAt: question.archivedAt,
      conditions: conditionRows
        .filter(({ questionId }) => questionId === question.id)
        .map((condition) => ({
          id: condition.id,
          sourceQuestionId: condition.sourceQuestionId,
          operator: condition.operator,
          value: condition.value,
          effect: condition.effect,
        })),
      options: optionRows
        .filter(({ questionId }) => questionId === question.id)
        .map((option) => ({
          id: option.id,
          label: option.label,
          sortOrder: option.sortOrder,
          valueScore: option.valueScore,
          isNull: option.isNull,
        })),
    })),
  };
}

function getFormByStatus(
  status: "published" | "draft",
): RuntimeFormConfig | null {
  const version = db
    .select()
    .from(formVersions)
    .where(eq(formVersions.status, status))
    .limit(1)
    .get();
  return version ? assembleForm(version, false) : null;
}

export function getPublishedForm(): Promise<FormConfig | null> {
  return Promise.resolve(getFormByStatus("published"));
}

export function getDraftForm(): Promise<FormConfig | null> {
  return Promise.resolve(getFormByStatus("draft"));
}

export function getPublishedRuntimeForm() {
  return getFormByStatus("published");
}

export function getDraftRuntimeForm() {
  return getFormByStatus("draft");
}

export function getFormVersionConfig(versionId: number) {
  const version = db
    .select()
    .from(formVersions)
    .where(eq(formVersions.id, versionId))
    .get();
  return version ? assembleForm(version, true) : null;
}
