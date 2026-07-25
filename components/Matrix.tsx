"use client";

import type { Scored } from "@/lib/score";
import model from "@/data/model.json";

// The dividers are the action-band thresholds themselves, not the midpoint of whatever
// happens to be plotted — so the quadrants you read off the chart are the quadrants the
// model actually applies, and they stay put as the weights move.
const BAND = model.action_bands.double_down;

/**
 * The 2×2 the agent computes but a static deck can only print once: attractiveness
 * vs Cipla's right to win, bubble sized by pool. Re-renders live as weights move.
 *
 * Bubbles carry their rank number rather than a text label — with 11 spaces in this
 * area, external labels collide unreadably. The ranked table below is the legend;
 * the selected bubble shows its name.
 */
export default function Matrix({
  spaces, selected, onSelect,
}: { spaces: Scored[]; selected: string | null; onSelect: (id: string) => void }) {
  const W = 720, H = 430, PAD = { l: 40, r: 26, t: 30, b: 42 };
  const px0 = PAD.l, px1 = W - PAD.r, py0 = PAD.t, py1 = H - PAD.b;

  const xs = spaces.map((s) => s.rtw_axis);
  const ys = spaces.map((s) => s.attractiveness_axis);
  // keep both thresholds inside the plotted range so the quadrants are always visible
  const xMin = Math.min(...xs, BAND.min_rtw) - 7, xMax = Math.max(...xs, BAND.min_rtw) + 7;
  const yMin = Math.min(...ys, BAND.min_attractiveness) - 5, yMax = Math.max(...ys, BAND.min_attractiveness) + 5;
  const maxPool = Math.max(...spaces.map((s) => s.mat_t2));

  const mx = (v: number) => px0 + ((v - xMin) / (xMax - xMin)) * (px1 - px0);
  const my = (v: number) => py1 - ((v - yMin) / (yMax - yMin)) * (py1 - py0);
  const rr = (pool: number) => 9 + 19 * Math.sqrt(pool / maxPool);

  const midX = mx(BAND.min_rtw), midY = my(BAND.min_attractiveness);
  const count = (a: string) => spaces.filter((s) => s.action === a).length;
  const nBuild = count("BUILD CAPABILITY");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}
         role="img" aria-label="Attractiveness versus Cipla's right to win, all opportunity spaces">
      <line x1={midX} y1={py0} x2={midX} y2={py1} stroke="#e3e9ef" strokeDasharray="4 4" />
      <line x1={px0} y1={midY} x2={px1} y2={midY} stroke="#e3e9ef" strokeDasharray="4 4" />

      <text x={px0 - 4} y={py0 - 12} fontSize="9.5" fontWeight="700" fill="#8b95a3" letterSpacing="0.6">
        MORE ATTRACTIVE ↑
      </text>
      <text x={px1} y={H - 8} fontSize="9.5" fontWeight="700" fill="#8b95a3"
            textAnchor="end" letterSpacing="0.6">
        CIPLA&apos;S RIGHT TO WIN →
      </text>

      {/* The four action bands, named where they fall. Top-left is the one worth seeing:
          attractive spaces where Cipla has no right to win — normally empty. */}
      <text x={px0 + 6} y={py0 + 14} fontSize="9.5" fontWeight="700" fill="#c9d2dc" letterSpacing="0.7">
        BUILD CAPABILITY
      </text>
      {nBuild === 0 && (
        <text x={px0 + 6} y={py0 + 27} fontSize="9" fontStyle="italic" fill="#c9d2dc">
          empty — nothing lands here
        </text>
      )}
      <text x={px1 - 6} y={py0 + 14} fontSize="9.5" fontWeight="700" fill="#c9d2dc"
            textAnchor="end" letterSpacing="0.7">
        DOUBLE DOWN · {count("DOUBLE DOWN")}
      </text>
      <text x={px0 + 6} y={py1 - 8} fontSize="9.5" fontWeight="700" fill="#c9d2dc" letterSpacing="0.7">
        AVOID · {count("AVOID")}
      </text>
      <text x={px1 - 6} y={py1 - 8} fontSize="9.5" fontWeight="700" fill="#c9d2dc"
            textAnchor="end" letterSpacing="0.7">
        SELECTIVE / HARVEST · {count("SELECTIVE / HARVEST")}
      </text>


      {spaces.map((s, i) => {
        const cx = mx(s.rtw_axis), cy = my(s.attractiveness_axis), r = rr(s.mat_t2);
        const on = selected === s.id;
        return (
          <g key={s.id} onClick={() => onSelect(s.id)} style={{ cursor: "pointer" }}>
            <title>
              {`${i + 1}. ${s.label}\n₹${Math.round(s.mat_t2).toLocaleString("en-IN")} Cr` +
               `\nreal growth ${s.real_growth.toFixed(1)}%  ·  Cipla ${s.cipla_share.toFixed(2)}%` +
               `\n${s.passes ? "cleared all screens" : "rejected: " + s.failed.join(", ")}`}
            </title>
            {on && <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#10243f" strokeWidth={1.5} opacity={0.5} />}
            <circle
              cx={cx} cy={cy} r={r}
              fill={s.passes ? "rgba(0,133,124,.82)" : "rgba(150,159,171,.30)"}
              stroke={s.passes ? "#00857c" : "#b3bcc7"}
              strokeWidth={1.2}
            />
            <text x={cx} y={cy + 3.6} textAnchor="middle" fontSize="10.5" fontWeight="700"
                  fill={s.passes ? "#ffffff" : "#5a6473"} style={{ pointerEvents: "none" }}>
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* legend */}
      <circle cx={px0 + 6} cy={H - 14} r={5.5} fill="rgba(0,133,124,.82)" stroke="#00857c" />
      <text x={px0 + 17} y={H - 10.5} fontSize="10" fontWeight="700" fill="#00857c">
        Cleared all five screens
      </text>
      <circle cx={px0 + 152} cy={H - 14} r={5.5} fill="rgba(150,159,171,.30)" stroke="#b3bcc7" />
      <text x={px0 + 163} y={H - 10.5} fontSize="10" fill="#5a6473">Rejected</text>
      <text x={px0 + 225} y={H - 10.5} fontSize="10" fill="#8b95a3">
        numbers match the table below · bubble = pool size · hover for detail
      </text>
    </svg>
  );
}
