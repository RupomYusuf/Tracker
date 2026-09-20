"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { computeStats, Kind, Sheet, Stats, Status } from "@/lib/model";

type ProgressRow = {
  sheetId: number;
  kind: Kind;
  idx: number;
  topic: string;
  status: Status;
  flagged: boolean;
  updatedAt: string;
};

// Central client hook: starts from server-rendered initial data when provided
// (no client fetch waterfall), handles the access-code gate and applies
// optimistic progress updates that are POSTed to the server.
export function useTracker(initial?: { sheets: Sheet[]; progress: ProgressRow[] }) {
  const [sheets, setSheets] = useState<Sheet[]>(initial?.sheets ?? []);
  const [progress, setProgress] = useState<ProgressRow[]>(initial?.progress ?? []);
  const [authed, setAuthed] = useState<boolean | null>(initial ? true : null);
  const [loading, setLoading] = useState(!initial);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setSheets(data.sheets);
    setProgress(data.progress);
    setAuthed(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats: Stats = useMemo(
    () => computeStats(sheets, progress),
    [sheets, progress]
  );

  const setStatus = useCallback(
    async (
      sheetId: number,
      kind: Kind,
      idx: number,
      topic: string,
      status: Status,
      flagged: boolean
    ) => {
      const key = (p: ProgressRow) =>
        `${p.sheetId}|${p.kind}|${p.idx}|${p.topic}`;
      const target: ProgressRow = {
        sheetId,
        kind,
        idx,
        topic,
        status,
        flagged,
        updatedAt: new Date().toISOString(),
      };
      const empty = status === "none" && !flagged;
      const prevRows = progress;
      setProgress((rows) =>
        empty
          ? rows.filter((r) => key(r) !== key(target))
          : [...rows.filter((r) => key(r) !== key(target)), target]
      );
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId, kind, idx, topic, status, flagged }),
      });
      if (!res.ok) {
        setProgress(prevRows); // revert
        if (res.status === 401) setAuthed(false);
      }
    },
    [progress]
  );

  const getStatus = useCallback(
    (sheetId: number, kind: Kind, idx: number, topic = ""): { status: Status; flagged: boolean } => {
      const row = progress.find(
        (p) => p.sheetId === sheetId && p.kind === kind && p.idx === idx && p.topic === topic
      );
      return { status: row?.status ?? "none", flagged: row?.flagged ?? false };
    },
    [progress]
  );

  return { sheets, progress, stats, authed, loading, refresh, setStatus, getStatus };
}
