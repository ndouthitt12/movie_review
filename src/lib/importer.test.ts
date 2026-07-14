import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { defaultWeights } from "@/db/seed-data";
import {
  excelDateToIso,
  importedAnswerValues,
  parseWorkbook,
  splitGenre,
  verifyImport,
  type ImportedFilm,
} from "./importer";

describe("spreadsheet parsing helpers", () => {
  it("converts Excel serial dates without timezone drift", () => {
    expect(excelDateToIso(45_658)).toBe("2025-01-01");
  });

  it("splits only the canonical spaced separator", () => {
    expect(splitGenre("Horror - Thriller")).toEqual(["Horror", "Thriller"]);
    expect(splitGenre("Sci-Fi")).toEqual(["Sci-Fi", null]);
  });
});

describe("import verification", () => {
  it("maps a rated row to the v1 answer keys", () => {
    const film = fixtureFilm();
    expect(importedAnswerValues(film).map(({ key }) => key)).toEqual([
      "story",
      "direction",
      "writing",
      "acting",
      "music",
      "impact",
      "rewatchability",
      "genre_fit",
      "quality",
    ]);
    expect(importedAnswerValues({ ...film, quality: null })).toHaveLength(8);
    expect(importedAnswerValues({ ...film, scores: null })).toEqual([]);
  });

  it("reports stored score and competition-rank mismatches", () => {
    const base: ImportedFilm = {
      ...fixtureFilm(),
      quality: null,
      storedOverall: 1,
      storedSecondary: null,
      storedRank: 2,
    };
    const result = verifyImport([base], defaultWeights);
    expect(result.counts).toEqual({ watched: 1, to_watch: 0, to_rewatch: 0 });
    expect(result.failures).toHaveLength(2);
  });

  it("fails verification when rated rows omit stored Overall or Ranking", () => {
    const result = verifyImport(
      [
        {
          rowNumber: 2,
          title: "Missing verification cells",
          releaseYear: 2000,
          status: "watched",
          watchOrder: null,
          lastWatchDate: null,
          genrePrimary: null,
          genreSecondary: null,
          upperFranchise: null,
          lowerFranchise: null,
          notes: "",
          scores: scores(80),
          quality: null,
          storedOverall: null,
          storedSecondary: null,
          storedRank: null,
        },
      ],
      defaultWeights,
    );
    expect(result.failures).toEqual([
      "Row 2 (Missing verification cells): missing sheet Overall",
      "Row 2 (Missing verification cells): missing sheet Ranking",
    ]);
  });
});

describe("workbook validation", () => {
  it("requires score and verification columns", async () => {
    const fixture = await workbookFixture(
      ["Movie Title", "Release Year", "Category"],
      [["Fixture", 2000, "Watched"]],
    );
    try {
      await expect(parseWorkbook(fixture.file)).rejects.toThrow(
        /missing required columns/i,
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("reports malformed dates, numbers, and score ranges", async () => {
    const headers = [
      "Movie Title",
      "Release Year",
      "Category",
      "Last Watch Date",
      "Story",
      "Direction",
      "Writing",
      "Acting",
      "Music",
      "Impact",
      "Rewatchability",
      "Genre-fit",
      "Overall",
      "Ranking",
    ];
    const fixture = await workbookFixture(headers, [
      [
        "Fixture",
        2000,
        "Watched",
        "not-a-date",
        101,
        80,
        80,
        80,
        80,
        80,
        80,
        80,
        "bad",
        1,
      ],
    ]);
    try {
      const result = await parseWorkbook(fixture.file);
      expect(result.errors.map(({ message }) => message)).toEqual(
        expect.arrayContaining([
          "Invalid story: 101",
          "Invalid last watch date: not-a-date",
          "Invalid overall: bad",
        ]),
      );
    } finally {
      await fixture.cleanup();
    }
  });
});

function scores(value: number) {
  return {
    story: value,
    direction: value,
    writing: value,
    acting: value,
    music: value,
    impact: value,
    rewatchability: value,
    genreFit: value,
  };
}

function fixtureFilm(): ImportedFilm {
  return {
    rowNumber: 2,
    title: "Fixture",
    releaseYear: 1993,
    status: "watched",
    watchOrder: null,
    lastWatchDate: null,
    genrePrimary: "Drama",
    genreSecondary: null,
    upperFranchise: null,
    lowerFranchise: null,
    notes: "",
    scores: scores(80),
    quality: 75,
    storedOverall: null,
    storedSecondary: null,
    storedRank: null,
  };
}

async function workbookFixture(headers: string[], rows: unknown[][]) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "picture-house-import-"),
  );
  const file = path.join(directory, "fixture.xlsx");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Films");
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  await workbook.xlsx.writeFile(file);
  return {
    file,
    cleanup: () => fs.rm(directory, { recursive: true, force: true }),
  };
}
