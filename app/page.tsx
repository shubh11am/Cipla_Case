"use client";

import { useCallback, useMemo, useState } from "react";
import Matrix from "@/components/Matrix";
import SpaceDetail from "@/components/SpaceDetail";
import Rail, { type ViewId } from "@/components/Rail";
import Funnel from "@/components/Funnel";
import Palette from "@/components/Palette";
import Leaderboard from "@/components/Leaderboard";
import { RobustnessCards, Bridges, YearByYear, CompetitiveResponse } from "@/components/Robustness";
import { scoreAll, fmtCr, pct, type Space, type PillarWeights, type SubWeights } from "@/lib/score";

import spacesRaw from "@/data/spaces.json";
import model from "@/data/model.json";
import market from "@/data/market.json";
import backtest from "@/data/backtest.json";
import bcase from "@/data/business_case.json";
import rob from "@/data/robustness.json";

const SPACES = spacesRaw as unknown as Space[];
const DEFAULTS = model.pillar_weights as PillarWeights;
const SUB = model.sub_weights as unknown as SubWeights;
const MKT = market.market as Record<string, number>;
const CIPLA = market.cipla as Record<string, number>;
// Stability = survival under THRESHOLD jitter, not under weight jitter. Weight jitter
// cannot move membership at all (no screen reads the weighted score), so that column was
// 100/0 by arithmetic and told a reader nothing.
const STABILITY: Record<string, number> = Object.fromEntries(
  rob.thresholds.per_space.map((r) => [r.id, r.survives_pct]),
);
const BINDING: Record<string, { gate: string; move: number }> = Object.fromEntries(
  rob.thresholds.per_space.map((r) => [r.id, { gate: r.binding_gate, move: r.binding_move_pct }]),
);

/* ------------------------------------------------------------------ */

/** Price and demand pulled apart on one axis. The whole case is this picture. */
function Decomp({ rows }: { rows: { who: string; price: number; real: number; accent: string }[] }) {
  const span = 9;                                    // % on either side of zero
  const W = 100, x = (v: number) => 50 + (v / span) * 50;
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {rows.map((r) => (
        <div key={r.who}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
            <b style={{ color: "var(--ink)" }}>{r.who}</b>
            <span style={{ color: "var(--muted)" }}>
              value {pct(r.price + r.real)}
            </span>
          </div>
          <svg viewBox={`0 0 ${W} 22`} preserveAspectRatio="none"
               style={{ width: "100%", height: 30, display: "block", overflow: "visible" }}>
            <line x1={50} y1={0} x2={50} y2={22} stroke="#d6dee7" strokeWidth={0.4} />
            <rect x={Math.min(x(0), x(r.price))} y={2} width={Math.abs(x(r.price) - x(0))} height={8}
                  fill="#c3cedb" rx={1.2} />
            <rect x={Math.min(x(0), x(r.real))} y={12} width={Math.abs(x(r.real) - x(0))} height={8}
                  fill={r.accent} rx={1.2} />
          </svg>
          <div style={{ display: "flex", gap: 18, fontSize: 11, color: "var(--grey)", marginTop: 5 }}>
            <span><i style={{ display: "inline-block", width: 8, height: 8, background: "#c3cedb", borderRadius: 2, marginRight: 5 }} />
              price {pct(r.price)}</span>
            <span><i style={{ display: "inline-block", width: 8, height: 8, background: r.accent, borderRadius: 2, marginRight: 5 }} />
              real demand <b style={{ color: r.accent }}>{pct(r.real)}</b></span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function Page() {
  const [view, setView] = useState<ViewId>("diagnosis");
  const [w, setW] = useState<PillarWeights>({ ...DEFAULTS });
  const [sel, setSel] = useState<string>("LIPID_NONSTATIN");

  const normalise = (x: PillarWeights): PillarWeights => {
    const t = x.market_attractiveness + x.future_potential + x.competitive_headroom + x.right_to_win;
    return {
      market_attractiveness: x.market_attractiveness / t,
      future_potential: x.future_potential / t,
      competitive_headroom: x.competitive_headroom / t,
      right_to_win: x.right_to_win / t,
    };
  };

  const norm = useMemo(() => normalise(w), [w]);
  const scored = useMemo(() => scoreAll(SPACES, norm, SUB, MKT.real_growth), [norm]);

  // the shipped-weight ranking, so the table can show how far the sliders moved things
  const baseRank = useMemo(() => {
    const base = scoreAll(SPACES, normalise(DEFAULTS), SUB, MKT.real_growth);
    return Object.fromEntries(base.map((s, i) => [s.id, i + 1])) as Record<string, number>;
  }, []);

  const shortlist = scored.filter((s) => s.passes);
  const selected = scored.find((s) => s.id === sel) ?? scored[0];
  const dirty = JSON.stringify(w) !== JSON.stringify(DEFAULTS);

  const goto = useCallback((v: ViewId) => setView(v), []);
  const open = useCallback((id: string) => setSel(id), []);

  return (
    <div className="shell">
      <Rail view={view} onView={setView} weights={norm}
            cleared={shortlist.length} total={scored.length} dirty={dirty} />

      <main className="canvas">
        {/* ============================================== 1 · DIAGNOSIS == */}
        {view === "diagnosis" && (
          <section>
            <div className="head">
              <div className="eyebrow">The diagnosis</div>
              <h1>Cipla&apos;s cardiac growth is price.<br />The market&apos;s growth is patients.</h1>
              <p>
                India Cardiac is {fmtCr(MKT.mat_t2)} growing {pct(MKT.value_growth)}. Roughly half of
                that is pricing and half is real demand. Cipla took <b>more</b> price than the market
                and still grew a third as fast, because its volumes fell. Everything downstream of
                this page is about closing that gap for {fmtCr(bcase.scenarios.base.new_cash)} of new
                cash.
              </p>
            </div>

            <div className="grid g2">
              <div className="panel">
                <h3>Growth decomposition, MAT Feb&apos;25 → Feb&apos;26</h3>
                <p className="cap">
                  Constant-price MAT strips the pricing out. What remains is demand.
                </p>
                <Decomp rows={[
                  { who: "India Cardiac market", price: MKT.price_growth, real: MKT.real_growth, accent: "var(--teal)" },
                  { who: "Cipla", price: CIPLA.price_growth, real: CIPLA.real_growth, accent: "var(--red)" },
                ]} />
                <div className="note" style={{ marginTop: 18 }}>
                  <b>Cipla is one of four top-20 players with negative real growth</b> — and has the
                  steepest volume decline of the twenty, at {pct(CIPLA.volume_growth)}.
                </div>
              </div>

              <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
                <div className="panel">
                  <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                    <div style={{ fontSize: 40, fontWeight: 750, color: "var(--red)", letterSpacing: -1.5, lineHeight: 1 }}>71%</div>
                    <h3 style={{ fontSize: 15, margin: 0 }}>of the book sits in brands losing volume</h3>
                  </div>
                  <p className="cap" style={{ margin: "10px 0 0" }}>
                    Cipla&apos;s eight brands above ₹20 Cr are ₹277 Cr — value +7.9% on volume −2.2%.
                    Amlopres-AT alone is ₹96 Cr, a quarter of the book, in an atenolol pool whose
                    volumes fell 2.0%.
                  </p>
                </div>
                <div className="panel">
                  <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                    <div style={{ fontSize: 40, fontWeight: 750, color: "var(--teal)", letterSpacing: -1.5, lineHeight: 1 }}>24%</div>
                    <h3 style={{ fontSize: 15, margin: 0 }}>of the growth came from 2.5% of the book</h3>
                  </div>
                  <p className="cap" style={{ margin: "10px 0 0" }}>
                    Eleven sub-₹3 Cr brands — Rosulip EZ, Cresar BS, Metolar Trio — added ₹4.2 Cr of
                    Cipla&apos;s ₹17.1 Cr total gain. Every one sits in a space the agent shortlists.
                    The seeds are planted and starved.
                  </p>
                </div>
              </div>
            </div>

            <div className="panel dark" style={{ marginTop: 16 }}>
              <h3>Why cardiac, when Cipla leads respiratory</h3>
              <p className="cap">Because this is not a request for new cardiac capital.</p>
              <div className="metrics" style={{ border: 0, background: "rgba(255,255,255,.07)" }}>
                {([
                  ["Share FY24 → FY26", "1.95% → 1.68%", "three years of drift"],
                  ["FY31 if nothing changes", fmtCr(bcase.do_nothing.fy31), `${bcase.do_nothing.share.toFixed(2)}% share`],
                  ["FY31 on the plan", fmtCr(bcase.scenarios.base.fy31), `${bcase.scenarios.base.share.toFixed(2)}% share`],
                  ["New cash required", fmtCr(bcase.scenarios.base.new_cash), "over five years"],
                ] as [string, string, string][]).map(([k, v, n]) => (
                  <div className="metric on-dark" key={k}>
                    <div className="k">{k}</div><div className="v">{v}</div><div className="n">{n}</div>
                  </div>
                ))}
              </div>
              <p className="cap" style={{ margin: "14px 0 0" }}>
                The legacy book already absorbs ₹30 Cr/yr of selling cost. Redeploying half funds
                most of the shift, and 60% of the growth rides bags Cipla&apos;s reps already carry.
              </p>
            </div>
          </section>
        )}

        {/* ============================================= 2 · PRIORITISE == */}
        {view === "prioritise" && (
          <section>
            <div className="head">
              <div className="eyebrow">Prioritise</div>
              <h1 className="wide">The core trade-off: attractive, versus winnable</h1>
              <p>
                Every weight below is live. Move one and all eleven spaces re-score in your browser —
                the ordering shifts, the shortlist does not, because four of the five screens run on
                raw metrics rather than scores.
              </p>
            </div>

            <div className="grid" style={{ gridTemplateColumns: "1.62fr 1fr" }}>
              <div className="panel">
                <Matrix spaces={scored} selected={sel} onSelect={setSel} />
              </div>

              <div className="panel">
                <h3>Adjust the model</h3>
                <p className="cap">
                  This is the agent&apos;s <span className="mono">--what-if</span> flag as a control
                  panel. Weights re-normalise to 100%.
                </p>
                {([
                  ["market_attractiveness", "Market attractiveness"],
                  ["future_potential", "Future potential"],
                  ["competitive_headroom", "Competitive intensity"],
                  ["right_to_win", "Right to win · strategic fit"],
                ] as [keyof PillarWeights, string][]).map(([k, label]) => (
                  <div className="slider" key={k}>
                    <label>{label}<b>{(norm[k] * 100).toFixed(0)}%</b></label>
                    <input type="range" min={0} max={60} step={1} value={Math.round(w[k] * 100)}
                           onChange={(e) => setW({ ...w, [k]: Number(e.target.value) / 100 })} />
                  </div>
                ))}
                <button className="btn" onClick={() => setW({ ...DEFAULTS })} disabled={!dirty}
                        style={{ opacity: dirty ? 1 : 0.45 }}>
                  Reset to shipped weights
                </button>
                <div className="note teal" style={{ marginTop: 14 }}>
                  <b>{shortlist.length} of {scored.length}</b> clear all five screens.
                  {dirty ? " The ordering moved; the membership did not." : " These are the deck's weights."}
                  {" "}It cannot change: no screen reads the weighted score, so membership is
                  invariant to these four sliders <b>by construction</b>. The test that can fail is
                  on the gates — jitter every threshold ±{rob.thresholds.jitter_pct}% and the
                  shortlist survives intact in <b>{rob.thresholds.identical_shortlist_pct}%</b> of
                  {" "}{rob.thresholds.draws.toLocaleString()} runs.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <Leaderboard scored={scored} baseRank={baseRank} marketReal={MKT.real_growth}
                           stability={STABILITY} binding={BINDING}
                           jitter={rob.thresholds.jitter_pct} selected={sel} onSelect={setSel} />
            </div>

            <div style={{ marginTop: 16 }}>
              {selected && <SpaceDetail s={selected} pillars={norm} />}
            </div>
          </section>
        )}

        {/* ================================================ 3 · SCREENS == */}
        {view === "screens" && (
          <section>
            <div className="head">
              <div className="eyebrow">The five screens</div>
              <h1 className="wide">Score ranks. Screens decide.</h1>
              <p>
                Ordered gates, applied in sequence — a space eliminated at S2 is never judged on
                whether Cipla could win it. Click any space to open its full audit trail. This is
                also where the brief&apos;s trade-offs get settled: each gate below names the one it
                resolves.
              </p>
            </div>

            <div className="panel">
              <Funnel spaces={scored} onSelect={(id) => { setSel(id); setView("prioritise"); }} />
            </div>

            <div className="note" style={{ marginTop: 16 }}>
              <b>The one that matters is S2.</b> Telmisartan core is the market&apos;s largest pool at
              ₹4,655 Cr and scores second of eleven — and it is gone at the second gate, because its
              5.1% real growth trails the market&apos;s {MKT.real_growth.toFixed(1)}% and the headline
              growth is DPCO-capped price. A model that ranked on score alone would have bought it.
            </div>
          </section>
        )}

        {/* ============================================= 4 · VALIDATION == */}
        {view === "validation" && (
          <section>
            <div className="head">
              <div className="eyebrow">Does it work?</div>
              <h1 className="wide">Re-run as of Feb&apos;25, with the last year withheld entirely</h1>
              <p>
                Then its blind picks were scored against what actually happened. This is the
                difference between a scoring spreadsheet and a validated model.
              </p>
            </div>

            <div className="metrics">
              {([
                [`${backtest.summary.shortlisted_beat} of ${backtest.summary.shortlisted}`,
                 "picks beat the market on real growth", "var(--teal)"],
                [`${backtest.summary.rejected_beat} of ${backtest.summary.rejected}`,
                 "rejected space that also did — the one false negative", "var(--red)"],
                [`+${(backtest.summary.shortlist_real - backtest.summary.rejected_real).toFixed(1)} pts`,
                 "real-growth spread, picked vs rejected", "var(--ink)"],
                [`${rob.baselines.score_only_precision}% → ${rob.baselines.agent_precision}%`,
                 "precision without, then with, the five screens", "var(--ink)"],
              ] as [string, string, string][]).map(([v, n, c]) => (
                <div className="metric" key={n}>
                  <div className="v" style={{ color: c }}>{v}</div>
                  <div className="n">{n}</div>
                </div>
              ))}
            </div>

            <div className="panel flush" style={{ marginTop: 16 }}>
              <div className="ph">
                <h3>Blind picks versus what actually happened</h3>
              </div>
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Space</th><th className="num">Blind score</th><th>Blind verdict</th>
                      <th className="num">Actual value g</th><th className="num">Actual REAL g</th>
                      <th>Beat the market?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtest.rows.map((r) => {
                      const beat = (r.actual_real_growth ?? -99) > backtest.market_real_growth;
                      return (
                        <tr key={r.id}>
                          <td style={{ fontWeight: r.shortlisted ? 600 : 400 }}>{r.label}</td>
                          <td className="num">{r.blind_score?.toFixed(1)}</td>
                          <td><span className={"pill " + (r.shortlisted ? "pass" : "fail")}>
                            {r.shortlisted ? "PICKED" : "REJECTED"}</span></td>
                          <td className="num">{pct(r.actual_value_growth)}</td>
                          <td className="num">{pct(r.actual_real_growth)}</td>
                          <td className={beat ? "pos" : "neg"}>{beat ? "Yes" : "No"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="pb">
                <div className="note">
                  <b>Precision is 100% either way.</b> The one false negative is core statins —
                  rejected on durability, then grew 6.4% real against a 6.3% market, a miss by a
                  tenth of a point on a space the recommendation says to defend rather than fund.
                  The signal layer was curated with FY26 known, so the variant carrying no hindsight
                  is worth stating too: with the layer switched off entirely the agent goes{" "}
                  {backtest.summary_signals_off.shortlisted_beat} of {backtest.summary_signals_off.shortlisted}{" "}
                  on its picks and {backtest.summary_signals_off.rejected_beat} of{" "}
                  {backtest.summary_signals_off.rejected} on its rejections.
                </div>
              </div>
            </div>

            <RobustnessCards />
          </section>
        )}

        {/* ================================================== 5 · MONEY == */}
        {view === "money" && (
          <section>
            <div className="head">
              <div className="eyebrow">The money</div>
              <h1 className="wide">₹{Math.round(bcase.scenarios.base.new_cash)} Cr of new cash for ₹{Math.round(bcase.scenarios.base.net_contribution)} Cr of contribution</h1>
              <p>
                A bottom-up five-year P&amp;L. The point is not the headline revenue — it is that
                the new cash required is small, because the legacy book already absorbs the selling
                spend that funds the shift.
              </p>
            </div>

            <div className="panel flush">
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Scenario</th><th className="num">Cipla FY31</th><th className="num">Share</th>
                      <th className="num">New cash</th><th className="num">5-yr contribution</th>
                      <th className="num">New MRs</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ color: "var(--red)", fontWeight: 600 }}>Do nothing</td>
                      <td className="num">{fmtCr(bcase.do_nothing.fy31)}</td>
                      <td className="num">{bcase.do_nothing.share.toFixed(2)}%</td>
                      <td className="num">—</td><td className="num">—</td><td className="num">—</td>
                    </tr>
                    {(["bear", "base", "bull"] as const).map((k) => {
                      const s = bcase.scenarios[k];
                      return (
                        <tr key={k} style={{ background: k === "base" ? "var(--teal-lo)" : undefined }}>
                          <td style={{ fontWeight: k === "base" ? 700 : 500, textTransform: "capitalize" }}>
                            {k}{k === "base" ? "  (recommended)" : ""}
                          </td>
                          <td className="num" style={{ fontWeight: k === "base" ? 700 : 400 }}>{fmtCr(s.fy31)}</td>
                          <td className="num">{s.share.toFixed(2)}%</td>
                          <td className="num" style={{ fontWeight: k === "base" ? 700 : 400 }}>{fmtCr(s.new_cash)}</td>
                          <td className="num pos" style={{ fontWeight: 700 }}>{fmtCr(s.net_contribution)}</td>
                          <td className="num">{Math.round(s.mr_add)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="pb">
                <div className="note teal">
                  <b>Why so cheap.</b> Incremental gross margin is ~70% against incremental selling
                  cost of ~12% of sales, so every rupee is contribution-positive from year one. The
                  binding constraint is execution capacity, not capital.
                </div>
              </div>
            </div>

            <div className="grid g2" style={{ marginTop: 16 }}>
              <div className="panel">
                <h3>Where the growth comes from — base case</h3>
                <table>
                  <thead>
                    <tr><th>Space</th><th className="num">Share now</th><th className="num">FY31</th><th className="num">Δ ₹Cr</th></tr>
                  </thead>
                  <tbody>
                    {bcase.scenarios.base.spaces.map((r) => (
                      <tr key={r.space as string}>
                        <td>{r.space as string}</td>
                        <td className="num">{(r.share_fy26 as number).toFixed(1)}%</td>
                        <td className="num">{(r.share_fy31 as number).toFixed(1)}%</td>
                        <td className="num" style={{ fontWeight: 600 }}>+{Math.round(r.delta as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="panel">
                <h3>Sensitivity — new cash required (₹ Cr)</h3>
                <p className="cap">
                  The two assumptions that swing the answer. Even at the harshest corner the case
                  holds at 3.8× return.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Legacy spend redeployed ↓</th>
                      {bcase.sensitivity.rides.map((r) => (
                        <th key={r} className="num">{(r * 100).toFixed(0)}%</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bcase.sensitivity.grid.map((row) => (
                      <tr key={row.redeploy}>
                        <td style={{ fontWeight: 600 }}>
                          {(row.redeploy * 100).toFixed(0)}%{row.redeploy === 0.5 ? " (base)" : ""}
                        </td>
                        {row.values.map((v, i) => {
                          const hi = row.redeploy === 0.5 && bcase.sensitivity.rides[i] === 0.6;
                          return (
                            <td key={i} className="num"
                                style={{ fontWeight: hi ? 700 : 400, color: hi ? "var(--ink)" : undefined }}>
                              {v}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 0" }}>
                  → share of growth riding detailing Cipla already does
                </p>
              </div>
            </div>

            <Bridges />
            <YearByYear />
            <CompetitiveResponse />
          </section>
        )}

        {/* ==================================================== 6 · ASK == */}
        {view === "ask" && <Ask scored={scored} />}

        <div className="foot">
          <b>How this works.</b> The expensive half of the agent — turning{" "}
          {market.meta.rows.toLocaleString()} SKU rows into per-space economics and competitive
          structure — runs in Python and is exported to static JSON. The scoring, screens and action
          bands are re-implemented in TypeScript and run in your browser, which is why the sliders
          are instant. Both are asserted to agree to within 0.001 of a point
          (<span className="mono">npm run verify</span>).
          <br />
          Source: Ascend S4 Cardiac dataset, MAT Feb&apos;24–Feb&apos;26. REAL growth = MAT at
          constant prices ÷ prior-year MAT − 1.
        </div>
      </main>

      <Palette spaces={scored} onView={goto} onSelect={open} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Ask({ scored }: { scored: ReturnType<typeof scoreAll> }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [via, setVia] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestions = [
    "Which spaces were rejected, and which rejection is most surprising?",
    "Why is telmisartan core rejected when it is the biggest pool?",
    "Where is Cipla's right to win strongest, and why?",
    "If I could only fund one space, which and why?",
    "How do I know the answer isn't just an artefact of your weights?",
    "What happens to the shortlist if I delete the external signals?",
  ];

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true); setA(""); setVia(null); setQ(question);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          spaces: scored.map((s) => ({
            id: s.id, label: s.label, pool: Math.round(s.mat_t2),
            value_growth: s.value_growth, real_growth: s.real_growth,
            price_growth: s.price_growth, volume_growth: s.volume_growth,
            cipla_share: s.cipla_share, cipla_rank: s.cipla_rank,
            adjacency: s.adjacency, hhi: Math.round(s.hhi),
            leader: s.leader, leader_share: s.leader_share,
            score: Number(s.opportunity_score.toFixed(1)),
            passes: s.passes, failed: s.failed, action: s.action,
            weight_stability_pct: STABILITY[s.id] ?? 0,
          })),
          robustness: {
            weights: {
              draws: rob.weights.draws,
              identical_shortlist_pct: rob.weights.identical_shortlist_pct,
              membership_is_structural: rob.weights.membership_is_structural,
              note: "No screen reads the weighted score, so the pillar weights cannot change shortlist membership at all. The 100% is algebra, not evidence. The weights move rank order only.",
            },
            threshold_sensitivity: rob.thresholds,
            blind_backtest_precision: rob.baselines,
            leave_one_signal_out: rob.leave_one_out,
            financial_bridge: rob.bridge,
            competitive_response: rob.competitive,
          },
        }),
      });
      const j = await res.json();
      setA(j.answer ?? j.error ?? "No response.");
      setVia(j.provider ?? null);
    } catch {
      setA("Could not reach the API route. If you are running locally, check the dev server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="head">
        <div className="eyebrow">Ask the agent</div>
        <h1 className="wide">Interrogate the model, not a summary of it</h1>
        <p>
          Answers come from the <b>computed table</b> — the same numbers on every other view, at
          whatever weights you have set. The model is instructed to cite only figures present in
          that data and to say plainly when the data cannot answer. Change the weights on
          Prioritise and the answers change with them.
        </p>
      </div>

      <div className="panel">
        <div className="ask-row">
          <input
            value={q} placeholder="e.g. Why was the biggest pool rejected?"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(q)}
          />
          <button className="btn" data-on="1" onClick={() => ask(q)} disabled={busy}>
            {busy ? "Thinking…" : "Ask"}
          </button>
        </div>
        <div className="suggest">
          {suggestions.map((s) => (
            <button key={s} onClick={() => ask(s)}>{s}</button>
          ))}
        </div>
        {a && <div className="answer">{a}</div>}
        {via && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
            answered by {via} · grounded in the computed table, not the model&apos;s own knowledge
          </div>
        )}
      </div>
    </section>
  );
}
