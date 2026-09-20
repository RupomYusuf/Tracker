"use client";

import { useEffect, useRef, useState } from "react";
import { Kind, STATUS_ORDER, Status } from "@/lib/model";

export const STATUS_COLOR: Record<Status, string> = {
  none: "#4b5563",
  tried: "#fbbf24",
  solved: "#38bdf8",
  understood: "#34d399",
};

export function ProgressRing({
  percent,
  size = 150,
  label,
  sub,
}: {
  percent: number;
  size?: number;
  label?: string;
  sub?: string;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-mono">{label ?? `${percent}%`}</span>
        {sub && <span className="text-xs text-zinc-400 mt-0.5">{sub}</span>}
      </div>
    </div>
  );
}

export function Bar({
  value,
  total,
  color = "#34d399",
  height = 6,
}: {
  value: number;
  total: number;
  color?: string;
  height?: number;
}) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="w-full rounded-full bg-white/8 overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: color, transition: "width 0.4s ease" }}
      />
    </div>
  );
}

export function Chip({
  label,
  status,
  flagged,
  onCycle,
  onFlag,
  pop,
}: {
  label: string;
  status: Status;
  flagged: boolean;
  onCycle: () => void;
  onFlag: () => void;
  pop?: boolean;
}) {
  // long-press (or right-click) toggles the revisit flag; a plain tap cycles status
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longFired = useRef(false);
  const tapHandled = useRef(false);

  const start = () => {
    longFired.current = false;
    tapHandled.current = false;
    timer.current = setTimeout(() => {
      longFired.current = true;
      tapHandled.current = true;
      onFlag();
    }, 500);
  };
  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return; // handled via mousedown/click below
    start();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    cancel();
    if (!longFired.current) {
      tapHandled.current = true;
      onCycle();
    }
  };

  return (
    <button
      title={`${label} — tap to cycle: Tried → Solved → Understood. Long-press to flag for revisit.`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        onFlag();
      }}
      onClick={() => {
        if (tapHandled.current) {
          tapHandled.current = false;
          return;
        }
        onCycle();
      }}
      className={`relative chip chip-${status} ${flagged ? "chip-flagged" : ""} ${pop ? "chip-pop" : ""} rounded-md px-1.5 py-1 text-[11px] font-mono leading-none min-w-[38px]`}
    >
      {label}
      {flagged && <span className="absolute -top-1 -right-1 text-rose-400 text-[9px] leading-none">●</span>}
    </button>
  );
}

export function KindBar({
  kindLabel,
  done,
  total,
  color,
}: {
  kindLabel: string;
  done: number;
  total: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-zinc-400">{kindLabel}</span>
      <div className="flex-1">
        <Bar value={done} total={total} color={color} />
      </div>
      <span className="w-14 text-right font-mono text-zinc-300">
        {done}/{total}
      </span>
    </div>
  );
}

export function Heatmap({ byDay }: { byDay: Record<string, number> }) {
  const weeks = 18;
  const today = new Date();
  const days: { date: string; count: number }[] = [];
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1) - ((start.getDay() + 6) % 7));
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: byDay[key] ?? 0 });
  }
  const max = Math.max(4, ...days.map((d) => d.count));
  const shade = (n: number) =>
    n === 0
      ? "rgba(255,255,255,0.06)"
      : n / max < 0.34
        ? "rgba(52,211,153,0.35)"
        : n / max < 0.67
          ? "rgba(52,211,153,0.6)"
          : "#34d399";
  return (
    <div className="flex gap-[3px] overflow-x-auto pb-1">
      {Array.from({ length: weeks }).map((_, w) => (
        <div key={w} className="flex flex-col gap-[3px]">
          {days.slice(w * 7, w * 7 + 7).map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.count} problem${d.count === 1 ? "" : "s"} cleared`}
              className="w-[11px] h-[11px] rounded-[3px]"
              style={{ background: shade(d.count) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export const KIND_COLORS: Record<Kind, string> = {
  worked: "#8b5cf6",
  class: "#38bdf8",
  home: "#fbbf24",
  extra: "#34d399",
};

export function LoginGate({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0d14]/90 backdrop-blur">
      <form
        className="glass rounded-2xl p-8 w-[320px] rise"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr("");
          const res = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          setBusy(false);
          if (res.ok) onDone();
          else setErr("Wrong access code");
        }}
      >
        <h1 className="text-xl font-bold mb-1">
          <span className="grad-text">IBA MBA</span> Tracker
        </h1>
        <p className="text-sm text-zinc-400 mb-5">Enter your access code to sync progress.</p>
        <input
          autoFocus
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 mb-3 outline-none focus:border-emerald-400/60 font-mono"
        />
        {err && <p className="text-rose-400 text-xs mb-3">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-violet-500 text-black font-semibold py-2 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}

export const NEXT_STATUS: Record<Status, Status> = {
  none: "tried",
  tried: "solved",
  solved: "understood",
  understood: "none",
};

export { STATUS_ORDER };
