"use client";

import type { Scored } from "@/lib/score";
import { pct } from "@/lib/score";

/** Real growth drawn against the market line, so "beats the market" is a shape, not a
 *  comparison the reader has to do in their head. */
function GrowthBar({ v, market, lo, hi }: { v: number; market: number; lo: number; hi: number }) {
  const span = hi - lo;
  const x = (n: number) => ((n - lo) / span) * 100;
  const zero = x(0), mk = x(market), val = x(v);
  const left = Math.min(zero, val), width = Math.abs(val - zero);
  return (
    <div className="gbar" title={`real growth ${v.toFixed(1)}% · market ${market.toFixed(1)}%`}>
      <span className="zero" style={{ left: `${zero}%` }} />
      <i className={v >= 0 ? "p" : "n"} style={{ left: `${left}%`, width: `${Math.max(width, 0.6)}%` }} />
      <span className="mk" style={{ left: `${mk}%` }} />
    </div>
  );
}

const actionClass = (a: string) =>
  a === "DOUBLE DOWN" ? "dd" : a === "BUILD CAPABILITY" ? "build"
  : a === "SELECTIVE / HARVEST" ? "sel" : "avoid";

export default function Leaderboard({
  scored, baseRank, marketReal, stability, selected, onSelect,
}: {
  scored: Scored[];
  baseRank: Record<string, number>;
  marketReal: number;
  stability: Record<string, number>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const reals = scored.map((s) => s.real_growth);
  const lo = Math.min(0, ...reals) - 3, hi = Math.max(...reals) + 3;

  return (
    <div className="panel flush">
      <div className="ph">
        <h3>Eleven spaces, ranked live</h3>
        <p className="cap" style={{ margin: 0 }}>
          The bar is REAL growth; the tick is the market&apos;s {marketReal.toFixed(1)}%. Move a
          weight and the arrow shows how far each space travelled from its shipped rank —
          the ordering is sensitive, the membership is not.
        </p>
      </div>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th style={{ width: 34 }}>#</th>
              <th>Opportunity space</th>
              <th className="num">Pool</th>
              <th style={{ width: 118 }}>REAL growth</th>
              <th className="num">Cipla</th>
              <th className="num">Score</th>
              <th className="num" title="Share of 5,000 random weight vectors in which this space still clears all five screens">
                Stability
              </th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {scored.map((s, i) => {
              const moved = (baseRank[s.id] ?? i + 1) - (i + 1);
              return (
                <tr key={s.id} data-clickable="1" data-sel={selected === s.id ? "1" : "0"}
                    onClick={() => onSelect(s.id)}>
                  <td style={{ color: "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
                    {i + 1}
                    {moved !== 0 && (
                      <span className={"delta " + (moved > 0 ? "up" : "dn")}>
                        {moved > 0 ? "▲" : "▼"}{Math.abs(moved)}
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: s.passes ? 600 : 400, color: s.passes ? "var(--ink)" : undefined }}>
                    {s.label}
                  </td>
                  <td className="num">{Math.round(s.mat_t2).toLocaleString("en-IN")}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <GrowthBar v={s.real_growth} market={marketReal} lo={lo} hi={hi} />
                      <span className={"num " + (s.real_growth >= marketReal ? "pos" : "neg")}
                            style={{ fontSize: 11.5, minWidth: 40 }}>
                        {pct(s.real_growth)}
                      </span>
                    </div>
                  </td>
                  <td className="num">{s.cipla_share.toFixed(2)}%</td>
                  <td className="num" style={{ fontWeight: 700, color: "var(--ink)" }}>
                    {s.opportunity_score.toFixed(1)}
                  </td>
                  <td className="num" style={{
                    color: (stability[s.id] ?? 0) >= 50 ? "var(--teal)" : "var(--faint)",
                    fontWeight: (stability[s.id] ?? 0) >= 50 ? 600 : 400,
                  }}>
                    {stability[s.id] ?? 0}%
                  </td>
                  <td>
                    {s.passes
                      ? <span className={"pill " + actionClass(s.action)}>{s.action}</span>
                      : <span className="pill fail" title={s.failed.join(", ")}>
                          OUT · {s.failed[0].split("_")[0]}
                        </span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
