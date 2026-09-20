import fs from "fs";
import path from "path";
import { SEED_SHEETS, SeedSheet } from "./seed-data";
import { Kind, Sheet, State, Status } from "./model";

// ---------------------------------------------------------------------------
// Persistence layer. Uses Postgres (DATABASE_URL) when available — that is the
// production mode on Vercel. Otherwise falls back to a local JSON file so the
// app runs and can be previewed without any database.
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "state.json");

type FileState = { sheets: DbSheet[]; progress: DbProgress[]; nextId: number };

type DbSheet = {
  id: number;
  subject: string;
  lecture: number;
  title: string;
  topics: string[];
  counts: Sheet["counts"];
  meta: Sheet["meta"];
  created_at?: string;
};

type DbProgress = {
  sheet_id: number;
  kind: Kind;
  idx: number;
  topic: string;
  status: Status;
  flagged: boolean;
  updated_at: string;
};

function toSheet(s: DbSheet): Sheet {
  return {
    id: s.id,
    subject: s.subject,
    lecture: s.lecture,
    title: s.title,
    topics: s.topics ?? [],
    counts: s.counts,
    meta: s.meta ?? {},
    createdAt: s.created_at,
  };
}

function seedItems(sheet: SeedSheet) {
  return { worked: sheet.worked, class: sheet.class, home: sheet.home };
}

// --------------------------- file-backed store -----------------------------

let fileState: FileState | null = null;

function loadFile(): FileState {
  if (fileState) return fileState;
  try {
    fileState = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return fileState!;
  } catch {
    /* fall through */
  }
  const state: FileState = { sheets: [], progress: [], nextId: 1 };
  for (const seed of SEED_SHEETS) {
    state.sheets.push({
      id: state.nextId++,
      subject: seed.subject,
      lecture: seed.lecture,
      title: seed.title,
      topics: seed.topics,
      counts: seedItems(seed),
      meta: (seed.meta as Sheet["meta"]) ?? {},
      created_at: new Date().toISOString(),
    });
  }
  fileState = state;
  saveFile();
  return state;
}

function saveFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(fileState));
}

// --------------------------- postgres-backed store -------------------------

// Uses Neon's HTTP driver for *.neon.tech databases (no TCP/TLS/auth handshake
// per serverless invocation — one fetch per query), and pg for everything else.
type QueryFn = (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

let queryFn: QueryFn | null = null;

function q(): QueryFn {
  if (queryFn) return queryFn;
  const url = process.env.DATABASE_URL!;
  if (/neon\.tech/.test(url)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { neon } = require("@neondatabase/serverless");
    const sql = neon(url);
    queryFn = async (text, params = []) => ({ rows: await sql.query(text, params) });
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    const pool = new Pool({
      connectionString: url,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
      max: 3,
    });
    queryFn = (text, params) => pool.query(text, params);
  }
  return queryFn;
}

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS sheets (
    id SERIAL PRIMARY KEY,
    subject TEXT NOT NULL,
    lecture INT NOT NULL,
    title TEXT NOT NULL,
    topics JSONB NOT NULL DEFAULT '[]',
    counts JSONB NOT NULL DEFAULT '{}',
    meta JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS progress (
    sheet_id INT NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    idx INT NOT NULL,
    topic TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'none',
    flagged BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sheet_id, kind, idx, topic)
  )`,
];

let schemaReady: Promise<void> | null = null;

function ensureSchemaPg() {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const stmt of SCHEMA_SQL) await q()(stmt);
      const { rows } = await q()("SELECT COUNT(*)::int AS n FROM sheets");
      if (rows[0].n === 0) {
        for (const seed of SEED_SHEETS) {
          await q()(
            `INSERT INTO sheets (subject, lecture, title, topics, counts, meta)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              seed.subject,
              seed.lecture,
              seed.title,
              JSON.stringify(seed.topics),
              JSON.stringify(seedItems(seed)),
              JSON.stringify(seed.meta ?? {}),
            ]
          );
        }
      }
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

// ------------------------------- public API --------------------------------

export function usePostgres(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function getState(): Promise<State> {
  if (!usePostgres()) {
    const st = loadFile();
    return {
      sheets: st.sheets.map(toSheet),
      progress: st.progress.map((p) => ({
        sheetId: p.sheet_id,
        kind: p.kind,
        idx: p.idx,
        topic: p.topic,
        status: p.status,
        flagged: p.flagged,
        updatedAt: p.updated_at,
      })),
    };
  }
  await ensureSchemaPg();
  const sheetRows = await q()(
    "SELECT id, subject, lecture, title, topics, counts, meta, created_at FROM sheets ORDER BY subject, lecture, id"
  );
  const progressRows = await q()(
    "SELECT sheet_id, kind, idx, topic, status, flagged, updated_at FROM progress"
  );
  return {
    sheets: sheetRows.rows.map((r: Record<string, unknown>) => ({
      id: Number(r.id),
      subject: String(r.subject),
      lecture: Number(r.lecture),
      title: String(r.title),
      topics: r.topics as Sheet["topics"],
      counts: r.counts as Sheet["counts"],
      meta: r.meta as Sheet["meta"],
      createdAt: r.created_at ? String(r.created_at) : undefined,
    })),
    progress: progressRows.rows.map((r: Record<string, unknown>) => ({
      sheetId: Number(r.sheet_id),
      kind: String(r.kind) as Kind,
      idx: Number(r.idx),
      topic: String(r.topic ?? ""),
      status: String(r.status) as Status,
      flagged: Boolean(r.flagged),
      updatedAt: new Date(String(r.updated_at)).toISOString(),
    })),
  };
}

export type ProgressInput = {
  sheetId: number;
  kind: Kind;
  idx: number;
  topic?: string;
  status: Status;
  flagged?: boolean;
};

export async function setProgress(input: ProgressInput): Promise<void> {
  const topic = input.topic ?? "";
  if (!usePostgres()) {
    const st = loadFile();
    const row = st.progress.find(
      (p) => p.sheet_id === input.sheetId && p.kind === input.kind && p.idx === input.idx && p.topic === topic
    );
    const empty = input.status === "none" && !input.flagged;
    if (row) {
      if (empty) st.progress = st.progress.filter((p) => p !== row);
      else {
        row.status = input.status;
        row.flagged = input.flagged ?? row.flagged;
        row.updated_at = new Date().toISOString();
      }
    } else if (!empty) {
      st.progress.push({
        sheet_id: input.sheetId,
        kind: input.kind,
        idx: input.idx,
        topic,
        status: input.status,
        flagged: input.flagged ?? false,
        updated_at: new Date().toISOString(),
      });
    }
    saveFile();
    return;
  }
  await ensureSchemaPg();
  const empty = input.status === "none" && !input.flagged;
  if (empty) {
    await q()(
      "DELETE FROM progress WHERE sheet_id=$1 AND kind=$2 AND idx=$3 AND topic=$4",
      [input.sheetId, input.kind, input.idx, topic]
    );
  } else {
    await q()(
      `INSERT INTO progress (sheet_id, kind, idx, topic, status, flagged, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (sheet_id, kind, idx, topic)
       DO UPDATE SET status=$5, flagged=$6, updated_at=now()`,
      [input.sheetId, input.kind, input.idx, topic, input.status, input.flagged ?? false]
    );
  }
}

export type NewSheetInput = {
  subject: string;
  lecture: number;
  title: string;
  topics: string[];
  worked: number;
  class: number;
  home: number;
  meta?: Sheet["meta"];
};

export async function createSheet(input: NewSheetInput): Promise<Sheet> {
  const counts = { worked: input.worked, class: input.class, home: input.home };
  const meta = input.meta ?? {};
  if (!usePostgres()) {
    const st = loadFile();
    const sheet: DbSheet = {
      id: st.nextId++,
      subject: input.subject,
      lecture: input.lecture,
      title: input.title,
      topics: input.topics,
      counts,
      meta,
      created_at: new Date().toISOString(),
    };
    st.sheets.push(sheet);
    saveFile();
    return toSheet(sheet);
  }
  await ensureSchemaPg();
  const { rows } = await q()(
    `INSERT INTO sheets (subject, lecture, title, topics, counts, meta)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
    [input.subject, input.lecture, input.title, JSON.stringify(input.topics), JSON.stringify(counts), JSON.stringify(meta)]
  );
  return {
    id: Number(rows[0].id),
    subject: input.subject,
    lecture: input.lecture,
    title: input.title,
    topics: input.topics,
    counts,
    meta,
    createdAt: rows[0].created_at ? String(rows[0].created_at) : undefined,
  };
}

export async function deleteSheet(id: number): Promise<void> {
  if (!usePostgres()) {
    const st = loadFile();
    st.sheets = st.sheets.filter((s) => s.id !== id);
    st.progress = st.progress.filter((p) => p.sheet_id !== id);
    saveFile();
    return;
  }
  await ensureSchemaPg();
  await q()("DELETE FROM progress WHERE sheet_id=$1", [id]);
  await q()("DELETE FROM sheets WHERE id=$1", [id]);
}
