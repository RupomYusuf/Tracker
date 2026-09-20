import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { setProgress, ProgressInput } from "@/lib/store";
import { Status } from "@/lib/model";

export async function POST(req: NextRequest) {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as ProgressInput | null;
  if (!body || !body.sheetId || !body.kind || typeof body.idx !== "number") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const statuses: Status[] = ["none", "tried", "solved", "understood"];
  if (!statuses.includes(body.status)) {
    return NextResponse.json({ error: "bad status" }, { status: 400 });
  }
  await setProgress({
    sheetId: Number(body.sheetId),
    kind: body.kind,
    idx: body.idx,
    topic: body.topic ?? "",
    status: body.status,
    flagged: Boolean(body.flagged),
  });
  return NextResponse.json({ ok: true });
}
