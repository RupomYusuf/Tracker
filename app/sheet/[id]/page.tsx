"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTracker } from "@/components/useTracker";
import { Bar, Chip, KIND_COLORS, LoginGate, NEXT_STATUS } from "@/components/ui";
import { isDone, Kind, Sheet, Status } from "@/lib/model";

const KIND_LABEL: Record<Kind, string> = {
  worked: "Worked Examples",
  class: "Class Practice",
  home: "Home Task",
  extra: "Extra Problems",
};
const KIND_HINT: Record<Kind, string> = {
  worked: "Solved together in class — mark each one once it makes sense to you.",
  class: "The in-class practice test at the end of the sheet.",
  home: "The home task problems (answer key at the back — check only after trying).",
  extra: "10 self-practice problems per topic. Push beyond the sheet.",
};

function ChipGrid({
  sheetId,
  kind,
  indices,
  topic = "",
  label,
  getStatus,
  setStatus,
  bulk,
}: {
  sheetId: number;
  kind: Kind;
  indices: number[];
  topic?: string;
  label: (i: number) => string;
  getStatus: (sheetId: number, kind: Kind, idx: number, topic?: string) => { status: Status; flagged: boolean };
  setStatus: (sheetId: number, kind: Kind, idx: number, topic: string, status: Status, flagged: boolean) => void;
  bulk?: boolean;
}) {
  const [lastPop, setLastPop] = useState<string | null>(null);
  const rows = indices.map((i) => ({ i, ...getStatus(sheetId, kind, i, topic) }));
  const done = rows.filter((r) => isDone(r.status)).length;
  const flagged = rows.filter((r) => r.flagged).length;

  const markAll = async () => {
    const missing = rows.filter((r) => !isDone(r.status));
    if (missing.length === 0) return;
    if (!window.confirm(`Mark all ${missing.length} remaining problems in this section as Solved?`)) return;
    for (const r of missing) {
      setStatus(sheetId, kind, r.i, topic, "solved", r.flagged);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500 font-mono">
          {done}/{indices.length} cleared{flagged > 0 ? ` · ${flagged} flagged` : ""}
        </span>
        {bulk && (
          <button
            onClick={markAll}
            className="text-[11px] text-zinc-500 hover:text-emerald-300 underline underline-offset-4"
          >
            mark all solved
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <Chip
            key={r.i}
            label={label(r.i)}
            status={r.status}
            flagged={r.flagged}
            pop={lastPop === `${r.i}`}
            onCycle={() => {
              setLastPop(`${r.i}`);
              setStatus(sheetId, kind, r.i, topic, NEXT_STATUS[r.status], r.flagged);
            }}
            onFlag={() => setStatus(sheetId, kind, r.i, topic, r.status, !r.flagged)}
          />
        ))}
      </div>
    </div>
  );
}

export default function SheetPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { sheets, stats, authed, loading, refresh, setStatus, getStatus } = useTracker();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sheet = useMemo(
    () => sheets.find((s) => s.id === Number(params.id)),
    [sheets, params.id]
  );

  if (authed === false) return <LoginGate onDone={refresh} />;
  if (loading) return <div className="text-center text-zinc-500 py-32 animate-pulse">Loading sheet…</div>;
  if (!sheet)
    return (
      <main className="max-w-3xl mx-auto px-6 py-32 text-center">
        <p className="text-zinc-400 mb-4">Sheet not found.</p>
        <Link href="/" className="text-emerald-400 underline underline-offset-4">
          ← Back to dashboard
        </Link>
      </main>
    );

  const s = stats?.perSheet[String(sheet.id)];
  const pct = s?.total ? Math.round((s.done / s.total) * 100) : 0;

  const kinds: { kind: Kind; count: number; from: number }[] = [
    { kind: "worked", count: sheet.counts.worked, from: 1 },
    { kind: "class", count: sheet.counts.class, from: 1 },
    { kind: "home", count: sheet.counts.home, from: 1 },
  ];
  const labels: Record<Kind, (i: number) => string> = {
    worked: (i) => `Ex ${i}`,
    class: (i) => `${i}`,
    home: (i) => `${i}`,
    extra: (i) => `E${i}`,
  };

  const del = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    await fetch(`/api/sheets/${sheet.id}`, { method: "DELETE" });
    router.push("/");
  };

  const classGroups = sheet.meta?.groups ?? [];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
      <header className="py-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-xs text-zinc-500 hover:text-emerald-300">
            ← Dashboard
          </Link>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">
            <span className="text-zinc-500 font-mono text-base mr-2">
              L{String(sheet.lecture).padStart(2, "0")}
            </span>
            {sheet.title}
          </h1>
          <p className="text-xs text-zinc-500 mt-1 capitalize">
            {sheet.subject} · added {sheet.createdAt ? new Date(sheet.createdAt).toLocaleDateString() : "—"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-3xl font-bold font-mono grad-text">{pct}%</div>
          <div className="text-[11px] text-zinc-500 font-mono">
            {s?.done ?? 0}/{s?.total ?? 0} problems
          </div>
          <button onClick={del} className="mt-2 text-[11px] text-zinc-600 hover:text-rose-400">
            {confirmDelete ? "tap again to delete" : "delete sheet"}
          </button>
        </div>
      </header>

      <div className="glass rounded-2xl px-5 py-4 mb-8 grid gap-2 sm:grid-cols-2">
        {kinds
          .filter((k) => k.count > 0)
          .map((k) => (
            <div key={k.kind} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 text-zinc-400">{KIND_LABEL[k.kind]}</span>
              <div className="flex-1">
                <Bar
                  value={s?.byKind[k.kind].done ?? 0}
                  total={k.count}
                  color={KIND_COLORS[k.kind]}
                />
              </div>
              <span className="font-mono text-xs text-zinc-400 w-12 text-right">
                {s?.byKind[k.kind].done ?? 0}/{k.count}
              </span>
            </div>
          ))}
      </div>

      <div className="space-y-8">
        {kinds
          .filter((k) => k.count > 0)
          .map((k) => {
            // split class section into its groups (for analytical "sets")
            const groupBounds =
              k.kind === "class" && classGroups.length > 0 ? classGroups : null;
            const idxRange = groupBounds
              ? null
              : Array.from({ length: k.count }, (_, i) => i + k.from);
            return (
              <section key={k.kind} className="glass rounded-2xl p-5">
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="font-semibold flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ background: KIND_COLORS[k.kind] }}
                    />
                    {KIND_LABEL[k.kind]}
                  </h2>
                </div>
                <p className="text-xs text-zinc-500 mb-4">{KIND_HINT[k.kind]}</p>
                {idxRange && (
                  <ChipGrid
                    sheetId={sheet.id}
                    kind={k.kind}
                    indices={idxRange}
                    label={labels[k.kind]}
                    getStatus={getStatus}
                    setStatus={setStatus}
                    bulk
                  />
                )}
                {groupBounds && (
                  <div className="space-y-5">
                    {groupBounds.map((g) => (
                      <div key={g.label}>
                        <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                          {g.label}{" "}
                          <span className="text-zinc-600 font-mono normal-case">
                            ({g.from}–{g.to})
                          </span>
                        </p>
                        <ChipGrid
                          sheetId={sheet.id}
                          kind={k.kind}
                          indices={Array.from({ length: g.to - g.from + 1 }, (_, i) => g.from + i)}
                          label={labels[k.kind]}
                          getStatus={getStatus}
                          setStatus={setStatus}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

        {/* extra problems per topic */}
        {sheet.topics.length > 0 && (
          <section className="glass rounded-2xl p-5">
            <h2 className="font-semibold flex items-center gap-2 mb-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: KIND_COLORS.extra }} />
              Extra Problems — 10 per topic
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Your own rule: every topic in the sheet owes you 10 extra solved problems.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {sheet.topics.map((t) => {
                const e = stats?.perTopicExtra[`${sheet.id}|${t}`] ?? { done: 0, total: 10 };
                return (
                  <div key={t} className="rounded-xl bg-black/25 border border-white/5 p-4">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="text-sm font-medium leading-tight">{t}</span>
                      <span className={`font-mono text-xs ${e.done >= 10 ? "text-emerald-400" : "text-zinc-500"}`}>
                        {e.done}/10
                      </span>
                    </div>
                    <Bar value={e.done} total={10} color={KIND_COLORS.extra} height={5} />
                    <div className="mt-3">
                      <ChipGrid
                        sheetId={sheet.id}
                        kind="extra"
                        indices={Array.from({ length: 10 }, (_, i) => i + 1)}
                        topic={t}
                        label={labels.extra}
                        getStatus={getStatus}
                        setStatus={setStatus}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <div className="mt-10 text-center text-[11px] text-zinc-600">
        Tap a chip to cycle status: <span className="text-amber-400">Tried</span> →{" "}
        <span className="text-sky-400">Solved</span> → <span className="text-emerald-400">Understood</span> → reset. Long-press
        (or right-click) to flag for revisit.
      </div>
    </main>
  );
}
