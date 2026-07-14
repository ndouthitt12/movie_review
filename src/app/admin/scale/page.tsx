import { asc } from "drizzle-orm";
import { ScaleEditor } from "@/components/admin/scale-editor";
import { db } from "@/db";
import { scaleLevels } from "@/db/schema";

export const dynamic = "force-dynamic";

export default function AdminScalePage() {
  const levels = db.select().from(scaleLevels).orderBy(asc(scaleLevels.level)).all();
  return <div><header className="page-heading"><p className="eyebrow">Public rating reference</p><h1>Rating Scale</h1><p>Edit the 11 levels shown on the public rubric page.</p></header><ScaleEditor initialLevels={levels} /></div>;
}
