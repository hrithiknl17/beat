/** Languages Beat can hold a call in. Each one maps to its own Bolna agent (BOLNA_AGENT_ID_<CODE>). */
export const LANGUAGES = {
  kn: "Kannada",
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  ml: "Malayalam",
  en: "English",
} as const;

export type LangCode = keyof typeof LANGUAGES;

export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

export const isLang = (v: unknown): v is LangCode => typeof v === "string" && v in LANGUAGES;

export const langName = (code: string) => (LANGUAGES as Record<string, string>)[code] ?? code;

/** Accepts a code ("te") or a name ("Telugu"), as the agent may send either. */
export function toLang(v: unknown): LangCode | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (isLang(s)) return s;
  const hit = LANG_CODES.find((c) => LANGUAGES[c].toLowerCase() === s);
  return hit ?? null;
}
