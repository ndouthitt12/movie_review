type FilmGenres = {
  genrePrimary?: string | null;
  genreSecondary?: string | null;
  tmdbGenres?: string[] | null;
};

export function normalizeGenre(genre: string) {
  const normalized = genre.trim().toLowerCase();
  return ["science fiction", "sci-fi", "sci fi"].includes(normalized)
    ? "sci-fi"
    : normalized;
}

export function uniqueGenres(genres: readonly string[]) {
  const names = new Map<string, string>();
  for (const genre of genres) {
    const key = normalizeGenre(genre);
    if (key && !names.has(key))
      names.set(key, key === "sci-fi" ? "Sci-Fi" : genre.trim());
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export function getFilmGenres(film: FilmGenres): string[] {
  return uniqueGenres(
    [film.genrePrimary, film.genreSecondary, ...(film.tmdbGenres ?? [])].filter(
      (genre): genre is string => Boolean(genre),
    ),
  );
}

export function matchesGenres(
  applicableGenres: readonly string[] | undefined,
  filmGenres: readonly string[],
) {
  if (!applicableGenres?.length) return true;
  const genres = new Set(filmGenres.map(normalizeGenre));
  return applicableGenres.some((genre) => genres.has(normalizeGenre(genre)));
}
