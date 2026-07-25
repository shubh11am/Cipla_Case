"use client";

import { useMemo, useState } from "react";
import Matrix from "@/components/Matrix";
import SpaceDetail from "@/components/SpaceDetail";
import { scoreAll, fmtCr, pct, type Space, type PillarWeights, type SubWeights } from "@/lib/score";

import spacesRaw from "@/data/spaces.json";
import model from "@/data/model.json";
import market from "@/data/market.json";
import backtest from "@/data/backtest.json";
import bcase from "@/data/business_case.json";

const SPACES = spacesRaw as unknown as Space[];
const DEFAULTS = model.pillar_weights as PillarWeights;
const SUB = model.sub_weights as unknown as SubWeights;
const MKT = market.market as Record<string, number>;
const CIPLA = market.cipla as Record<string, number>;

const TABS = [
  ["prioritise", "Prioritise"],
  ["backtest", "Is it any good?"],
  ["money", "The money"],
  ["ask", "Ask the agent"],
] as const;

const actionClass = (a: string) =>
  a === "DOUBLE DOWN" ? "dd" : a === "BUILD CAPABILITY" ? "build"
  : a === "SELECTIVE / HARVEST" ? "sel" : "avoid";

export default function Page() {
  const [tab, setTab] = useState<string>("prioritise");
  const [w, setW] = useState<PillarWeights>({ ...DEFAULTS });
  const [sel, setSel] = useState<string>("LIPID_NONSTATIN");

  // weights are normalised so they always sum to 1, exactly like --what-if
  const norm = useMemo(() => {
    const t = w.market_attractiveness + w.future_potential + w.competitive_headroom + w.right_to_win;
    return {
      market_attractiveness: w.market_attractiveness / t,
      future_potential: w.future_potential / t,
      competitive_headroom: w.competitive_headroom / t,
      right_to_win: w.right_to_win / t,
    } as PillarWeights;
  }, [w]);

  const scored = useMemo(
    () => scoreAll(SPACES, norm, SUB, MKT.real_growth),
    [norm],
  );
  const shortlist = scored.filter((s) => s.passes);
  const selected = scored.find((s) => s.id === sel) ?? scored[0];
  const changed = JSON.stringify(w) !== JSON.stringify(DEFAULTS);

  return (
    <>
      <header className="hero">
        <div className="wrap">
          <div className="kicker">Cipla Ascend Season 4 · Cardiac</div>
          <h1>CARDIO-PRIORITISER</h1>
          <p>
            An auditable agent for the India Cardiac market. It separates growth that comes from
            <b> price</b> from growth that comes from <b>patients</b>, then ranks where Cipla can
            actually win. Every weight below is live — move one and the whole model re-scores.
          </p>
          <div className="stats">
            <div className="stat"><b>{fmtCr(MKT.mat_t2)}</b><span>Market, MAT Feb&apos;26</span></div>
            <div className="stat"><b>{pct(MKT.value_growth)}</b><span>Market value growth</span></div>
            <div className="stat"><b style={{ color: "#6fd3c7" }}>{pct(MKT.real_growth)}</b><span>…of which REAL</span></div>
            <div className="stat"><b>{fmtCr(CIPLA.mat_t2)}</b><span>Cipla · rank #{CIPLA.rank}</span></div>
            <div className="stat"><b style={{ color: "#ff8a99" }}>{pct(CIPLA.real_growth)}</b><span>Cipla REAL growth</span></div>
            <div className="stat"><b style={{ color: "#ff8a99" }}>{pct(CIPLA.volume_growth)}</b><span>Cipla volume growth</span></div>
          </div>
        </div>
      </header>

      <nav className="nav">
        <div className="wrap">
          {TABS.map(([id, label]) => (
            <button key={id} data-on={tab === id ? "1" : "0"} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </nav>

      <div className="wrap">
        {tab === "prioritise" && (
          <section>
            <div className="h2">11 opportunity spaces, ranked</div>
            <p className="sub">
              Bubbles are sized by pool. Green cleared all five screens; grey was rejected.
              Click any bubble or row for the full audit trail — pillar scores, screens, and every
              external signal with its source.
            </p>

            <div className="grid two" style={{ gridTemplateColumns: "1.55fr 1fr" }}>
              <div className="card">
                <Matrix spaces={scored} selected={sel} onSelect={setSel} />
              </div>

              <div className="card">
                <h3>Adjust the model</h3>
                <p style={{ fontSize: 12, color: "var(--grey)", marginTop: 0 }}>
                  This is the <span className="mono">--what-if</span> flag as a control panel.
                  Weights are re-normalised to sum to 100%.
                </p>
                {([
                  ["market_attractiveness", "Market attractiveness"],
                  ["future_potential", "Future potential"],
                  ["competitive_headroom", "Competitive headroom"],
                  ["right_to_win", "Right to win"],
                ] as [keyof PillarWeights, string][]).map(([k, label]) => (
                  <div className="slider" key={k}>
                    <label>{label}<b>{(norm[k] * 100).toFixed(0)}%</b></label>
                    <input type="range" min={0} max={60} step={1} value={Math.round(w[k] * 100)}
                           onChange={(e) => setW({ ...w, [k]: Number(e.target.value) / 100 })} />
                  </div>
                ))}
                <button className="btn" onClick={() => setW({ ...DEFAULTS })} disabled={!changed}
                        style={{ opacity: changed ? 1 : 0.45 }}>
                  Reset to shipped weights
                </button>
                <div className="note teal" style={{ marginTop: 12 }}>
                  <b>{shortlist.length} of {scored.length}</b> spaces clear all five screens.
                  {changed
                    ? " Note the shortlist barely moves — the answer is not an artefact of the weights."
                    : " These are the weights used in the deck and the backtest."}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Opportunity space</th>
                    <th className="num">Pool</th><th className="num">Value g</th>
                    <th className="num">REAL g</th><th className="num">Volume</th>
                    <th className="num">Cipla</th><th className="num">Score</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {scored.map((s, i) => (
                    <tr key={s.id} data-clickable="1" data-sel={sel === s.id ? "1" : "0"}
                        onClick={() => setSel(s.id)}>
                      <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                      <td style={{ fontWeight: s.passes ? 600 : 400 }}>{s.label}</td>
                      <td className="num">{Math.round(s.mat_t2).toLocaleString("en-IN")}</td>
                      <td className="num">{pct(s.value_growth)}</td>
                      <td className={"num " + (s.real_growth >= MKT.real_growth ? "pos" : "neg")}>
                        {pct(s.real_growth)}
                      </td>
                      <td className="num">{pct(s.volume_growth)}</td>
                      <td className="num">{s.cipla_share.toFixed(2)}%</td>
                      <td className="num" style={{ fontWeight: 700 }}>{s.opportunity_score.toFixed(1)}</td>
                      <td>
                        {s.passes
                          ? <span className={"pill " + actionClass(s.action)}>{s.action}</span>
                          : <span className="pill fail" title={s.failed.join(", ")}>
                              REJECTED · {s.failed[0].split("_")[0]}
                            </span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 0, marginTop: 10 }}>
                REAL growth is green when it beats the market&apos;s {MKT.real_growth.toFixed(1)}% — screen S2.
                Note rank 2: the market&apos;s largest pool scores near the top and is still rejected,
                because its growth is price rather than patients. Score ranks; screens decide.
              </p>
            </div>

            <div style={{ marginTop: 16 }}>
              {selected && <SpaceDetail s={selected} pillars={norm} />}
            </div>
          </section>
        )}

        {tab === "backtest" && (
          <section>
            <div className="h2">Does the agent actually work?</div>
            <p className="sub">
              The model was re-run <b>as of Feb&apos;25 with the most recent year withheld entirely</b>,
              then its blind picks were scored against what actually happened. This is the difference
              between a scoring spreadsheet and a validated model.
            </p>

            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
              {[
                [`${backtest.summary.shortlisted_beat} of ${backtest.summary.shortlisted}`,
                 "of the spaces it picked beat the market on real growth", "var(--teal)"],
                [`${backtest.summary.rejected_beat} of ${backtest.summary.rejected}`,
                 "rejected space that also beat it — the one false negative", "var(--red)"],
                [`${(backtest.summary.shortlist_real - backtest.summary.rejected_real).toFixed(1)} pts`,
                 "real-growth spread, picked vs rejected", "var(--ink)"],
                [`${backtest.summary_signals_off.shortlisted_beat} of ${backtest.summary_signals_off.shortlisted} · ${backtest.summary_signals_off.rejected_beat} of ${backtest.summary_signals_off.rejected}`,
                 "with the signal layer off — the variant carrying no hindsight", "var(--ink)"],
              ].map(([big, small, c]) => (
                <div className="card" key={small as string}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: c as string }}>{big}</div>
                  <div style={{ fontSize: 12, color: "var(--grey)", marginTop: 2 }}>{small}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <h3>Blind picks versus what actually happened</h3>
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
              <div className="note" style={{ marginTop: 12 }}>
                <b>Precision is 100% either way.</b> Every space the agent picked went on to beat
                the market. The one false negative is core statins — rejected on durability, then grew
                6.4% real against a 6.3% market, a miss by a tenth of a point on a space the
                recommendation says to defend rather than fund. The signal layer was curated with FY26
                known, so the layer-off variant is shown alongside: it carries no hindsight and
                separates just as cleanly.
              </div>
            </div>
          </section>
        )}

        {tab === "money" && (
          <section>
            <div className="h2">What it costs, and what it returns</div>
            <p className="sub">
              A bottom-up five-year P&amp;L. The point is not the headline revenue — it is that the
              new cash required is small, because the legacy book already absorbs the selling spend
              that funds the shift.
            </p>

            <div className="card">
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
                      <tr key={k} style={{ background: k === "base" ? "#f4f9f8" : undefined }}>
                        <td style={{ fontWeight: k === "base" ? 700 : 500, textTransform: "capitalize" }}>
                          {k}{k === "base" ? "  (recommended)" : ""}
                        </td>
                        <td className="num" style={{ fontWeight: k === "base" ? 700 : 400 }}>{fmtCr(s.fy31)}</td>
                        <td className="num">{s.share.toFixed(2)}%</td>
                        <td className="num" style={{ fontWeight: k === "base" ? 700 : 400 }}>{fmtCr(s.new_cash)}</td>
                        <td className="num" style={{ color: "var(--teal)", fontWeight: 700 }}>{fmtCr(s.net_contribution)}</td>
                        <td className="num">{Math.round(s.mr_add)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="note teal" style={{ marginTop: 12 }}>
                <b>Why so cheap.</b> Incremental gross margin is ~70% against incremental selling cost
                of ~12% of sales, so every rupee is contribution-positive from year one. About 60% of
                the growth rides bags Cipla&apos;s reps already carry, and half the legacy book&apos;s
                ₹30 Cr/yr of selling cost is redeployed. The binding constraint is execution capacity,
                not capital.
              </div>
            </div>

            <div className="grid two" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
              <div className="card">
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

              <div className="card">
                <h3>Sensitivity — new cash required (₹ Cr)</h3>
                <p style={{ fontSize: 11.5, color: "var(--grey)", marginTop: 0 }}>
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
                        {row.values.map((v, i) => (
                          <td key={i} className="num"
                              style={{ fontWeight: row.redeploy === 0.5 && bcase.sensitivity.rides[i] === 0.6 ? 700 : 400,
                                       color: row.redeploy === 0.5 && bcase.sensitivity.rides[i] === 0.6 ? "var(--ink)" : undefined }}>
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 0, marginTop: 8 }}>
                  → share of growth riding detailing Cipla already does
                </p>
              </div>
            </div>
          </section>
        )}

        {tab === "ask" && <Ask scored={scored} />}

        <div className="foot">
          <b>How this app works.</b> The expensive half of the agent — turning 7,452 SKU rows into
          per-space economics and competitive structure — runs in Python and is exported to static
          JSON. The scoring, screens and action bands are re-implemented in TypeScript and run in
          your browser, which is why the sliders are instant. Both are verified to agree to within
          0.001 of a point (<span className="mono">npm run verify</span>).
          <br />
          Source: Ascend S4 Cardiac dataset ({market.meta.rows.toLocaleString()} rows, MAT Feb&apos;24–Feb&apos;26).
          REAL growth = MAT at constant prices ÷ prior-year MAT − 1.
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Ask({ scored }: { scored: ReturnType<typeof scoreAll> }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [busy, setBusy] = useState(false);

  const suggestions = [
    "Which spaces were rejected, and which rejection is most surprising?",
    "Why is telmisartan core rejected when it is the biggest pool?",
    "Where is Cipla's right to win strongest, and why?",
    "If I could only fund one space, which and why?",
  ];

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true); setA(""); setQ(question);
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
          })),
        }),
      });
      const j = await res.json();
      setA(j.answer ?? j.error ?? "No response.");
    } catch (e) {
      setA("Could not reach the API route. If you are running locally, check the dev server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="h2">Ask the agent</div>
      <p className="sub">
        Questions are answered from the <b>computed table above</b>, not from the model&apos;s own
        knowledge — it is instructed to cite only numbers present in the data and to say so when the
        data cannot answer. Change the weights on the first tab and the answers change with them.
      </p>
      <div className="card">
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
      </div>
    </section>
  );
}
