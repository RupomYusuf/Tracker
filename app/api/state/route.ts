import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { getState } from "@/lib/store";
import { computeStats } from "@/lib/model";

export async function GET() {
  if (!(await isAuthed())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sheets, progress } = await getState();
  const stats = computeStats(sheets, progress);
  return NextResponse.json({ sheets, progress, stats, authed: true });
}
