"use client";

import type { PillarWeights } from "@/lib/score";

export type ViewId = "diagnosis" | "prioritise" | "screens" | "validation" | "money" | "ask";

export const VIEWS: [ViewId, string][] = [
  ["diagnosis", "The diagnosis"],
  ["prioritise", "Prioritise"],
  ["screens", "The five screens"],
  ["validation", "Does it work?"],
  ["money", "The money"],
  ["ask", "Ask the agent"],
];

const PILLAR_LABEL: [keyof PillarWeights, string][] = [
  ["market_attractiveness", "Attractiveness"],
  ["future_potential", "Future potential"],
  ["competitive_headroom", "Comp. intensity"],
  ["right_to_win", "Right to win"],
];

/**
 * The left rail carries the model's live state, not just links. A reader can move a
 * weight on one view and watch the shortlist count hold on every other — which is the
 * single claim the deck can only assert.
 */
export default function Rail({
  view, onView, weights, cleared, total, dirty,
}: {
  view: ViewId;
  onView: (v: ViewId) => void;
  weights: PillarWeights;
  cleared: number;
  total: number;
  dirty: boolean;
}) {
  return (
    <aside className="rail">
      <div className="brand">
        <div className="mark"><span className="dot" /> CARDIO-PRIORITISER</div>
        <div className="sub">Cipla Ascend S4 · Cardiac</div>
      </div>

      <nav className="nav">
        {VIEWS.map(([id, label], i) => (
          <button key={id} data-on={view === id ? "1" : "0"} onClick={() => onView(id)}>
            <span className="idx">{String(i + 1).padStart(2, "0")}</span>
            {label}
          </button>
        ))}
      </nav>

      <div className="state">
        <h4>Model state · live</h4>
        {PILLAR_LABEL.map(([k, label]) => (
          <div className="wrow" key={k}>
            <div className="lab">{label}<b>{Math.round(weights[k] * 100)}%</b></div>
            <div className="wbar"><i style={{ width: `${weights[k] * 100 * 2.6}%` }} /></div>
          </div>
        ))}
        <div className="verdict">
          <b>{cleared} of {total}</b> spaces clear all five screens
          <div style={{ marginTop: 4, color: dirty ? "var(--teal-hi)" : undefined }}>
            {dirty ? "weights moved — membership unchanged" : "shipped weights"}
          </div>
        </div>
      </div>

      <div className="foot-note">
        Scoring runs in your browser and is asserted against the Python agent
        (<code>npm run verify</code>). Press <span className="kbd">⌘K</span> to jump or ask.
      </div>
    </aside>
  );
}
