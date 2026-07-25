import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

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

Answer in 3–6 tight sentences. Lead with the answer, then the evidence. Use plain language — the reader may not know pharma. Do not use markdown headers or bullet lists; write prose.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      answer:
        "The live query layer is not configured on this deployment.\n\n" +
        "To enable it, add an environment variable named ANTHROPIC_API_KEY in your Vercel " +
        "project settings (Settings → Environment Variables) and redeploy. Everything else on " +
        "this page — the scoring, the screens, the backtest and the business case — is computed " +
        "from the data and works without it.",
    });
  }

  try {
    const { question, spaces } = await req.json();
    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "No question provided." }, { status: 400 });
    }

    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `AGENT OUTPUT (current weights)\n${JSON.stringify(spaces, null, 1)}\n\nQUESTION: ${question}`,
      }],
    });

    if (msg.stop_reason === "refusal") {
      return NextResponse.json({ answer: "That request was declined. Try rephrasing it." });
    }

    const answer = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ answer: answer || "No answer returned." });
  } catch (e: unknown) {
    const name = e instanceof Error ? e.constructor.name : "Error";
    const message =
      name === "AuthenticationError" ? "The ANTHROPIC_API_KEY on this deployment is not valid."
      : name === "RateLimitError" ? "Rate limited — wait a few seconds and try again."
      : `Could not reach the model (${name}).`;
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
