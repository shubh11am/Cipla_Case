/**
 * TypeScript port of the agent's scoring engine and trade-off resolver.
 *
 * The heavy work — turning 7,452 SKU rows into per-space economics and competitive
 * structure — is done once in Python and shipped as data/spaces.json. What remains
 * is percentile-rank, weight, and five pass/fail screens over 11 rows: cheap enough
 * to run in the browser on every slider drag.
 *
 * This file must stay numerically identical to ScoringEngine + TradeoffResolver in
 * agent/cardio_prioritiser.py. data/spaces.json carries Python's own scores as
 * `py_*` fields so any drift shows up immediately (see verifyAgainstPython below).
 */

export type Space = {
  id: string;
  label: string;
  leader: string | null;
  archetype: string | null;
  prescriber: string | null;
  cluster_id: string | null;

  mat_t1: number; mat_t2: number; matcp_t2: number;
  qty_t1: number; qty_t2: number;
  n_companies: number; n_brands: number;
  value_growth: number; real_growth: number; price_growth: number;
  volume_growth: number; cagr_2y: number; growth_pool_abs: number;
  momentum: number; share_of_market: number;
  hhi: number; leader_share: number; top3_share: number;
  entrant_rate: number; brand_density: number;
  cipla_t1: number; cipla_t2: number; cipla_share: number;
  cipla_growth: number | null; cipla_rank: number | null;
  cipla_share_delta_bps: number;
  adjacency: number; brand_extension: number;
  capability_barrier: number; net_external_signal: number;

  py_market_attractiveness: number; py_future_potential: number;
  py_competitive_headroom: number; py_right_to_win: number;
  py_opportunity_score: number; py_passes: boolean;
  py_failed: string[]; py_action: string;

  signals: { id: string; dir: number; mag: number; conf: number; label: string; source: string }[];
};

export type PillarWeights = {
  market_attractiveness: number;
  future_potential: number;
  competitive_headroom: number;
  right_to_win: number;
};

export type SubWeights = {
  market_attractiveness: { size_mat_t2: number; growth_pool_abs: number };
  future_potential: { real_growth: number; volume_growth: number; momentum: number; external_signal: number };
  competitive_headroom: { inv_leader_share: number; inv_entrant_rate: number; inv_brand_density: number; pricing_power: number };
  right_to_win: { current_position: number; adjacency: number; brand_extension: number };
};

export type Scored = Space & {
  market_attractiveness: number;
  future_potential: number;
  competitive_headroom: number;
  right_to_win: number;
  opportunity_score: number;
  attractiveness_axis: number;
  rtw_axis: number;
  passes: boolean;
  failed: string[];
  action: string;
};

/**
 * pandas `Series.rank(pct=True, na_option="bottom") * 100`.
 * Ties take the average rank; null/NaN is ranked last (highest), matching
 * na_option="bottom" with ascending=True.
 */
export function pctRank(values: (number | null | undefined)[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const idx = values.map((v, i) => ({ v, i }));
  const isNull = (v: number | null | undefined) => v === null || v === undefined || Number.isNaN(v);

  idx.sort((a, b) => {
    const an = isNull(a.v), bn = isNull(b.v);
    if (an && bn) return a.i - b.i;
    if (an) return 1;   // nulls to the bottom (largest rank)
    if (bn) return -1;
    return (a.v as number) - (b.v as number);
  });

  const ranks = new Array<number>(n);
  let k = 0;
  while (k < n) {
    let j = k;
    // group ties (nulls all tie with each other)
    while (
      j + 1 < n &&
      ((isNull(idx[j + 1].v) && isNull(idx[k].v)) || idx[j + 1].v === idx[k].v)
    ) j++;
    const avg = (k + j + 2) / 2; // 1-based average rank
    for (let m = k; m <= j; m++) ranks[idx[m].i] = avg;
    k = j + 1;
  }
  return ranks.map((r) => (r / n) * 100);
}

const dot = (parts: [number, number][]) => parts.reduce((s, [w, v]) => s + w * v, 0);

export function scoreAll(
  spaces: Space[],
  pillars: PillarWeights,
  sub: SubWeights,
  marketRealGrowth: number,
): Scored[] {
  const col = <K extends keyof Space>(k: K) => spaces.map((s) => s[k] as unknown as number | null);

  // ---- Pillar 1: market attractiveness --------------------------------
  const p1Size = pctRank(spaces.map((s) => Math.log1p(s.mat_t2)));
  const p1Pool = pctRank(col("growth_pool_abs"));

  // ---- Pillar 2: future potential -------------------------------------
  const p2Real = pctRank(col("real_growth"));
  const p2Vol = pctRank(col("volume_growth"));
  const p2Mom = pctRank(col("momentum"));
  const p2Ext = spaces.map((s) => ((s.net_external_signal + 1) / 2) * 100);

  // ---- Pillar 3: competitive headroom (intensity, inverted) ------------
  const p3Leader = pctRank(col("leader_share")).map((v) => 100 - v);
  const p3Entrants = pctRank(col("entrant_rate")).map((v) => 100 - v);
  const p3Density = pctRank(col("brand_density")).map((v) => 100 - v);
  const p3Pricing = pctRank(col("price_growth"));

  // ---- Pillar 4: right to win ------------------------------------------
  const p4Share = pctRank(col("cipla_share"));
  const p4Rank = pctRank(spaces.map((s) => -(s.cipla_rank ?? 999)));
  const p4Pos = p4Share.map((v, i) => 0.6 * v + 0.4 * p4Rank[i]);
  const p4Adj = spaces.map((s) => s.adjacency * 100);
  const p4Brand = spaces.map((s) => s.brand_extension * 100);

  return spaces.map((s, i) => {
    const ma = dot([
      [sub.market_attractiveness.size_mat_t2, p1Size[i]],
      [sub.market_attractiveness.growth_pool_abs, p1Pool[i]],
    ]);
    const fp = dot([
      [sub.future_potential.real_growth, p2Real[i]],
      [sub.future_potential.volume_growth, p2Vol[i]],
      [sub.future_potential.momentum, p2Mom[i]],
      [sub.future_potential.external_signal, p2Ext[i]],
    ]);
    const ch = dot([
      [sub.competitive_headroom.inv_leader_share, p3Leader[i]],
      [sub.competitive_headroom.inv_entrant_rate, p3Entrants[i]],
      [sub.competitive_headroom.inv_brand_density, p3Density[i]],
      [sub.competitive_headroom.pricing_power, p3Pricing[i]],
    ]);
    const rtw = dot([
      [sub.right_to_win.current_position, p4Pos[i]],
      [sub.right_to_win.adjacency, p4Adj[i]],
      [sub.right_to_win.brand_extension, p4Brand[i]],
    ]);

    const opportunity_score =
      pillars.market_attractiveness * ma +
      pillars.future_potential * fp +
      pillars.competitive_headroom * ch +
      pillars.right_to_win * rtw;

    const attractiveness_axis = 0.4 * ma + 0.4 * fp + 0.2 * ch;

    // ---- the five ordered screens (see config.yaml) --------------------
    const failed: string[] = [];
    if (!(s.mat_t2 >= 150 && s.growth_pool_abs >= 15)) failed.push("S1_MATERIALITY");
    if (!(s.real_growth >= marketRealGrowth)) failed.push("S2_REAL_DEMAND");
    if (!(rtw >= 40 || s.adjacency >= 0.45)) failed.push("S3_WINNABILITY");
    if (!(s.net_external_signal > -0.35)) failed.push("S4_DURABILITY");
    if (!(s.capability_barrier <= 0.6)) failed.push("S5_CAPABILITY");

    const action =
      attractiveness_axis >= 55 && rtw >= 55 ? "DOUBLE DOWN"
      : attractiveness_axis >= 55 ? "BUILD CAPABILITY"
      : rtw >= 55 ? "SELECTIVE / HARVEST"
      : "AVOID";

    return {
      ...s,
      market_attractiveness: ma,
      future_potential: fp,
      competitive_headroom: ch,
      right_to_win: rtw,
      opportunity_score,
      attractiveness_axis,
      rtw_axis: rtw,
      passes: failed.length === 0,
      failed,
      action,
    };
  }).sort((a, b) => b.opportunity_score - a.opportunity_score);
}

/**
 * Guard rail: with the shipped default weights, the TS scorer must reproduce the
 * Python scores. Called on mount in dev; logs loudly if the two ever diverge.
 */
export function verifyAgainstPython(scored: Scored[], tol = 0.15): { ok: boolean; worst: number; where: string } {
  let worst = 0, where = "";
  for (const s of scored) {
    const d = Math.abs(s.opportunity_score - s.py_opportunity_score);
    if (d > worst) { worst = d; where = s.id; }
  }
  return { ok: worst <= tol, worst, where };
}

export const fmtCr = (v: number) =>
  "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 }) + " Cr";
export const pct = (v: number | null, d = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;
