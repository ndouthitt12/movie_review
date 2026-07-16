import type { BlankPolicy, ConditionOperator, QuestionType } from "@/db/schema";

export const scoreAttributes = [
  "story",
  "direction",
  "writing",
  "acting",
  "music",
  "impact",
  "rewatchability",
  "genreFit",
] as const;

export type ScoreAttribute = (typeof scoreAttributes)[number];
export type AttributeScores = Record<ScoreAttribute, number>;

export type RatingWeights = Record<ScoreAttribute, number> & {
  rewatchabilityOffset: number;
  divisor: number;
};

function assertFinite(values: Record<string, number>) {
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isFinite(value))
      throw new TypeError(`${name} must be a finite number`);
  }
}

export function computeOverall(
  scores: AttributeScores,
  weights: RatingWeights,
): number {
  assertFinite(scores);
  assertFinite(weights);
  if (weights.divisor <= 0)
    throw new RangeError("divisor must be greater than zero");

  const numerator =
    scores.story * weights.story +
    scores.direction * weights.direction +
    scores.writing * weights.writing +
    scores.acting * weights.acting +
    scores.music * weights.music +
    scores.impact * weights.impact +
    (scores.rewatchability + weights.rewatchabilityOffset) *
      weights.rewatchability +
    scores.genreFit * weights.genreFit;

  return Math.max(0, numerator / weights.divisor);
}

export function computeSecondary(
  quality: number,
  rewatchability: number,
  genreFit: number,
): number {
  assertFinite({ quality, rewatchability, genreFit });
  return (quality * 5 + rewatchability * 4 + genreFit) / 100;
}

export type QuestionConfig = {
  id: number;
  key: string;
  type: QuestionType;
  required: boolean;
  scored: boolean;
  weight: number | null;
  min: number | null;
  max: number | null;
  offset: number;
  blankPolicy: BlankPolicy;
  multiSelectScoring: "sum" | "avg" | null;
  allowNa: boolean;
  conditionLogic: "all" | "any";
  conditions: Array<{
    sourceQuestionId: number;
    operator: ConditionOperator;
    value: number | number[] | null;
    effect: "show" | "disable";
  }>;
  options: Array<{ id: number; valueScore: number | null; isNull: boolean }>;
};

export type FormConfig = {
  divisorMode: "auto" | "manual";
  manualDivisor: number | null;
  questions: QuestionConfig[];
};

export type AnswerValue = {
  number?: number | null;
  text?: string | null;
  optionIds?: number[] | null;
  isNa?: boolean;
};

export type AnswerMap = Record<number, AnswerValue | undefined>;

export type QuestionContribution = {
  points: number;
  maxPoints: number;
  counted: boolean;
  reason?: "na" | "null_option" | "blank" | "suppressed" | "unscored";
};

type ConditionState = { visible: boolean; enabled: boolean };

function answerIsPresent(answer: AnswerValue | undefined) {
  return Boolean(
    answer?.isNa ||
    answer?.number != null ||
    (answer?.text != null && answer.text.trim().length > 0) ||
    (answer?.optionIds != null && answer.optionIds.length > 0),
  );
}

function conditionMatches(
  operator: ConditionOperator,
  expected: number | number[] | null,
  answer: AnswerValue | undefined,
) {
  if (operator === "answered") return answerIsPresent(answer);

  const optionIds = answer?.optionIds ?? [];
  const numeric = answer?.number;
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  const equals = expectedValues.some(
    (value) =>
      value != null &&
      (numeric === value || optionIds.some((optionId) => optionId === value)),
  );

  switch (operator) {
    case "equals":
      return equals;
    case "not_equals":
      return answerIsPresent(answer) && !equals;
    case "in":
      return equals;
    case "gte":
      return (
        typeof numeric === "number" &&
        typeof expected === "number" &&
        numeric >= expected
      );
    case "lte":
      return (
        typeof numeric === "number" &&
        typeof expected === "number" &&
        numeric <= expected
      );
  }
}

function evaluateConditionsInForm(
  question: QuestionConfig,
  answers: AnswerMap,
  questions: readonly QuestionConfig[],
  visiting: Set<number>,
  memo: Map<number, ConditionState>,
): ConditionState {
  const cached = memo.get(question.id);
  if (cached) return cached;
  if (visiting.has(question.id)) return { visible: false, enabled: false };

  visiting.add(question.id);
  const matches = question.conditions.map((condition) => {
    const source = questions.find(
      (candidate) => candidate.id === condition.sourceQuestionId,
    );
    const sourceState = source
      ? evaluateConditionsInForm(source, answers, questions, visiting, memo)
      : { visible: true, enabled: true };
    const met =
      sourceState.visible &&
      sourceState.enabled &&
      conditionMatches(
        condition.operator,
        condition.value,
        answers[condition.sourceQuestionId],
      );
    return { effect: condition.effect, met };
  });
  visiting.delete(question.id);

  const aggregate = (effect: "show" | "disable") => {
    const relevant = matches.filter((condition) => condition.effect === effect);
    if (relevant.length === 0) return true;
    return question.conditionLogic === "all"
      ? relevant.every(({ met }) => met)
      : relevant.some(({ met }) => met);
  };
  const state = { visible: aggregate("show"), enabled: aggregate("disable") };
  memo.set(question.id, state);
  return state;
}

export function evaluateConditions(
  question: QuestionConfig,
  answers: AnswerMap,
): ConditionState {
  return evaluateConditionsInForm(
    question,
    answers,
    [question],
    new Set(),
    new Map(),
  );
}

export function evaluateFormConditions(
  form: FormConfig,
  answers: AnswerMap,
): Record<number, ConditionState> {
  const memo = new Map<number, ConditionState>();
  for (const question of form.questions)
    evaluateConditionsInForm(
      question,
      answers,
      form.questions,
      new Set(),
      memo,
    );
  return Object.fromEntries(memo);
}

function numericExtremes(question: QuestionConfig) {
  const min = question.min ?? 0;
  const max = question.max ?? min;
  return [min, max].map(
    (value) => (value + question.offset) * (question.weight ?? 0),
  );
}

function optionMaximum(question: QuestionConfig) {
  const scores = question.options
    .filter((option) => !option.isNull && option.valueScore != null)
    .map((option) => option.valueScore as number);
  if (scores.length === 0) return 0;

  const weight = question.weight ?? 0;
  if (question.type !== "multi_select") {
    return Math.max(
      ...scores.map((score) => (score + question.offset) * weight),
    );
  }

  let bestAnswer: number;
  if (question.multiSelectScoring === "sum") {
    const favorable = scores.filter((score) =>
      weight >= 0 ? score > 0 : score < 0,
    );
    bestAnswer =
      favorable.length > 0
        ? favorable.reduce((total, score) => total + score, 0)
        : weight >= 0
          ? Math.max(...scores)
          : Math.min(...scores);
  } else {
    bestAnswer = weight >= 0 ? Math.max(...scores) : Math.min(...scores);
  }
  return (bestAnswer + question.offset) * weight;
}

function maximumPoints(question: QuestionConfig) {
  if (!question.scored || question.weight == null) return 0;
  switch (question.type) {
    case "slider":
    case "integer":
      return Math.max(...numericExtremes(question));
    case "dropdown":
    case "multiple_choice":
    case "multi_select":
      return optionMaximum(question);
    case "short_text":
    case "paragraph":
    case "title":
    case "divider":
      return 0;
  }
}

function answeredScore(
  question: QuestionConfig,
  answer: AnswerValue | undefined,
): { value: number | null; reason?: "null_option" } {
  if (question.type === "slider" || question.type === "integer") {
    return { value: answer?.number ?? null };
  }

  if (
    question.type === "short_text" ||
    question.type === "paragraph" ||
    question.type === "title" ||
    question.type === "divider"
  ) {
    return { value: null };
  }

  const selected = (answer?.optionIds ?? [])
    .map((id) => question.options.find((option) => option.id === id))
    .filter((option): option is QuestionConfig["options"][number] =>
      Boolean(option),
    );
  if (selected.some((option) => option.isNull)) {
    return { value: null, reason: "null_option" };
  }
  const scores = selected
    .map((option) => option.valueScore)
    .filter((score): score is number => score != null);
  if (scores.length === 0) return { value: null };
  if (question.type === "multi_select") {
    return {
      value:
        question.multiSelectScoring === "sum"
          ? scores.reduce((total, score) => total + score, 0)
          : scores.reduce((total, score) => total + score, 0) / scores.length,
    };
  }
  return { value: scores[0] };
}

function contributionForState(
  question: QuestionConfig,
  answers: AnswerMap,
  state: ConditionState,
): QuestionContribution {
  if (!question.scored) {
    return { points: 0, maxPoints: 0, counted: false, reason: "unscored" };
  }
  const maxPoints = maximumPoints(question);
  if (!state.visible || !state.enabled) {
    return {
      points: 0,
      maxPoints,
      counted: false,
      reason: "suppressed",
    };
  }

  const answer = answers[question.id];
  if (answer?.isNa) {
    return { points: 0, maxPoints, counted: false, reason: "na" };
  }
  const scoredAnswer = answeredScore(question, answer);
  if (scoredAnswer.reason === "null_option") {
    return {
      points: 0,
      maxPoints,
      counted: false,
      reason: "null_option",
    };
  }
  if (scoredAnswer.value == null) {
    return question.blankPolicy === "treat_as_zero"
      ? { points: 0, maxPoints, counted: true }
      : { points: 0, maxPoints, counted: false, reason: "blank" };
  }

  const points =
    (scoredAnswer.value + question.offset) * (question.weight ?? 0);
  if (!Number.isFinite(points) || !Number.isFinite(maxPoints)) {
    throw new TypeError("question score configuration must be finite");
  }
  return { points, maxPoints, counted: true };
}

export function questionContribution(
  question: QuestionConfig,
  answers: AnswerMap,
): QuestionContribution {
  return contributionForState(
    question,
    answers,
    evaluateConditions(question, answers),
  );
}

export function computeOverallFromForm(form: FormConfig, answers: AnswerMap) {
  const memo = new Map<number, ConditionState>();
  const terms = form.questions.map((question) => ({
    questionId: question.id,
    ...contributionForState(
      question,
      answers,
      evaluateConditionsInForm(
        question,
        answers,
        form.questions,
        new Set(),
        memo,
      ),
    ),
  }));
  const divisor =
    form.divisorMode === "auto"
      ? terms
          .filter((term) => term.counted)
          .reduce((total, term) => total + term.maxPoints, 0)
      : (form.manualDivisor ?? 0) -
        terms
          .filter((term) => !term.counted)
          .reduce((total, term) => total + term.maxPoints, 0);

  if (!Number.isFinite(divisor) || divisor <= 0) {
    throw new RangeError("divisor must be greater than zero");
  }
  const points = terms
    .filter((term) => term.counted)
    .reduce((total, term) => total + term.points, 0);
  return { overall: Math.max(0, points / divisor), terms };
}

export type Rankable = { overall: number };
export type Ranked<T> = T & { rank: number };

/** Spreadsheet RANK semantics: descending competition ranking (1, 2, 2, 4). */
export function rankFilms<T extends Rankable>(
  films: readonly T[],
): Array<Ranked<T>> {
  const sortedScores = films
    .map(({ overall }) => overall)
    .sort((a, b) => b - a);
  return films.map((film) => ({
    ...film,
    rank: sortedScores.indexOf(film.overall) + 1,
  }));
}
