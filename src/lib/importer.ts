import ExcelJS, { type CellValue } from "exceljs";
import {
  computeOverall,
  computeSecondary,
  rankFilms,
  type AttributeScores,
  type RatingWeights,
} from "./scoring";

export type FilmStatus = "watched" | "to_watch" | "to_rewatch";

export interface ImportedFilm {
  rowNumber: number;
  title: string;
  releaseYear: number;
  status: FilmStatus;
  watchOrder: number | null;
  lastWatchDate: string | null;
  genrePrimary: string | null;
  genreSecondary: string | null;
  upperFranchise: string | null;
  lowerFranchise: string | null;
  notes: string;
  scores: AttributeScores | null;
  quality: number | null;
  storedOverall: number | null;
  storedSecondary: number | null;
  storedRank: number | null;
}

export interface ParseResult {
  films: ImportedFilm[];
  errors: Array<{ rowNumber: number; message: string }>;
}

const scoreFields = [
  "story",
  "direction",
  "writing",
  "acting",
  "music",
  "impact",
  "rewatchability",
  "genreFit",
] as const;

const aliases: Record<string, string[]> = {
  title: ["movie title", "title", "film"],
  releaseYear: ["release year", "year"],
  status: ["category", "status"],
  watchOrder: ["towatchorder", "to watch order", "watch order"],
  lastWatchDate: ["last watch date", "last watched"],
  genre: ["genre"],
  upperFranchise: ["upper franchise", "franchise"],
  lowerFranchise: ["lower franchise i", "lower franchise", "sub franchise"],
  notes: ["notes"],
  story: ["story"],
  direction: ["direction"],
  writing: ["writing"],
  acting: ["acting"],
  music: ["music"],
  impact: ["impact"],
  rewatchability: ["rewatchability"],
  genreFit: ["genre fit", "genre-fit", "genre score"],
  quality: ["quality"],
  overall: ["overall"],
  secondary: ["overall secondary", "secondary", "overall 2"],
  rank: ["ranking", "rank"],
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const normalizedAliases = Object.fromEntries(
  Object.entries(aliases).map(([key, values]) => [
    key,
    values.map(normalizeHeader),
  ]),
);

function findValue(row: Record<string, unknown>, field: string) {
  const candidates = normalizedAliases[field];
  const entry = Object.entries(row).find(([header]) =>
    candidates.includes(normalizeHeader(header)),
  );
  return entry?.[1];
}

function optionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number =
    typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function parseStatus(value: unknown): FilmStatus | null {
  const normalized = normalizeHeader(value).replaceAll(" ", "_");
  if (normalized === "watched") return "watched";
  if (normalized === "to_watch") return "to_watch";
  if (normalized === "to_re_watch" || normalized === "to_rewatch")
    return "to_rewatch";
  return null;
}

export function excelDateToIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf()))
    return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1) return null;
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + Math.round(value) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  const text = optionalString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf())
    ? null
    : parsed.toISOString().slice(0, 10);
}

export function splitGenre(value: unknown): [string | null, string | null] {
  const text = optionalString(value);
  if (!text) return [null, null];
  const [primary, ...rest] = text.split(" - ");
  return [primary.trim() || null, rest.join(" - ").trim() || null];
}

function unwrapCellValue(value: CellValue): unknown {
  if (value === null || value instanceof Date || typeof value !== "object")
    return value;
  if ("result" in value) return value.result;
  if ("richText" in value)
    return value.richText.map(({ text }) => text).join("");
  if ("text" in value) return value.text;
  return String(value);
}

export async function parseWorkbook(filePath: string): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets.find(
    (sheet) => normalizeHeader(sheet.name) === "films",
  );
  if (!worksheet)
    throw new Error('Workbook must contain a sheet named "Films".');

  const headers = new Map<number, string>();
  worksheet
    .getRow(1)
    .eachCell((cell, column) => headers.set(column, cell.text.trim()));
  const normalizedHeaders = [...headers.values()].map(normalizeHeader);
  const requiredFields = [
    "title",
    "releaseYear",
    "status",
    ...scoreFields,
    "overall",
    "rank",
  ];
  const missing = requiredFields.filter(
    (field) =>
      !normalizedAliases[field].some((header) =>
        normalizedHeaders.includes(header),
      ),
  );
  if (missing.length)
    throw new Error(
      `Films sheet is missing required columns: ${missing.join(", ")}`,
    );

  const films: ImportedFilm[] = [];
  const errors: ParseResult["errors"] = [];
  for (
    let worksheetRowNumber = 2;
    worksheetRowNumber <= worksheet.rowCount;
    worksheetRowNumber++
  ) {
    const worksheetRow = worksheet.getRow(worksheetRowNumber);
    const row: Record<string, unknown> = {};
    for (const [column, header] of headers) {
      // Primary score columns precede duplicate names in the secondary block.
      if (!(header in row))
        row[header] = unwrapCellValue(worksheetRow.getCell(column).value);
    }

    const rowNumber = worksheetRowNumber;
    const title = optionalString(findValue(row, "title"));
    if (!title && Object.values(row).every(isBlank)) continue;

    const readNumber = (
      field: string,
      label: string,
      options: { integer?: boolean; min?: number; max?: number } = {},
    ) => {
      const raw = findValue(row, field);
      if (isBlank(raw)) return null;
      const value = optionalNumber(raw);
      if (
        value === null ||
        (options.integer && !Number.isInteger(value)) ||
        (options.min !== undefined && value < options.min) ||
        (options.max !== undefined && value > options.max)
      ) {
        errors.push({ rowNumber, message: `Invalid ${label}: ${String(raw)}` });
        return null;
      }
      return value;
    };

    const releaseYear = readNumber("releaseYear", "release year", {
      integer: true,
      min: 1888,
    });
    const status = parseStatus(findValue(row, "status"));
    if (!title) errors.push({ rowNumber, message: "Missing movie title" });
    if (releaseYear === null && isBlank(findValue(row, "releaseYear")))
      errors.push({ rowNumber, message: "Missing release year" });
    if (!status) errors.push({ rowNumber, message: "Unknown category/status" });
    if (!title || releaseYear === null || !status) continue;

    const [genrePrimary, genreSecondary] = splitGenre(findValue(row, "genre"));
    const scoreValues = Object.fromEntries(
      scoreFields.map((field) => [
        field,
        readNumber(field, field === "genreFit" ? "genre fit" : field, {
          integer: true,
          min: 0,
          max: 100,
        }),
      ]),
    ) as Record<keyof AttributeScores, number | null>;
    const populatedScores = scoreFields.filter(
      (field) => !isBlank(findValue(row, field)),
    );
    let scores: AttributeScores | null = null;
    if (
      populatedScores.length === 8 &&
      Object.values(scoreValues).every((value) => value !== null)
    )
      scores = scoreValues as AttributeScores;
    else if (populatedScores.length > 0)
      errors.push({
        rowNumber,
        message:
          "Rating block is incomplete; all eight attributes are required",
      });

    const rawDate = findValue(row, "lastWatchDate");
    const lastWatchDate = excelDateToIso(rawDate);
    if (!isBlank(rawDate) && lastWatchDate === null)
      errors.push({
        rowNumber,
        message: `Invalid last watch date: ${String(rawDate)}`,
      });
    const storedOverall = readNumber("overall", "overall");
    const storedRank = readNumber("rank", "ranking", { integer: true, min: 1 });
    if (scores && storedOverall === null)
      errors.push({
        rowNumber,
        message: "Rated row is missing a valid Overall value",
      });
    if (scores && storedRank === null)
      errors.push({
        rowNumber,
        message: "Rated row is missing a valid Ranking value",
      });
    if (
      !scores &&
      (!isBlank(findValue(row, "overall")) || !isBlank(findValue(row, "rank")))
    )
      errors.push({
        rowNumber,
        message: "Overall/Ranking exists without a complete rating block",
      });

    films.push({
      rowNumber,
      title,
      releaseYear,
      status,
      watchOrder: readNumber("watchOrder", "watch order", {
        integer: true,
        min: 0,
      }),
      lastWatchDate,
      genrePrimary,
      genreSecondary,
      upperFranchise: optionalString(findValue(row, "upperFranchise")),
      lowerFranchise: optionalString(findValue(row, "lowerFranchise")),
      notes: optionalString(findValue(row, "notes")) ?? "",
      scores,
      quality: readNumber("quality", "quality", {
        integer: true,
        min: 0,
        max: 100,
      }),
      storedOverall,
      storedSecondary: readNumber("secondary", "secondary overall"),
      storedRank,
    });
  }
  return { films, errors };
}

export function verifyImport(films: ImportedFilm[], weights: RatingWeights) {
  const failures: string[] = [];
  const counts = { watched: 0, to_watch: 0, to_rewatch: 0 };
  films.forEach((film) => counts[film.status]++);

  const rated = films
    .filter(
      (film): film is ImportedFilm & { scores: AttributeScores } =>
        film.scores !== null,
    )
    .map((film) => ({ film, overall: computeOverall(film.scores, weights) }));
  rated.forEach(({ film, overall }) => {
    if (film.storedOverall === null)
      failures.push(
        `Row ${film.rowNumber} (${film.title}): missing sheet Overall`,
      );
    else if (overall.toFixed(3) !== film.storedOverall.toFixed(3))
      failures.push(
        `Row ${film.rowNumber} (${film.title}): overall ${overall.toFixed(3)} != sheet ${film.storedOverall.toFixed(3)}`,
      );
    if (film.quality !== null && film.storedSecondary !== null) {
      const secondary = computeSecondary(
        film.quality,
        film.scores.rewatchability,
        film.scores.genreFit,
      );
      if (secondary.toFixed(3) !== film.storedSecondary.toFixed(3))
        failures.push(
          `Row ${film.rowNumber} (${film.title}): secondary score mismatch`,
        );
    }
  });
  rankFilms(rated).forEach(({ film, rank }) => {
    if (film.storedRank === null)
      failures.push(
        `Row ${film.rowNumber} (${film.title}): missing sheet Ranking`,
      );
    else if (rank !== film.storedRank)
      failures.push(
        `Row ${film.rowNumber} (${film.title}): rank ${rank} != sheet ${film.storedRank}`,
      );
  });
  return { counts, failures, rated };
}
