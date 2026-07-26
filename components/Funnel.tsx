"use client";

import type { Scored } from "@/lib/score";
import model from "@/data/model.json";

const META: Record<string, { title: string; plain: string }> = {
  S1_MATERIALITY: {
    title: "Materiality",
    plain: "Big enough that winning changes anything. A 90% growth rate on a ₹20 Cr base does not beat 20% on ₹900 Cr, so the gate is on the absolute rupees of growth, not the percentage.",
  },
  S2_REAL_DEMAND: {
    title: "Real demand",
    plain: "Growth must be patients, not price. Constant-price MAT strips the pricing out; anything growing slower than the market in real terms is a harvest asset, however large.",
  },
  S3_WINNABILITY: {
    title: "Winnability",
    plain: "Attractive never overrides winnable. A space qualifies either because Cipla already holds position, or because it is one adjacency step from a franchise it owns.",
  },
  S4_DURABILITY: {
    title: "Durability",
    plain: "No value traps. Price control, originator exclusivity or guidelines turning against the molecule inside the horizon all disqualify.",
  },
  S5_CAPABILITY: {
    title: "Capability",
    plain: "Nothing that needs a capability Cipla cannot build within this franchise in three to five years.",
  },
};

const ORDER = ["S1_MATERIALITY", "S2_REAL_DEMAND", "S3_WINNABILITY", "S4_DURABILITY", "S5_CAPABILITY"];
const RULE: Record<string, string> = Object.fromEntries(
  (model.screens as { id: string; rule: string }[]).map((s) => [s.id, s.rule]),
);
/** the "Resolves: …" clause the config carries for the screens that settle a trade-off */
const RESOLVES: Record<string, string> = Object.fromEntries(
  (model.screens as { id: string; rationale: string }[]).map((s) => {
    const i = s.rationale.indexOf("Resolves:");
    return [s.id, i === -1 ? "" : s.rationale.slice(i + "Resolves:".length).trim()];
  }),
);

/**
 * The screens as an actual funnel. A table can say five spaces cleared; only this can
 * show *where* each of the other six died, and that the order matters — a space killed
 * at S2 was never judged on whether Cipla could win it.
 */
export default function Funnel({
  spaces, onSelect,
}: { spaces: Scored[]; onSelect: (id: string) => void }) {
  let alive = [...spaces];

  const gates = ORDER.map((id) => {
    const entering = alive.length;
    const dropped = alive.filter((s) => s.failed.includes(id));
    alive = alive.filter((s) => !s.failed.includes(id));
    return { id, entering, dropped, surviving: alive.length };
  });

  return (
    <div className="funnel">
      <div className="gate">
        <div className="spine"><div className="node">{spaces.length}</div><div className="stem" /></div>
        <div className="body">
          <div className="title">All opportunity spaces</div>
          <div className="why">
            Eleven clusters built from 7,452 SKU rows by molecule, combination and treatment
            archetype — then put through five gates in a fixed order. A space eliminated early is
            never judged on the later tests, which is the point: nothing attractive gets waved
            through on a technicality further down.
          </div>
          <div className="dropped">
            {spaces.map((s) => (
              <button key={s.id} className="chip" onClick={() => onSelect(s.id)}>{s.label}</button>
            ))}
          </div>
        </div>
      </div>

      {gates.map((g, i) => (
        <div key={g.id} className={"gate" + (g.dropped.length ? " kill" : "")}>
          <div className="spine">
            <div className="node">{g.dropped.length ? `−${g.dropped.length}` : "✓"}</div>
            <div className="stem" />
          </div>
          <div className="body">
            <div className="title">
              S{i + 1} · {META[g.id].title}
              <span className="rule">{RULE[g.id]}</span>
            </div>
            <div className="why">
              {META[g.id].plain}
              {RESOLVES[g.id] && (
                <>
                  {" "}
                  <b style={{ color: "var(--ink)" }}>Trade-off resolved:</b>{" "}
                  <i>{RESOLVES[g.id].replace(/\s+/g, " ")}</i>
                </>
              )}
            </div>
            {g.dropped.length > 0 ? (
              <>
                <div className="survivors">
                  Eliminated here — {g.dropped.length} of the {g.entering} still standing
                </div>
                <div className="dropped">
                  {g.dropped.map((s) => (
                    <button key={s.id} className="chip out" onClick={() => onSelect(s.id)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="survivors">Nothing eliminated here — all {g.entering} clear this gate</div>
            )}
          </div>
        </div>
      ))}

      <div className="gate end">
        <div className="spine"><div className="node">{alive.length}</div></div>
        <div className="body">
          <div className="title">Cleared every gate</div>
          <div className="why">
            The score ranks these; the screens decide who is in the room at all. That ordering is
            what stops the market&apos;s largest pool from buying its way onto the shortlist.
          </div>
          <div className="dropped">
            {alive.map((s) => (
              <button key={s.id} className="chip in" onClick={() => onSelect(s.id)}>{s.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
