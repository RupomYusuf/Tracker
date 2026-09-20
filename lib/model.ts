export type Kind = "worked" | "class" | "home" | "extra";
export type Status = "none" | "tried" | "solved" | "understood";

export const KIND_LABEL: Record<Kind, string> = {
  worked: "Worked Examples",
  class: "Class Practice",
  home: "Home Task",
  extra: "Extra Problems",
};

export const STATUS_ORDER: Status[] = ["none", "tried", "solved", "understood"];

export type Sheet = {
  id: number;
  subject: string;
  lecture: number;
  title: string;
  topics: string[];
  counts: { worked: number; class: number; home: number };
  meta: { display?: string; groups?: { label: string; from: number; to: number }[]; source?: string };
  createdAt?: string;
};

export type ProgressRow = {
  sheetId: number;
  kind: Kind;
  idx: number;
  topic: string;
  status: Status;
  flagged: boolean;
  updatedAt: string;
};

export type State = {
  sheets: Sheet[];
  progress: ProgressRow[];
};

export type ItemKey = { kind: Kind; idx: number; topic: string };

// All trackable items of a sheet, in display order (without stored status).
export function sheetItems(sheet: Sheet): { kind: Kind; label: string; topic: string; idx: number; group?: string }[] {
  const items: { kind: Kind; label: string; topic: string; idx: number; group?: string }[] = [];
  for (let i = 1; i <= sheet.counts.worked; i++)
    items.push({ kind: "worked", label: `Ex ${i}`, topic: "", idx: i });
  for (let i = 1; i <= sheet.counts.class; i++) {
    const group = sheet.meta.groups?.find((g) => i >= g.from && i <= g.to)?.label;
    items.push({ kind: "class", label: `Q ${i}`, topic: "", idx: i, group });
  }
  for (let i = 1; i <= sheet.counts.home; i++)
    items.push({ kind: "home", label: `HT ${i}`, topic: "", idx: i });
  for (const t of sheet.topics)
    for (let i = 1; i <= 10; i++)
      items.push({ kind: "extra", label: `E ${i}`, topic: t, idx: i, group: t });
  return items;
}

export function isDone(status: Status): boolean {
  return status === "solved" || status === "understood";
}

export function computeStats(sheets: Sheet[], progress: ProgressRow[]) {
  const map = new Map<string, ProgressRow>();
  for (const p of progress)
    map.set(`${p.sheetId}|${p.kind}|${p.idx}|${p.topic}`, p);

  const perSheet = new Map<
    number,
    { total: number; done: number; tried: number; solved: number; understood: number; byKind: Record<Kind, { total: number; done: number }> }
  >();
  const perSubject = new Map<string, { total: number; done: number }>();
  const perTopicExtra = new Map<string, { total: number; done: number }>();
  let total = 0, done = 0, tried = 0, solved = 0, understood = 0, flagged = 0;

  for (const sheet of sheets) {
    const s = { total: 0, done: 0, tried: 0, solved: 0, understood: 0, byKind: { worked: { total: 0, done: 0 }, class: { total: 0, done: 0 }, home: { total: 0, done: 0 }, extra: { total: 0, done: 0 } } };
    for (const it of sheetItems(sheet)) {
      const row = map.get(`${sheet.id}|${it.kind}|${it.idx}|${it.topic}`);
      s.total++;
      s.byKind[it.kind].total++;
      if (row?.flagged) flagged++;
      if (row && isDone(row.status)) {
        s.done++;
        s.byKind[it.kind].done++;
        if (row.status === "solved") s.solved++;
        else s.understood++;
      } else if (row && row.status === "tried") {
        s.tried++;
      }
    }
    perSheet.set(sheet.id, s);
    const sub = perSubject.get(sheet.subject) ?? { total: 0, done: 0 };
    sub.total += s.total;
    sub.done += s.done;
    perSubject.set(sheet.subject, sub);
    for (const t of sheet.topics) {
      const key = `${sheet.id}|${t}`;
      perTopicExtra.set(key, { total: 10, done: 0 });
    }
    // fill extra done
    for (const it of sheetItems(sheet)) {
      if (it.kind !== "extra") continue;
      const row = map.get(`${sheet.id}|extra|${it.idx}|${it.topic}`);
      const e = perTopicExtra.get(`${sheet.id}|${it.topic}`)!;
      if (row && isDone(row.status)) e.done++;
    }
    total += s.total; done += s.done; tried += s.tried; solved += s.solved; understood += s.understood;
  }

  // activity by day (for streak + heatmap)
  const byDay = new Map<string, number>();
  for (const p of progress) {
    if (!isDone(p.status)) continue;
    const d = p.updatedAt.slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }

  // streak: consecutive days ending today or yesterday
  let streak = 0;
  const day = (dt: Date) => dt.toISOString().slice(0, 10);
  const cursor = new Date();
  if (!byDay.has(day(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (byDay.has(day(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    total, done, tried, solved, understood, flagged,
    percent: total ? Math.round((done / total) * 100) : 0,
    perSheet: Object.fromEntries(perSheet),
    perSubject: Object.fromEntries(perSubject),
    perTopicExtra: Object.fromEntries(perTopicExtra),
    byDay: Object.fromEntries(byDay),
    streak,
    remaining: total - done,
  };
}

export type Stats = ReturnType<typeof computeStats>;
