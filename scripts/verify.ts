/**
 * Guard rail: prove the TypeScript scorer reproduces the Python agent.
 *
 * data/spaces.json carries Python's own pillar scores and screen verdicts as `py_*`
 * fields. This re-scores the same data in TS with the shipped default weights and
 * asserts the two agree. Run after any change to lib/score.ts or the exporter:
 *
 *     npm run verify
 */
import spaces from "../data/spaces.json";
import model from "../data/model.json";
import market from "../data/market.json";
import { scoreAll, type Space, type PillarWeights, type SubWeights } from "../lib/score";

const scored = scoreAll(
  spaces as unknown as Space[],
  model.pillar_weights as PillarWeights,
  model.sub_weights as unknown as SubWeights,
  market.market.real_growth as number,
);

let worstScore = 0, worstPillar = 0, screenMismatch = 0, actionMismatch = 0;
const rows: string[] = [];

for (const s of scored) {
  const dScore = Math.abs(s.opportunity_score - s.py_opportunity_score);
  const dPillar = Math.max(
    Math.abs(s.market_attractiveness - s.py_market_attractiveness),
    Math.abs(s.future_potential - s.py_future_potential),
    Math.abs(s.competitive_headroom - s.py_competitive_headroom),
    Math.abs(s.right_to_win - s.py_right_to_win),
  );
  const screensOk = s.passes === s.py_passes &&
    JSON.stringify([...s.failed].sort()) === JSON.stringify([...s.py_failed].sort());
  const actionOk = s.action === s.py_action;

  worstScore = Math.max(worstScore, dScore);
  worstPillar = Math.max(worstPillar, dPillar);
  if (!screensOk) screenMismatch++;
  if (!actionOk) actionMismatch++;

  rows.push(
    `  ${s.id.padEnd(22)} ts ${s.opportunity_score.toFixed(2).padStart(6)}` +
    `  py ${s.py_opportunity_score.toFixed(2).padStart(6)}` +
    `  Δ ${dScore.toFixed(4).padStart(7)}` +
    `  screens ${screensOk ? "ok " : "MISMATCH"}  action ${actionOk ? "ok" : "MISMATCH"}`,
  );
}

console.log("\nTS scorer vs Python agent — " + scored.length + " spaces\n");
console.log(rows.join("\n"));
console.log(
  `\n  worst score delta   ${worstScore.toFixed(4)}` +
  `\n  worst pillar delta  ${worstPillar.toFixed(4)}` +
  `\n  screen mismatches   ${screenMismatch}` +
  `\n  action mismatches   ${actionMismatch}`,
);

const ok = worstScore < 0.01 && worstPillar < 0.01 && screenMismatch === 0 && actionMismatch === 0;
console.log(ok ? "\n  PASS — the browser reproduces the agent exactly.\n"
               : "\n  FAIL — TS scorer has drifted from the Python agent.\n");
process.exit(ok ? 0 : 1);
