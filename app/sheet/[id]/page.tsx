import SheetView from "@/components/SheetView";
import { LoginGate } from "@/components/ui";
import { isAuthed } from "@/lib/auth";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return <LoginGate />;
  const { id } = await params;
  const { sheets, progress } = await getState();
  return <SheetView initial={{ sheets, progress }} sheetId={Number(id)} />;
}
