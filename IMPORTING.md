# Spreadsheet import

Export the Google Sheet as an Excel workbook (`.xlsx`), not CSV. A CSV export contains only one tab, while the importer deliberately requires the `Films` tab from the workbook.

Preview and verify without changing the database:

```powershell
npm run import -- --dry-run "C:\path\to\Movie Watchlist.xlsx"
```

Commit an import after the preview succeeds:

```powershell
npm run db:migrate
npm run db:seed
npm run import -- "C:\path\to\Movie Watchlist.xlsx"
```

The command validates required verification columns, malformed dates/numbers, 0–100 score ranges, the source totals (365 watched, 355 to-watch, 63 to-re-watch), stored overall scores to three decimals, secondary scores when present, and competition ranks. Any failure aborts before database writes. A committed import uses the weights in the seeded settings row, verifies persisted film/rating/watch counts inside one transaction, and requires an empty `films` table. Dry runs intentionally use the canonical spreadsheet weights and do not require a database.

Accepted column names are tolerant of spacing and punctuation. The canonical names are `Last Watch Date`, `ToWatchOrder`, `Ranking`, `Release Year`, `Movie Title`, `Category`, `Genre`, `Upper Franchise`, `Lower Franchise I`, `Notes`, the eight attribute names, `Quality`, `Overall`, and `Overall Secondary`.
