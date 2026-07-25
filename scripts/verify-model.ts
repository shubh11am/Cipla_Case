/**
 * Prove the Gemini model picker behaves, without needing a live key.
 *
 * The app broke once because a model id was hardcoded and went stale. The fix is to
 * discover models from the key — but only if the ranking picks something sensible.
 * Run: npm run verify:model
 */
import { pickModel, usableModels, type RawModel } from "../lib/gemini-model";

let failed = 0;
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}\n${ok ? "" : `        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}\n`}`);
};

console.log("\nGemini model picker\n");

// filters to generateContent-capable and strips the models/ prefix
const raw: RawModel[] = [
  { name: "models/gemini-3.5-flash", supportedGenerationMethods: ["generateContent", "countTokens"] },
  { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
  { name: "models/gemini-3.6-flash", supportedActions: ["generateContent"] },
];
check("keeps only generateContent models", usableModels(raw), ["gemini-3.5-flash", "gemini-3.6-flash"]);

// newest flash wins
check("prefers the newest Flash",
  pickModel(["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.6-flash"]), "gemini-3.6-flash");

// flash beats pro even when pro is newer — right tier for a short grounded answer
check("prefers Flash over Pro",
  pickModel(["gemini-3.6-pro", "gemini-3.5-flash"]), "gemini-3.5-flash");

// stable beats preview
check("avoids previews when a stable model exists",
  pickModel(["gemini-3.6-flash-preview", "gemini-3.5-flash"]), "gemini-3.5-flash");

// lite is a last resort
check("prefers full Flash over Flash-Lite",
  pickModel(["gemini-3.5-flash-lite", "gemini-3.5-flash"]), "gemini-3.5-flash");

// non-chat models are excluded outright
check("excludes embedding / imagen / tts",
  pickModel(["text-embedding-004", "imagen-3.0", "gemini-3.5-flash", "gemini-tts"]), "gemini-3.5-flash");

// takes what it can get
check("falls back to Pro when no Flash exists",
  pickModel(["gemini-3.6-pro"]), "gemini-3.6-pro");

check("returns null when nothing is usable",
  pickModel(["text-embedding-004", "imagen-3.0"]), null);

check("returns null on an empty list", pickModel([]), null);

console.log(failed === 0
  ? "  PASS — picker resolves a sensible model without a hardcoded id.\n"
  : `\n  ${failed} failure(s).\n`);
process.exit(failed === 0 ? 0 : 1);
