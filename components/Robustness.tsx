"use client";

import { fmtCr } from "@/lib/score";
import rob from "@/data/robustness.json";

const B = rob.baselines;
const L = rob.leave_one_out;
const T = rob.thresholds;

/** The two claims a judge tests first: does the model survive different weights,
 *  and does it beat the obvious alternative? Both answered with numbers. */
export function RobustnessCards() {
  const models: [string, number, boolean][] = [
    ["Random selection (5,000 draws)", B.random_mean_precision, false],
    ["Rank by pool size", B.naive_size_precision, false],
    ["Composite score, screens removed", B.score_only_precision, false],
    ["Rank by value growth", B.naive_value_growth_precision, false],
    ["CARDIO-PRIORITISER (score + screens)", B.agent_precision, true],
  ];

  return (
    <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
      <div className="panel">
        <h3>Does it beat the obvious alternative?</h3>
        <p style={{ fontSize: 12, color: "var(--grey)", marginTop: 0 }}>
          Every model below was run on the same blind FY25 vintage and scored on the withheld
          year. Precision is the share of its picks that went on to beat the market on real growth.
        </p>
        <table>
          <thead><tr><th>Model, run blind</th><th className="num">Precision</th></tr></thead>
          <tbody>
            {models.map(([name, prec, isAgent]) => (
              <tr key={name} style={{ background: isAgent ? "#f4f9f8" : undefined }}>
                <td style={{ fontWeight: isAgent ? 700 : 400 }}>{name}</td>
                <td className="num" style={{ fontWeight: isAgent ? 700 : 400,
                  color: isAgent ? "var(--teal)" : undefined }}>{prec}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="note" style={{ marginTop: 12 }}>
          <b>The screens are what buy the accuracy.</b> Strip them off and the model still picks
          four of five — the one it wrongly adds is <b>{B.score_only_misses[0]}</b>, the biggest
          pool in the market, which then grew 5.1% real against a 6.3% market. Ranking by value
          growth also scored 100% here, but it has no mechanism to <i>reject</i> a trap; it missed
          that space by luck of ordering, not by rule.
        </div>
      </div>

      <div className="panel">
        <h3>What would actually change the answer?</h3>
        <p style={{ fontSize: 12, color: "var(--grey)", marginTop: 0 }}>
          Not the weights. No screen reads the weighted score, and the pillar weights feed
          nothing else — right-to-win is built from its own sub-weights. So the shortlist is
          invariant to them <b>by construction</b>, which is a proof rather than a 5,000-draw
          sample, and a Monte Carlo over the weights can only ever return 100%. What the
          weights genuinely move is rank order.
        </p>
        <div style={{ display: "flex", gap: 26, margin: "14px 0 16px" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--teal)" }}>
              {T.identical_shortlist_pct}%
            </div>
            <div style={{ fontSize: 11.5, color: "var(--grey)" }}>
              of {T.draws.toLocaleString()} runs with every gate<br />
              jittered ±{T.jitter_pct}% keep the shortlist intact
            </div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)" }}>
              {L.unchanged} of {L.signals_tested}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--grey)" }}>
              external signals can be removed<br />with no change to the shortlist
            </div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Space</th><th className="num">Resilience</th>
              <th>Binding gate</th><th className="num">Move to flip</th>
            </tr>
          </thead>
          <tbody>
            {[...T.per_space]
              .sort((a, b) => Number(b.baseline_pass) - Number(a.baseline_pass) || b.survives_pct - a.survives_pct)
              .map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: r.baseline_pass ? 600 : 400 }}>
                    {r.label.length > 34 ? r.label.slice(0, 32) + "…" : r.label}
                  </td>
                  <td className="num" style={{
                    color: r.survives_pct >= 90 ? "var(--teal)"
                         : r.survives_pct >= 40 ? "var(--amber)" : "var(--faint)",
                    fontWeight: 600,
                  }}>
                    {r.survives_pct}%
                  </td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>{r.binding_gate.replace(/_/g, " ")}</td>
                  <td className="num" style={{ fontSize: 11.5 }}>{r.binding_move_pct.toFixed(0)}%</td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="note" style={{ marginTop: 12 }}>
          <b>The thinnest margin is on Priority 1.</b> Non-statin lipid sits at a capability
          barrier of 0.55 against a 0.60 gate — move S5 by 8% and it drops out, which is why it
          survives only {T.per_space.find((r) => r.id === "LIPID_NONSTATIN")?.survives_pct}% of
          jittered runs. It is the one number here we would want a Cipla operator to challenge,
          because the barrier is a judgement, not a measurement.
        </div>
      </div>
    </div>
  );
}

/** Where ₹773 Cr, ₹577 Cr and ₹55 Cr each come from. */
export function Bridges() {
  const b = rob.bridge;
  return (
    <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
      <div className="panel">
        <h3>Revenue bridge, FY26 → FY31</h3>
        <table>
          <thead><tr><th>Step</th><th className="num">₹ Cr</th><th>Basis</th></tr></thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 700 }}>Cipla cardiac, FY26</td>
              <td className="num" style={{ fontWeight: 700 }}>{Math.round(b.fy26_total)}</td>
              <td>Actual, MAT Feb&apos;26</td>
            </tr>
            {b.increments.map((i) => (
              <tr key={i.space}>
                <td>+ {i.space}</td>
                <td className="num pos">+{Math.round(i.delta)}</td>
                <td style={{ fontSize: 11.5 }}>
                  {i.share_fy26}% → {i.share_fy31}% of a ₹{Math.round(i.pool_fy31).toLocaleString("en-IN")} Cr pool
                </td>
              </tr>
            ))}
            <tr><td>Legacy and remainder</td><td className="num">0</td><td>Held flat — no growth credited</td></tr>
            <tr>
              <td style={{ fontWeight: 700 }}>Cipla cardiac, FY31</td>
              <td className="num" style={{ fontWeight: 700 }}>{Math.round(b.fy31_total)}</td>
              <td>= 1.80% market share</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Contribution bridge, cumulative 5 years</h3>
        <table>
          <tbody>
            <tr>
              <td>Incremental gross profit @ {b.gm_blend}% blended GM</td>
              <td className="num pos" style={{ fontWeight: 700 }}>{fmtCr(b.cum_gross_profit)}</td>
            </tr>
            <tr>
              <td>− Incremental selling cost @ {b.incr_sell_pct}% of incremental sales</td>
              <td className="num">({Math.round(b.cum_selling)})</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>= Net 5-year contribution</td>
              <td className="num pos" style={{ fontWeight: 700 }}>{fmtCr(b.net_contribution)}</td>
            </tr>
            <tr>
              <td style={{ fontStyle: "italic", color: "var(--grey)" }}>of which funded by redeploying legacy spend</td>
              <td className="num">({Math.round(b.funded_by_redeploy)})</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>NEW CASH REQUIRED</td>
              <td className="num" style={{ fontWeight: 700, color: "var(--ink)" }}>{fmtCr(b.new_cash)}</td>
            </tr>
            <tr><td>Implied new MRs</td><td className="num">{Math.round(b.mr_add)}</td></tr>
          </tbody>
        </table>
        <div className="note teal" style={{ marginTop: 12 }}>
          <b>₹{Math.round(b.new_cash)} Cr is a residual, not an assumption</b> — what remains once
          gross profit has paid for selling cost and the legacy book has funded what it can. The
          legacy book absorbs ₹{b.legacy_sell_per_year} Cr/yr today; redeploying half is
          ₹{b.redeployable_per_year} Cr/yr.
        </div>
      </div>
    </div>
  );
}

/** Year-by-year P&L, incremental over FY26. */
export function YearByYear() {
  const rows = rob.bridge.pnl;
  const cell = (v: number, neg = false) =>
    neg ? `(${Math.round(Math.abs(v))})` : Math.round(v).toLocaleString("en-IN");
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3>Year by year, incremental over FY26 (₹ Cr)</h3>
      <table>
        <thead>
          <tr>
            <th></th>
            {rows.map((r) => <th key={r.year} className="num">{r.year}</th>)}
            <th className="num">Cumulative</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ fontWeight: 600 }}>Incremental revenue</td>
            {rows.map((r) => <td key={r.year} className="num">{cell(r.incr_rev)}</td>)}
            <td className="num">—</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Incremental gross profit</td>
            {rows.map((r) => <td key={r.year} className="num">{cell(r.gross_profit)}</td>)}
            <td className="num pos" style={{ fontWeight: 700 }}>{Math.round(rob.bridge.cum_gross_profit)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Incremental selling cost</td>
            {rows.map((r) => <td key={r.year} className="num">{cell(r.selling, true)}</td>)}
            <td className="num">({Math.round(rob.bridge.cum_selling)})</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 700 }}>Net contribution</td>
            {rows.map((r) => <td key={r.year} className="num pos">{cell(r.contribution)}</td>)}
            <td className="num pos" style={{ fontWeight: 700 }}>{Math.round(rob.bridge.net_contribution)}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 11.5, color: "var(--grey)", marginBottom: 0, marginTop: 10 }}>
        Contribution-positive from year one: incremental gross margin ({rob.bridge.gm_blend}%) is
        nearly six times incremental selling cost ({rob.bridge.incr_sell_pct}% of sales). There is no
        payback period to wait out — the binding constraint is execution capacity, not capital.
      </p>
    </div>
  );
}

/** If the incumbents fight back. */
export function CompetitiveResponse() {
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3>If Torrent, Lupin or USV retaliate</h3>
      <p style={{ fontSize: 12.5, color: "var(--grey)", marginTop: 0 }}>
        Every target is a claim on <b>pool growth</b>, not on a competitor&apos;s shelf. Each leader
        can hold share in full and the plan still lands.
      </p>
      <table>
        <thead>
          <tr>
            <th>Space</th><th className="num">Pool FY26 → FY31</th>
            <th className="num">Pool adds</th><th>Leader today</th>
            <th className="num">Our target</th><th className="num">As % of pool growth</th>
          </tr>
        </thead>
        <tbody>
          {rob.competitive.map((r) => (
            <tr key={r.space}>
              <td style={{ fontWeight: 600 }}>{r.space}</td>
              <td className="num">
                {r.pool_fy26.toLocaleString("en-IN")} → {r.pool_fy31.toLocaleString("en-IN")}
              </td>
              <td className="num">+{r.pool_growth.toLocaleString("en-IN")}</td>
              <td>{r.leader} @ {r.leader_share}%</td>
              <td className="num">{r.cipla_target_share}% = ₹{r.cipla_target_val.toLocaleString("en-IN")} Cr</td>
              <td className="num pos" style={{ fontWeight: 700 }}>{r.target_as_pct_of_pool_growth}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 0, marginTop: 8 }}>
        Entry points were chosen where the leader holds 12–22%, not 55–87%. Retaliation is a risk to
        pace, not to thesis.
      </p>
    </div>
  );
}
