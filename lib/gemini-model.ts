/**
 * Resolving which Gemini model to call.
 *
 * Hardcoding a model id goes stale every time Gemini ships a version — which is
 * exactly how this app broke once already. Instead we ask Google what the key can
 * actually use and pick sensibly, unless GEMINI_MODEL pins one explicitly.
 *
 * Kept out of the route file so the ranking is unit-testable: `npm run verify:model`.
 */

const LIST_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export type RawModel = {
  name?: string;
  supportedGenerationMethods?: string[];
  supportedActions?: string[];
};

/** Model ids that support generateContent, with the "models/" prefix stripped. */
export function usableModels(raw: RawModel[]): string[] {
  return raw
    .filter((m) => (m.supportedGenerationMethods ?? m.supportedActions ?? []).includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter(Boolean);
}

/**
 * Pick a chat model: Flash tier (right speed/cost for a short grounded answer),
 * newest version, and avoid previews for something a demo depends on.
 */
export function pickModel(models: string[]): string | null {
  const usable = models.filter(
    (m) => !/embed|aqa|imagen|veo|tts|audio|vision|image|live|native|thinking/i.test(m),
  );
  if (!usable.length) return null;

  const score = (m: string) => {
    const version = parseFloat((m.match(/(\d+\.?\d*)/) ?? ["0"])[0]) || 0;
    return (
      (/flash/i.test(m) ? 1000 : 0) +        // flash: the right tier here
      (/lite/i.test(m) ? -200 : 0) +         // lite only if nothing better
      (/preview|exp|latest/i.test(m) ? -500 : 0) + // pin-stable beats moving targets
      version * 10
    );
  };
  return usable.slice().sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0];
}

let cache: string[] | null = null;

export function clearModelCache() {
  cache = null;
}

export async function listGeminiModels(apiKey: string): Promise<string[]> {
  if (cache) return cache;
  const res = await fetch(LIST_URL, { headers: { "x-goog-api-key": apiKey } }); // header, never the URL
  if (!res.ok) throw new Error(`ListModels ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = (await res.json()) as { models?: RawModel[] };
  cache = usableModels(json.models ?? []);
  return cache;
}

/** GEMINI_MODEL wins if set; otherwise discover one this key can actually use. */
export async function resolveGeminiModel(apiKey: string): Promise<string> {
  const pinned = process.env.GEMINI_MODEL?.trim();
  if (pinned) return pinned;
  const picked = pickModel(await listGeminiModels(apiKey));
  if (!picked) throw new Error("No Gemini model on this key supports generateContent.");
  return picked;
}
