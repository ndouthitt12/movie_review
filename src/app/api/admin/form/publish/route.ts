import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { publishDraftForm } from "@/lib/admin-form";

export async function POST() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const result = await publishDraftForm();
  if (result.errors.length)
    return NextResponse.json({ error: result.errors[0], errors: result.errors }, { status: 400 });
  return NextResponse.json({ form: result.form });
}
