// Button-scale answers show as 1–10 and are stored times 10 as whole numbers,
// so 9.3 is stored as 93. The buttons give whole and half points. Shift-click
// or a long press on a button lets the rater type any tenth.
export const BUTTON_SCALE_MIN = 10;
export const BUTTON_SCALE_MAX = 100;
/** The step of the buttons and the arrow keys: half a point. */
export const BUTTON_SCALE_STEP = 5;

export function buttonScaleStoredValue(displayValue: number) {
  // Rounds away float error: 1.1 * 10 is 11.000000000000002.
  return Math.round(displayValue * 10);
}

export function buttonScaleDisplayValue(storedValue: number) {
  return storedValue / 10;
}

export function isButtonScaleStoredValue(value: number) {
  return (
    Number.isInteger(value) &&
    value >= BUTTON_SCALE_MIN &&
    value <= BUTTON_SCALE_MAX
  );
}

export function normalizeLegacyButtonScaleValue(value: number) {
  const clamped = Math.max(BUTTON_SCALE_MIN, Math.min(BUTTON_SCALE_MAX, value));
  return Math.round(clamped);
}

export function formatButtonScaleValue(storedValue: number) {
  return String(buttonScaleDisplayValue(storedValue));
}

/**
 * Reads a typed exact score such as "9.3". Returns the stored value, or null
 * if the text is not a number from 1 to 10 with at most one decimal.
 */
export function parseButtonScaleInput(text: string) {
  const trimmed = text.trim();
  if (!/^\d{1,2}(\.\d)?$/.test(trimmed)) return null;
  const stored = buttonScaleStoredValue(Number(trimmed));
  return isButtonScaleStoredValue(stored) ? stored : null;
}
