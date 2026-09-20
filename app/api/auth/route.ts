import { NextRequest, NextResponse } from "next/server";
import { signIn, signOut, isAuthed } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ authed: await isAuthed() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ok = await signIn(String(body.code ?? ""));
  if (!ok) return NextResponse.json({ error: "Wrong code" }, { status: 401 });
  return NextResponse.json({ authed: true });
}

export async function DELETE() {
  await signOut();
  return NextResponse.json({ authed: false });
}
