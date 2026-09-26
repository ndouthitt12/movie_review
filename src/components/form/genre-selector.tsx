"use client";

import { normalizeGenre, uniqueGenres } from "@/lib/genres";

export function GenreSelector({
  genres,
  selected,
  onChange,
  legend,
  description,
}: {
  genres: string[];
  selected: string[];
  onChange: (genres: string[]) => void;
  legend: string;
  description: string;
}) {
  const options = uniqueGenres([...genres, ...selected]);
  return (
    <fieldset>
      <legend className="text-paper-100 text-sm font-semibold">{legend}</legend>
      <p className="text-paper-500 mt-1 text-xs leading-5">{description}</p>
      {options.length ? (
        <div className="border-hairline mt-3 grid max-h-56 grid-cols-2 gap-x-3 overflow-y-auto rounded-md border p-2">
          {options.map((genre) => {
            const checked = selected.some(
              (value) => normalizeGenre(value) === normalizeGenre(genre),
            );
            return (
              <label
                key={genre}
                className="text-paper-300 flex min-h-10 cursor-pointer items-center gap-2 px-1 text-sm"
              >
                <input
                  type="checkbox"
                  className="accent-accent-400 h-4 w-4 shrink-0"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter(
                            (value) =>
                              normalizeGenre(value) !== normalizeGenre(genre),
                          )
                        : [...selected, genre],
                    )
                  }
                />
                {genre}
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-paper-500 mt-3 text-sm">
          Add genres to a film in your library to see them here.
        </p>
      )}
      {selected.length ? (
        <button
          type="button"
          className="link-button mt-2"
          onClick={() => onChange([])}
        >
          Clear genres
        </button>
      ) : null}
    </fieldset>
  );
}
