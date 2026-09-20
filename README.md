# IBA MBA Journey Tracker

A dark-themed progress tracker for the Capstone IBA MBA lecture sheets (Math + Analytical Ability), built with Next.js 16 and deployable on Vercel with any Postgres database.

## What it tracks

- **Every problem in every sheet** — Worked Examples (Ex 1…N), Class Practice (Q 1…20), Home Task (Q 1…30)
- **10 extra problems per topic** — auto-generated for every topic listed in a sheet
- **Per-problem statuses** — tap to cycle: `Tried → Solved → Understood` (long-press or right-click to flag for revisit)
- **Dashboard** — overall %, subject progress, day streak, activity heatmap, flagged count
- **PDF upload** — drop a new lecture sheet PDF; it renders the first pages as a preview and auto-fills the form when the PDF has a text layer (scanned sheets are filled manually while reading the preview). Every topic you list gets 10 extra problems automatically.

The 11 sheets provided so far (Math L01–L09, Analytical L01–L02) are pre-seeded automatically — 1,286 trackable problems.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Without a database it uses a local JSON store in `.data/` — perfect for trying it out.

## Deploy on Vercel (production, syncs from any device)

1. Push this folder to a GitHub repo, then import it on [vercel.com/new](https://vercel.com/new) (or run `npx vercel` from this folder).
2. In the Vercel project → **Storage → Create Database → Postgres (Neon)**. The `DATABASE_URL` env var is added automatically. (Any Postgres works — Neon, Supabase, RDS — just set `DATABASE_URL`.)
3. Optional: set `ACCESS_CODE` to a secret phrase so only you can view/edit progress from your devices.
4. Deploy. The database schema and the 11 seeded sheets are created automatically on the first visit. Your progress lives in Postgres, so every device stays in sync.

## Notes

- Statuses are stored per problem in the `progress` table; empty rows mean "not touched".
- "Mark all solved" bulk action exists in each section for post-class catch-up.
- The `Chip` interaction works with mouse (click / right-click) and touch (tap / long-press).
