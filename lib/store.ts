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

// Lazy require so the app also builds/runs without a DATABASE_URL.
function getPool() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg");
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")
      ? false
      : { rejectUnauthorized: false },
    max: 3,
  });
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sheets (
  id SERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  lecture INT NOT NULL,
  title TEXT NOT NULL,
  topics JSONB NOT NULL DEFAULT '[]',
  counts JSONB NOT NULL DEFAULT '{}',
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS progress (
  sheet_id INT NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  idx INT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'none',
  flagged BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sheet_id, kind, idx, topic)
);
`;

let schemaReady: Promise<void> | null = null;

function ensureSchemaPg() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const pool = getPool();
      await pool.query(SCHEMA_SQL);
      const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM sheets");
      if (rows[0].n === 0) {
        for (const seed of SEED_SHEETS) {
          const { rows } = await pool.query(
            `INSERT INTO sheets (subject, lecture, title, topics, counts, meta)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
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
  const pool = getPool();
  const sheetRows = await pool.query(
    "SELECT id, subject, lecture, title, topics, counts, meta, created_at FROM sheets ORDER BY subject, lecture, id"
  );
  const progressRows = await pool.query(
    "SELECT sheet_id, kind, idx, topic, status, flagged, updated_at FROM progress"
  );
  return {
    sheets: sheetRows.rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      subject: r.subject,
      lecture: r.lecture,
      title: r.title,
      topics: r.topics,
      counts: r.counts,
      meta: r.meta,
      createdAt: r.created_at,
    })),
    progress: progressRows.rows.map((r: Record<string, unknown>) => ({
      sheetId: r.sheet_id,
      kind: r.kind,
      idx: r.idx,
      topic: r.topic,
      status: r.status,
      flagged: r.flagged,
      updatedAt: r.updated_at,
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
  const pool = getPool();
  const empty = input.status === "none" && !input.flagged;
  if (empty) {
    await pool.query(
      "DELETE FROM progress WHERE sheet_id=$1 AND kind=$2 AND idx=$3 AND topic=$4",
      [input.sheetId, input.kind, input.idx, topic]
    );
  } else {
    await pool.query(
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
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO sheets (subject, lecture, title, topics, counts, meta)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
    [input.subject, input.lecture, input.title, JSON.stringify(input.topics), JSON.stringify(counts), JSON.stringify(meta)]
  );
  return {
    id: rows[0].id,
    subject: input.subject,
    lecture: input.lecture,
    title: input.title,
    topics: input.topics,
    counts,
    meta,
    createdAt: rows[0].created_at,
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
  const pool = getPool();
  await pool.query("DELETE FROM progress WHERE sheet_id=$1", [id]);
  await pool.query("DELETE FROM sheets WHERE id=$1", [id]);
}
