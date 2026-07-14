import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { buildCsvExport, buildJsonExport } from "@/lib/export";

export async function GET(request: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv")
    return new Response(await buildCsvExport(), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="movie-ratings-${stamp}.csv"`,
      },
    });
  if (format !== "json")
    return NextResponse.json({ error: "Format must be json or csv." }, { status: 400 });
  return new Response(JSON.stringify(await buildJsonExport(), null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="movie-ratings-${stamp}.json"`,
    },
  });
}
