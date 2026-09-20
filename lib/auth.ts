import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "tracker_session";

export function accessCodeConfigured(): boolean {
  return Boolean(process.env.ACCESS_CODE);
}

export function sessionToken(): string {
  return crypto
    .createHash("sha256")
    .update(`iba-tracker::${process.env.ACCESS_CODE ?? "open"}`)
    .digest("hex");
}

// Returns true when the request is allowed. Open access when no ACCESS_CODE.
export async function isAuthed(): Promise<boolean> {
  if (!accessCodeConfigured()) return true;
  const jar = await cookies();
  return jar.get(COOKIE)?.value === sessionToken();
}

export async function signIn(code: string): Promise<boolean> {
  if (!accessCodeConfigured()) return true;
  if (code !== process.env.ACCESS_CODE) return false;
  const jar = await cookies();
  jar.set(COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return true;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
