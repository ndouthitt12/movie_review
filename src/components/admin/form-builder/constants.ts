import type { RuntimeQuestionConfig } from "@/lib/form-config";

export const answerTypes = [
  "slider",
  "short_text",
  "paragraph",
  "dropdown",
  "multi_select",
  "multiple_choice",
  "integer",
] as const satisfies readonly RuntimeQuestionConfig["type"][];

export const displayTypes = [
  "title",
  "divider",
] as const satisfies readonly RuntimeQuestionConfig["type"][];

export const typeLabels: Record<RuntimeQuestionConfig["type"], string> = {
  slider: "Slider",
  short_text: "Short text",
  paragraph: "Paragraph",
  dropdown: "Dropdown",
  multi_select: "Multi-select",
  multiple_choice: "Multiple choice",
  integer: "Number",
  title: "Title",
  divider: "Divider",
};

export const optionTypes = new Set<RuntimeQuestionConfig["type"]>([
  "dropdown",
  "multi_select",
  "multiple_choice",
]);

export function isDisplayType(type: RuntimeQuestionConfig["type"]) {
  return type === "title" || type === "divider";
}
