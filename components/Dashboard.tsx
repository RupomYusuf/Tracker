"use client";

import Link from "next/link";
import { useState } from "react";
import { useTracker } from "@/components/useTracker";
import { Bar, Heatmap, KIND_COLORS, ProgressRing } from "@/components/ui";
import { Kind, Sheet, State } from "@/lib/model";

const KIND_LABEL: Record<Kind, string> = {
  worked: "Worked Examples",
  class: "Class Practice",
  home: "Home Task",
  extra: "Extra (10/topic)",
};

function SheetCard({ sheet, stats, extras }: { sheet: Sheet; stats: Record<string, { done: number; total: number; tried: number; solved: number; understood: number; byKind: Record<Kind, { done: number; total: number }> }>; extras: Record<string, { done: number; total: number }> }) {
  const s = stats[String(sheet.id)];
  if (!s) return null;
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  return (
    <Link
      href={`/sheet/${sheet.id}`}
      className="glass rounded-2xl p-5 block hover:border-emerald-400/40 hover:bg-white/5 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-400">
            <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono">
              {sheet.subject === "math" ? "MATH" : sheet.subject.toUpperCase().slice(0, 10)}
            </span>
            Lecture {String(sheet.lecture).padStart(2, "0")}
          </div>
          <h3 className="font-semibold mt-1.5 leading-snug group-hover:text-emerald-300 transition-colors">
            {sheet.title}
          </h3>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold font-mono">{pct}%</div>
          <div className="text-[11px] text-zinc-500 font-mono">
            {s.done}/{s.total}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        {(Object.keys(s.byKind) as Kind[]).map((k) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 text-zinc-400">{KIND_LABEL[k]}</span>
            <div className="flex-1">
              <Bar value={s.byKind[k].done} total={s.byKind[k].total} color={KIND_COLORS[k]} height={5} />
            </div>
            <span className="w-12 text-right font-mono text-[11px] text-zinc-400">
              {s.byKind[k].done}/{s.byKind[k].total}
            </span>
          </div>
        ))}
      </div>

      {sheet.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sheet.topics.map((t) => {
            const e = extras[`${sheet.id}|${t}`] ?? { done: 0, total: 10 };
            const full = e.done >= e.total;
            return (
              <span
                key={t}
                title={`${t} — extra problems: ${e.done}/${e.total}`}
                className={`text-[10px] rounded-full px-2 py-0.5 border font-mono ${
                  full
                    ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300"
                    : "border-white/10 bg-white/5 text-zinc-400"
                }`}
              >
                {t.length > 26 ? t.slice(0, 24) + "…" : t} · {e.done}/{e.total}
              </span>
            );
          })}
        </div>
      )}
    </Link>
  );
}

export default function Dashboard({
  initial,
}: {
  initial: Pick<State, "sheets" | "progress">;
}) {
  const { sheets, stats, authed, loading, refresh } = useTracker(initial);
  const [showAll, setShowAll] = useState(false);

  const subjects = [...new Set(sheets.map((s) => s.subject))].sort();

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
      {/* header */}
      <header className="flex items-center justify-between py-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="grad-text">IBA MBA</span> Journey Tracker
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Every problem. Every sheet. One war room.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/upload"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-emerald-400/50 hover:text-emerald-300 transition-colors"
          >
            + Upload sheet
          </Link>
        </div>
      </header>

      {loading || !stats ? (
        <div className="text-center text-zinc-500 py-32 animate-pulse">Loading your journey…</div>
      ) : (
        <>
          {/* hero */}
          <section className="glass rounded-3xl p-6 sm:p-8 mb-6 rise">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <ProgressRing percent={stats.percent} size={160} sub={`${stats.done} of ${stats.total} problems`} />
              <div className="flex-1 w-full">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Understood", value: stats.understood, color: "text-emerald-400" },
                    { label: "Solved", value: stats.solved, color: "text-sky-400" },
                    { label: "Tried", value: stats.tried, color: "text-amber-400" },
                    { label: "Remaining", value: stats.remaining, color: "text-zinc-300" },
                    { label: "Flagged to revisit", value: stats.flagged, color: "text-rose-400" },
                    { label: "Day streak", value: stats.streak, color: "text-violet-400" },
                  ].map((it) => (
                    <div key={it.label} className="rounded-xl bg-black/25 border border-white/5 px-4 py-3">
                      <div className={`text-2xl font-bold font-mono ${it.color}`}>{it.value}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">{it.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2 text-xs text-zinc-500">
                <span>Activity — last 18 weeks</span>
                <span className="flex items-center gap-1">
                  less
                  <span className="w-[10px] h-[10px] rounded-[3px] bg-white/6 inline-block" />
                  <span className="w-[10px] h-[10px] rounded-[3px] bg-emerald-400/35 inline-block" />
                  <span className="w-[10px] h-[10px] rounded-[3px] bg-emerald-400/60 inline-block" />
                  <span className="w-[10px] h-[10px] rounded-[3px] bg-emerald-400 inline-block" />
                  more
                </span>
              </div>
              <Heatmap byDay={stats.byDay} />
            </div>
          </section>

          {/* subjects */}
          {subjects.map((subj) => {
            const sub = stats.perSubject[subj];
            const pct = sub?.total ? Math.round((sub.done / sub.total) * 100) : 0;
            const subjectSheets = sheets
              .filter((s) => s.subject === subj)
              .sort((a, b) => a.lecture - b.lecture);
            const visible = showAll ? subjectSheets : subjectSheets.slice(0, 4);
            return (
              <section key={subj} className="mb-10">
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold capitalize">
                      {subj === "analytical" ? "Analytical Ability" : subj}
                    </h2>
                    <p className="text-xs text-zinc-500">
                      {subjectSheets.length} lecture sheets · {sub?.total ?? 0} problems total
                    </p>
                  </div>
                  <div className="w-40">
                    <div className="text-right text-xs font-mono text-zinc-400 mb-1">{pct}%</div>
                    <Bar value={sub?.done ?? 0} total={sub?.total ?? 1} height={6} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {visible.map((sheet) => (
                    <SheetCard
                      key={sheet.id}
                      sheet={sheet}
                      stats={stats.perSheet}
                      extras={stats.perTopicExtra}
                    />
                  ))}
                </div>
                {subjectSheets.length > 4 && (
                  <button
                    onClick={() => setShowAll((v) => !v)}
                    className="mt-4 text-xs text-zinc-400 hover:text-emerald-300 underline underline-offset-4"
                  >
                    {showAll ? "Show fewer" : `Show all ${subjectSheets.length} sheets`}
                  </button>
                )}
              </section>
            );
          })}

          <footer className="text-center text-[11px] text-zinc-600 pt-4 border-t border-white/5">
            Tap a problem chip in any sheet to cycle: <span className="text-amber-400">Tried</span> →{" "}
            <span className="text-sky-400">Solved</span> → <span className="text-emerald-400">Understood</span>. Long-press to flag.
          </footer>
        </>
      )}
    </main>
  );
}
