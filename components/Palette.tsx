"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { VIEWS, type ViewId } from "./Rail";
import type { Scored } from "@/lib/score";

type Cmd = { label: string; hint: string; run: () => void };

/** ⌘K / Ctrl-K: jump to a view, or open a space straight from anywhere. */
export default function Palette({
  spaces, onView, onSelect,
}: { spaces: Scored[]; onView: (v: ViewId) => void; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setOpen((v) => !v); setQ(""); setI(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const cmds: Cmd[] = useMemo(() => [
    ...VIEWS.map(([id, label]) => ({
      label, hint: "view", run: () => onView(id),
    })),
    ...spaces.map((s) => ({
      label: s.label,
      hint: s.passes ? "cleared" : "rejected · " + s.failed[0].split("_")[0],
      run: () => { onView("prioritise"); onSelect(s.id); },
    })),
  ], [spaces, onView, onSelect]);

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? cmds.filter((c) => c.label.toLowerCase().includes(t)) : cmds).slice(0, 8);
  }, [q, cmds]);

  if (!open) return null;

  const go = (c: Cmd | undefined) => { if (!c) return; c.run(); setOpen(false); };

  return (
    <div className="scrim" onClick={() => setOpen(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef} value={q} placeholder="Jump to a view, or open an opportunity space…"
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(v + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(v - 1, 0)); }
            if (e.key === "Enter") go(hits[i]);
          }}
        />
        <div style={{ padding: "6px 0 8px" }}>
          {hits.length === 0 && (
            <div style={{ padding: "10px 18px", fontSize: 13, color: "var(--muted)" }}>No match.</div>
          )}
          {hits.map((c, k) => (
            <div key={c.label} className="opt" data-on={k === i ? "1" : "0"}
                 onMouseEnter={() => setI(k)} onClick={() => go(c)}>
              <span className="idx">{String(k + 1).padStart(2, "0")}</span>
              {c.label}
              <span className="hint">{c.hint}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
