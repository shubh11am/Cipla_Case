"use client";

import type { Scored, PillarWeights } from "@/lib/score";
import { fmtCr, pct } from "@/lib/score";

const SCREEN_TEXT: Record<string, string> = {
  S1_MATERIALITY: "Too small to move the needle (needs ≥ ₹150 Cr pool and ≥ ₹15 Cr growth pool)",
  S2_REAL_DEMAND: "Growth is price, not patients — real growth trails the market",
  S3_WINNABILITY: "Attractive, but Cipla has no position and no adjacency",
  S4_DURABILITY: "A value trap — price control, exclusivity, or guidelines turning against it",
  S5_CAPABILITY: "Needs a capability Cipla cannot build inside the horizon",
};

/** The `--explain` command, as a panel: every pillar, every screen, every sourced signal. */
export default function SpaceDetail({ s, pillars }: { s: Scored; pillars: PillarWeights }) {
  const pillarRows: [string, number, number][] = [
    ["Market attractiveness", s.market_attractiveness, pillars.market_attractiveness],
    ["Future potential", s.future_potential, pillars.future_potential],
    ["Competitive intensity", s.competitive_headroom, pillars.competitive_headroom],
    ["Right to win · strategic fit", s.right_to_win, pillars.right_to_win],
  ];

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 15, marginBottom: 2 }}>{s.label}</h3>
          <div style={{ fontSize: 11.5, color: "var(--grey)" }}>
            {s.archetype}{s.prescriber ? ` · ${s.prescriber}` : ""}
          </div>
        </div>
        <span className={"pill " + (s.passes ? "pass" : "fail")}>
          {s.passes ? "CLEARED ALL SCREENS" : "REJECTED"}
        </span>
      </div>

      {/* economics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(118px,1fr))", gap: 10, margin: "14px 0" }}>
        {([
          ["Pool", fmtCr(s.mat_t2), undefined],
          ["Value growth", pct(s.value_growth), undefined],
          ["of which price", pct(s.price_growth), "var(--grey)"],
          ["REAL growth", pct(s.real_growth), s.real_growth >= 6.26 ? "var(--teal)" : "var(--red)"],
          ["Volume", pct(s.volume_growth), undefined],
          ["Cipla share", s.cipla_share.toFixed(2) + "%", undefined],
        ] as [string, string, string | undefined][]).map(([k, v, c]) => (
          <div key={k}>
            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{k}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: c ?? "var(--ink)" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* competitive structure */}
      <div className="note" style={{ marginBottom: 14 }}>
        <b>Competitive structure.</b> {s.n_companies} companies, {s.n_brands} brands, HHI {Math.round(s.hhi).toLocaleString()}.
        Leader <b>{s.leader}</b> at {s.leader_share.toFixed(0)}%.
        Cipla is {s.cipla_rank ? `#${Math.round(s.cipla_rank)}` : "absent"} with {fmtCr(s.cipla_t2)},
        {" "}adjacency {s.adjacency.toFixed(2)} and brand-extension {s.brand_extension.toFixed(2)}.
      </div>

      {/* score decomposition */}
      <h3 style={{ marginTop: 6 }}>Score decomposition</h3>
      <table>
        <tbody>
          {pillarRows.map(([name, val, w]) => (
            <tr key={name}>
              <td style={{ width: "40%" }}>{name}</td>
              <td style={{ width: "44%" }}>
                <div style={{ background: "#eef2f6", height: 7, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, val))}%`, height: "100%", background: "var(--ink)" }} />
                </div>
              </td>
              <td className="num" style={{ width: "16%" }}>
                {val.toFixed(0)} × {w.toFixed(2)} = <b>{(val * w).toFixed(1)}</b>
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ fontWeight: 700, color: "var(--ink)" }}>Opportunity score</td>
            <td />
            <td className="num" style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>
              {s.opportunity_score.toFixed(1)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* screens */}
      <h3 style={{ marginTop: 16 }}>Screens</h3>
      {s.failed.length === 0 ? (
        <div className="note teal">Passed all five screens.</div>
      ) : (
        s.failed.map((f) => (
          <div className="note" key={f} style={{ marginBottom: 6 }}>
            <b>{f}</b> — {SCREEN_TEXT[f]}
          </div>
        ))
      )}

      {/* signals */}
      <h3 style={{ marginTop: 16 }}>
        External signals applied <span style={{ fontWeight: 400, color: "var(--muted)" }}>
          (net {s.net_external_signal >= 0 ? "+" : ""}{s.net_external_signal.toFixed(2)})
        </span>
      </h3>
      {s.signals.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>None applied.</div>}
      {s.signals.map((sig) => (
        <div key={sig.id} style={{ borderTop: "1px solid #f0f3f6", padding: "9px 0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: sig.dir > 0 ? "var(--teal)" : "var(--red)" }}>
            {sig.dir > 0 ? "▲" : "▼"} {sig.id}
            <span style={{ color: "var(--muted)", fontWeight: 400 }}>
              {"  "}magnitude {sig.mag} · confidence {sig.conf}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#33404f", margin: "3px 0 4px" }}>{sig.label}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)" }}>SOURCE: {sig.source}</div>
        </div>
      ))}
    </div>
  );
}
