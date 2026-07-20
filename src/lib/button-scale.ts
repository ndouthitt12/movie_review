export const BUTTON_SCALE_MIN = 10;
export const BUTTON_SCALE_MAX = 100;
export const BUTTON_SCALE_STEP = 5;

export function buttonScaleStoredValue(displayValue: number) {
  return displayValue * 10;
}

export function buttonScaleDisplayValue(storedValue: number) {
  return storedValue / 10;
}

export function isButtonScaleStoredValue(value: number) {
  return (
    Number.isFinite(value) &&
    value >= BUTTON_SCALE_MIN &&
    value <= BUTTON_SCALE_MAX &&
    value % BUTTON_SCALE_STEP === 0
  );
}

export function normalizeLegacyButtonScaleValue(value: number) {
  const clamped = Math.max(BUTTON_SCALE_MIN, Math.min(BUTTON_SCALE_MAX, value));
  return Math.round(clamped / BUTTON_SCALE_STEP) * BUTTON_SCALE_STEP;
}

export function formatButtonScaleValue(storedValue: number) {
  return String(buttonScaleDisplayValue(storedValue));
}
