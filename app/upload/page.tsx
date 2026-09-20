"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoginGate } from "@/components/ui";

type Detected = {
  subject: string;
  lecture: string;
  title: string;
  topics: string;
  worked: string;
  class: string;
  home: string;
  sets: boolean;
};

function empty(): Detected {
  return { subject: "math", lecture: "", title: "", topics: "", worked: "", class: "", home: "", sets: false };
}

// Best-effort auto-detection from extracted PDF text. The form stays fully
// editable — detection just saves typing.
function detect(text: string): Detected {
  const d = empty();
  const t = text.replace(/\r/g, "");

  // lecture number: "Lecture 10" / "Lecture#10" / "LECTURE 10"
  const lec = t.match(/lecture\s*#?\s*(\d{1,2})/i);
  if (lec) d.lecture = lec[1];

  // subject: math vs analytical
  if (/analytical/i.test(t.slice(0, 3000))) d.subject = "analytical";
  else if (/math/i.test(t.slice(0, 3000))) d.subject = "math";

  // title from overview-ish words on cover: try "Lecture 10 · <Title>" or overview lines
  const titleM =
    t.match(/lecture\s*#?\s*\d+\s*[·:.\-–]\s*([^\n]{4,80})/i) ||
    t.match(/(Percentage[^\n]{0,60})/i);
  if (titleM) d.title = titleM[1].split("–")[0].split("•")[0].trim();

  // topics: sub-topic table entries like "5.1 Profit & Loss" or overview bullets
  const topics = new Set<string>();
  const subRe = /^\s*\d{1,2}\.(\d{1,2})\s+([A-Za-z][^\n]{3,70})/gm;
  let m: RegExpExecArray | null;
  while ((m = subRe.exec(t))) {
    const name = m[2].split(/\s{2,}/)[0].replace(/[.·•]\s*$/, "").trim();
    if (name && !/^(theory|worked|class|home|page)/i.test(name)) topics.add(name);
  }
  if (topics.size === 0) {
    const overview = t.match(/overview\s*:?\s*([\s\S]{0,600})/i);
    if (overview) {
      for (const line of overview[1].split("\n").slice(0, 12)) {
        const clean = line.replace(/[✓✔●○▪☐'"]/g, "").trim();
        if (clean.length > 3 && clean.length < 60 && /[a-z]/i.test(clean)) topics.add(clean);
      }
    }
  }
  d.topics = [...topics].slice(0, 12).join("\n");

  // worked examples: highest "Ex-N"
  let max = 0;
  for (const mm of t.matchAll(/ex[-.\s]?(?:ample\s*)?(\d{1,3})/gi)) max = Math.max(max, Number(mm[1]));
  d.worked = max ? String(max) : "";

  // sections: split by headers, find highest numbered question after each
  const sectionMax = (header: string, until?: string) => {
    const re = new RegExp(header, "i");
    const h = re.exec(t);
    if (!h) return "";
    const start = h.index + h[0].length;
    const endIdx = until ? t.slice(start).search(new RegExp(until, "i")) : -1;
    const seg = endIdx >= 0 ? t.slice(start, start + endIdx) : t.slice(start);
    let hi = 0;
    for (const mm of seg.matchAll(/^\s*(\d{1,3})\s*[.)]/gm)) hi = Math.max(hi, Number(mm[1]));
    return hi ? String(hi) : "";
  };
  d.class = sectionMax("class\\s+practice\\s+(test|questions)?");
  d.home = sectionMax("home\\s+task", "home\\s+task\\s+(answer|check)");
  // analytical sets: "Problem: 01" / "Set: 01"
  const sets = [...t.matchAll(/(?:problem|set)\s*:\s*(\d{1,2})/gi)].map((x) => Number(x[1]));
  if (sets.length) {
    d.sets = true;
    d.class = d.class || String(Math.max(...sets));
  }
  return d;
}

export default function UploadPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [form, setForm] = useState<Detected>(empty());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  if (authed === false) return <LoginGate onDone={() => setAuthed(true)} />;

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.authed)))
      .catch(() => setAuthed(false));
  }, []);

  const set = (k: keyof Detected, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onFile = async (file: File) => {
    setBusy(true);
    setStatus("Reading PDF…");
    setFileName(file.name);
    setPreviews([]);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      let text = "";
      for (let i = 0; i < doc.numPages; i++) {
        const page = await doc.getPage(i + 1);
        const content = await page.getTextContent();
        text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
        setStatus(`Reading PDF… page ${i + 1}/${doc.numPages}`);
      }
      // preview the first pages (works for scanned sheets too)
      const urls: string[] = [];
      for (let i = 0; i < Math.min(3, doc.numPages); i++) {
        const page = await doc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 1.1 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
        urls.push(canvas.toDataURL("image/jpeg", 0.85));
      }
      setPreviews(urls);
      const d = detect(text);
      if (!d.lecture) {
        const fn = file.name.match(/(\d{1,2})/g);
        if (fn) d.lecture = fn[fn.length - 1];
      }
      if (!d.title) d.title = file.name.replace(/\.pdf$/i, "").replace(/lecture\s*\d+/i, "").trim() || "New Sheet";
      setForm(d);
      setStatus(
        text.trim().length < 100
          ? "Scanned sheet — preview below. Read the cover & counts and fill the form."
          : "Detected from PDF — review and fix anything wrong, then save."
      );
    } catch (e) {
      setStatus("Could not read the PDF. Fill the form manually.");
      console.error(e);
    }
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    setStatus("Saving…");
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: form.subject,
        lecture: Number(form.lecture || 0),
        title: form.title || "Untitled Sheet",
        topics: form.topics.split("\n").map((x) => x.trim()).filter(Boolean),
        worked: Number(form.worked || 0),
        class: Number(form.class || 0),
        home: Number(form.home || 0),
        meta: form.sets ? { display: "sets" } : {},
      }),
    });
    setBusy(false);
    if (res.ok) {
      const { sheet } = await res.json();
      router.push(`/sheet/${sheet.id}`);
    } else {
      setStatus(res.status === 401 ? "Locked — enter access code first." : "Failed to save. Try again.");
    }
  };

  const field = "w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 outline-none focus:border-emerald-400/60";
  const label = "text-xs text-zinc-400 mb-1 block";

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-24">
      <header className="py-6">
        <a href="/" className="text-xs text-zinc-500 hover:text-emerald-300">
          ← Dashboard
        </a>
        <h1 className="text-2xl font-extrabold mt-1">
          Upload a <span className="grad-text">lecture sheet</span>
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Drop the PDF — the tracker reads it and pre-fills the counts. Review, adjust, save. Every topic gets 10 extra problems automatically.
        </p>
      </header>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && f.name.toLowerCase().endsWith(".pdf")) onFile(f);
        }}
        onClick={() => fileRef.current?.click()}
        className="glass rounded-2xl border-dashed border-white/15 p-10 text-center cursor-pointer hover:border-emerald-400/50 transition-colors mb-6"
      >
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <div className="text-3xl mb-2">📄</div>
        <p className="text-sm text-zinc-300">{fileName || "Click or drop a PDF here"}</p>
        <p className="text-[11px] text-zinc-500 mt-1">Parsing happens in your browser — the PDF never leaves your device.</p>
      </div>

      {status && <p className="text-xs text-emerald-300/90 mb-4">{status}</p>}

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`Page ${i + 1} preview`}
              className="rounded-xl border border-white/10 w-full"
            />
          ))}
        </div>
      )}

      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Subject</label>
            <select value={form.subject} onChange={(e) => set("subject", e.target.value)} className={field}>
              <option value="math">Math</option>
              <option value="analytical">Analytical Ability</option>
              <option value="english">English</option>
              <option value="writing">Writing</option>
            </select>
          </div>
          <div>
            <label className={label}>Lecture number</label>
            <input value={form.lecture} onChange={(e) => set("lecture", e.target.value)} className={`${field} font-mono`} placeholder="e.g. 10" />
          </div>
        </div>
        <div>
          <label className={label}>Title</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} className={field} placeholder="e.g. Geometry" />
        </div>
        <div>
          <label className={label}>Topics — one per line (each gets 10 extra problems)</label>
          <textarea
            value={form.topics}
            onChange={(e) => set("topics", e.target.value)}
            rows={5}
            className={`${field} font-mono text-xs`}
            placeholder={"Circles\nTriangles\nMensuration"}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={label}>Worked examples</label>
            <input value={form.worked} onChange={(e) => set("worked", e.target.value)} className={`${field} font-mono`} placeholder="0" />
          </div>
          <div>
            <label className={label}>Class practice</label>
            <input value={form.class} onChange={(e) => set("class", e.target.value)} className={`${field} font-mono`} placeholder="0" />
          </div>
          <div>
            <label className={label}>Home task</label>
            <input value={form.home} onChange={(e) => set("home", e.target.value)} className={`${field} font-mono`} placeholder="0" />
          </div>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-violet-500 text-black font-semibold py-2.5 disabled:opacity-50"
        >
          {busy ? "Working…" : "Create sheet + start tracking"}
        </button>
      </div>
    </main>
  );
}
