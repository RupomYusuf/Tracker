import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { createSheet, NewSheetInput } from "@/lib/store";

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as NewSheetInput | null;
  if (!body || !body.subject || !body.title || typeof body.lecture !== "number") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const clamp = (n: unknown) => Math.max(0, Math.min(300, Math.floor(Number(n) || 0)));
  const sheet = await createSheet({
    subject: String(body.subject).trim().toLowerCase(),
    lecture: Number(body.lecture),
    title: String(body.title).trim(),
    topics: (body.topics ?? []).map((t) => String(t).trim()).filter(Boolean),
    worked: clamp(body.worked),
    class: clamp(body.class),
    home: clamp(body.home),
    meta: body.meta,
  });
  return NextResponse.json({ sheet });
}
