export type StreakGranularity = "day" | "week" | "month";

export type StreakSummary = Record<
  StreakGranularity,
  { current: number; longest: number }
>;

export function computeStreaks(
  watchDates: readonly string[],
  today: string,
): StreakSummary {
  const todaySerial = dateSerial(today);
  if (todaySerial === null)
    throw new RangeError("Today must be an ISO calendar date.");
  const dates = watchDates
    .map(dateSerial)
    .filter((value): value is number => value !== null && value <= todaySerial);
  return {
    day: streakForUnits(dates, todaySerial),
    week: streakForUnits(dates.map(weekNumber), weekNumber(todaySerial)),
    month: streakForUnits(
      dates.map(monthNumberFromSerial),
      monthNumberFromSerial(todaySerial),
    ),
  };
}

export function weeklyGoalPace(
  watchDates: readonly string[],
  goal: number | null,
  today: string,
) {
  if (goal === null) return null;
  if (!Number.isInteger(goal) || goal <= 0)
    throw new RangeError("Weekly goal must be a positive integer.");
  const todaySerial = dateSerial(today);
  if (todaySerial === null)
    throw new RangeError("Today must be an ISO calendar date.");
  const currentWeek = weekNumber(todaySerial);
  const watched = watchDates.filter((date) => {
    const serial = dateSerial(date);
    return (
      serial !== null &&
      serial <= todaySerial &&
      weekNumber(serial) === currentWeek
    );
  }).length;
  const dayOfWeek = mod(todaySerial + 3, 7); // Monday = 0
  const elapsedDays = dayOfWeek + 1;
  const projected = (watched / elapsedDays) * 7;
  const expectedByNow = (goal * elapsedDays) / 7;
  const status =
    watched >= goal
      ? "complete"
      : watched > expectedByNow
        ? "ahead"
        : projected >= goal
          ? "on_pace"
          : "behind";
  return {
    goal,
    watched,
    remaining: Math.max(0, goal - watched),
    projected,
    status,
  } as const;
}

function streakForUnits(values: readonly number[], currentUnit: number) {
  const units = [...new Set(values)].sort((left, right) => left - right);
  if (!units.length) return { current: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let index = 1; index < units.length; index += 1) {
    run = units[index] === units[index - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const latest = units.at(-1)!;
  if (currentUnit - latest > 1) return { current: 0, longest };
  let current = 1;
  for (let index = units.length - 1; index > 0; index -= 1) {
    if (units[index - 1] !== units[index] - 1) break;
    current += 1;
  }
  return { current, longest };
}

function dateSerial(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return Math.floor(time / 86_400_000);
}

function weekNumber(serial: number) {
  return Math.floor((serial + 3) / 7);
}

function monthNumberFromSerial(serial: number) {
  const date = new Date(serial * 86_400_000);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function mod(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
