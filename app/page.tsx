import Dashboard from "@/components/Dashboard";
import { LoginGate } from "@/components/ui";
import { isAuthed } from "@/lib/auth";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAuthed())) return <LoginGate />;
  const { sheets, progress } = await getState();
  return <Dashboard initial={{ sheets, progress }} />;
}
