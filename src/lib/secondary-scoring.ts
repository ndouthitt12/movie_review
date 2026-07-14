import type { RuntimeFormConfig } from "./form-config";
import type { FormConfig } from "./scoring";

export function getSecondaryFormConfig(form: RuntimeFormConfig): FormConfig {
  return {
    divisorMode: form.secondaryDivisorMode,
    manualDivisor: form.secondaryManualDivisor,
    questions: form.questions.map((question) => ({
      ...question,
      scored: question.secondaryScored,
      weight: question.secondaryWeight,
      offset: question.secondaryOffset,
      blankPolicy: question.secondaryBlankPolicy,
    })),
  };
}
