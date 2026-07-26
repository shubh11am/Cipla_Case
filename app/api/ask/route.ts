/**
 * The "Ask the agent" endpoint — the only server-side code in the app.
 *
 * Supports Gemini and Claude. Which one runs is decided by whichever API key is
 * present, so the deployment works with either; set LLM_PROVIDER to force one.
 *
 *   GEMINI_API_KEY      → Google Gemini      (also accepts GOOGLE_API_KEY)
 *   ANTHROPIC_API_KEY   → Anthropic Claude
 *   LLM_PROVIDER        → "gemini" | "anthropic"   (optional override)
 *   GEMINI_MODEL        → optional pin; unset = discovered from the key
 *   ANTHROPIC_MODEL     → defaults to claude-opus-5
 *
 * With no key at all the route still returns 200 with an explanation, so the rest
 * of the app is never blocked by a missing credential.
 */
import { NextResponse } from "next/server";
import { resolveGeminiModel, listGeminiModels, clearModelCache } from "@/lib/gemini-model";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are the query interface to CARDIO-PRIORITISER, a prioritisation agent for the Indian cardiac market (a ₹23,244 Cr market growing 13.3%, of which 6.6% is price and 6.3% is real demand).

You are given the agent's fully computed output as JSON. Every number you cite must come from that JSON. Do not calculate new figures, do not estimate, and do not use outside knowledge of the Indian pharmaceutical market to supply a number the data does not contain. If the data cannot answer the question, say exactly what is missing.

Field meanings that matter:
- value_growth  : headline sales growth, MAT Feb'25 → Feb'26
- real_growth   : growth with price stripped out (from MAT at constant prices). This is demand, not pricing, and it is the number that decides everything.
- price_growth  : the residual, i.e. pure price
- volume_growth : units
- cipla_share   : Cipla's share of that space; cipla_rank is its rank among companies
- adjacency     : 0–1, how close the space is to a franchise Cipla already wins in
- passes/failed : whether it cleared the five screens, and which it failed
                  (S1 materiality, S2 real demand, S3 winnability, S4 durability, S5 capability)
- weight_stability_pct : share of 5,000 random weight vectors in which that space still clears all five screens

A separate "robustness" object is also supplied. Use it whenever the question is about whether the model can be trusted:
- robustness.weights          : the weight Monte Carlo. weight_free_screens are the screens that run on raw metrics and therefore cannot move with the weights at all
- robustness.blind_backtest_precision : the agent's blind precision against four comparator models — random selection, rank by pool size, composite score with the screens removed, and rank by value growth
- robustness.leave_one_signal_out : how many of the external signals can be deleted individually with no change to the shortlist
- robustness.financial_bridge : how FY26 revenue becomes FY31 revenue, and how gross profit becomes net contribution and the residual new cash
- robustness.competitive_response : each target expressed as a share of that pool's own growth, so it can be compared against the incumbent's position

Two things to be careful about, because they are easy to state wrongly:
- Ranking by value growth also scored 100% on the blind test. Do not claim the agent beat it. The correct claim is that removing the five screens drops precision from 100% to 80%, and the space it then wrongly adds is telmisartan core.
- The one false negative in the backtest is core statins, missed by roughly a tenth of a point.

Answer in 3–6 tight sentences. Lead with the answer, then the evidence. Use plain language — the reader may not know pharma. Do not use markdown headers or bullet lists; write prose.`;

const GEMINI_KEY = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const CLAUDE_KEY = () => process.env.ANTHROPIC_API_KEY;

function chooseProvider(): "gemini" | "anthropic" | null {
  const forced = process.env.LLM_PROVIDER?.toLowerCase().trim();
  if (forced === "gemini") return GEMINI_KEY() ? "gemini" : null;
  if (forced === "anthropic" || forced === "claude") return CLAUDE_KEY() ? "anthropic" : null;
  if (GEMINI_KEY()) return "gemini";
  if (CLAUDE_KEY()) return "anthropic";
  return null;
}

async function askGemini(prompt: string): Promise<string> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY() as string });
  const model = await resolveGeminiModel(GEMINI_KEY() as string);

  // These models think before they answer, and the thinking is drawn from the SAME
  // budget as the reply — which is how a 1,200-token cap shipped answers that stopped
  // mid-sentence. Give the budget real headroom and keep the thinking short; the reply
  // we want is six sentences, not an essay.
  const config = { systemInstruction: SYSTEM, maxOutputTokens: 8192 };
  let res;
  try {
    res = await ai.models.generateContent({
      model, contents: prompt,
      config: { ...config, thinkingConfig: { thinkingBudget: 256 } },
    });
  } catch {
    // some models refuse an explicit thinking budget — take the default instead
    res = await ai.models.generateContent({ model, contents: prompt, config });
  }

  const text = (res.text ?? "").trim();
  const finish = String(res.candidates?.[0]?.finishReason ?? "");
  if (!text) throw new Error(`Gemini returned no text (finishReason ${finish || "unknown"}).`);
  // never hand back a half sentence as though it were the answer
  if (finish === "MAX_TOKENS") {
    return text.replace(/\s+$/, "") + " …\n\n[The reply hit the length limit and was cut off. Ask a narrower question.]";
  }
  return text;
}

async function askClaude(prompt: string): Promise<string> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5";
  const msg = await client.messages.create({
    model,
    max_tokens: 2048,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  if (msg.stop_reason === "refusal") return "That request was declined. Try rephrasing it.";
  const text = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  if (msg.stop_reason === "max_tokens") {
    return text + " …\n\n[The reply hit the length limit and was cut off. Ask a narrower question.]";
  }
  return text;
}

export async function POST(req: Request) {
  const provider = chooseProvider();

  if (!provider) {
    return NextResponse.json({
      answer:
        "The live query layer is not configured on this deployment.\n\n" +
        "Add ONE of these as an environment variable in your Vercel project " +
        "(Settings → Environment Variables), then redeploy:\n\n" +
        "  GEMINI_API_KEY     — from aistudio.google.com/apikey\n" +
        "  ANTHROPIC_API_KEY  — from console.anthropic.com\n\n" +
        "Everything else on this page — the scoring, the screens, the backtest and the " +
        "business case — is computed from the data and works without a key.",
    });
  }

  try {
    const { question, spaces, robustness } = await req.json();
    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "No question provided." }, { status: 400 });
    }

    const prompt =
      `AGENT OUTPUT (current weights)\n${JSON.stringify(spaces, null, 1)}\n\n` +
      (robustness ? `ROBUSTNESS\n${JSON.stringify(robustness, null, 1)}\n\n` : "") +
      `QUESTION: ${question}`;

    const answer = provider === "gemini" ? await askGemini(prompt) : await askClaude(prompt);
    return NextResponse.json({ answer: answer || "No answer returned.", provider });
  } catch (e: unknown) {
    const name = e instanceof Error ? e.constructor.name : "Error";
    const raw = e instanceof Error ? e.message : String(e);

    // Surface the cause plainly. A rejected key and an unavailable model id are the
    // two things that actually go wrong here, and each is one setting away from fixed.
    let message: string;
    if (/api[_ ]?key|unauthenticated|401|invalid.*credential|permission/i.test(raw)) {
      message =
        `The ${provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY"} on this ` +
        `deployment was rejected. Check it under Settings → Environment Variables.`;
    } else if (/not found|404|unsupported|no such model/i.test(raw)) {
      if (provider === "gemini") {
        // don't just say "wrong model" — tell them which ones this key actually has
        const pinned = process.env.GEMINI_MODEL?.trim();
        let available = "";
        try {
          clearModelCache();
          const models = await listGeminiModels(GEMINI_KEY() as string);
          available = models.length
            ? `\n\nModels this key can use: ${models.slice(0, 12).join(", ")}` +
              (models.length > 12 ? ` (+${models.length - 12} more)` : "")
            : "";
        } catch { /* listing failed too — fall through with the plain message */ }
        message = pinned
          ? `GEMINI_MODEL is pinned to "${pinned}", which this key cannot use. ` +
            `Change it under Settings → Environment Variables, or remove it entirely and the ` +
            `app will pick a model automatically.${available}`
          : `No usable Gemini model was found for this key.${available}`;
      } else {
        const m = process.env.ANTHROPIC_MODEL || "claude-opus-5";
        message = `The model "${m}" was not available to this key. Set ANTHROPIC_MODEL to one it can access.`;
      }
    } else if (/rate|quota|429|resource.*exhausted/i.test(raw)) {
      message = "Rate limited or out of quota — wait a moment and try again.";
    } else {
      message = `Could not reach ${provider} (${name}): ${raw.slice(0, 200)}`;
    }
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
