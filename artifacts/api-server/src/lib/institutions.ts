import { logger } from "./logger";

export type InstitutionResult = {
  name: string;
  countryCode: string | null;
  website: string | null;
  domain: string | null;
};

type HipolabsEntry = {
  name: string;
  country: string;
  "alpha_two_code"?: string;
  domains?: string[];
  web_pages?: string[];
};

const SOURCE_URL = "http://universities.hipolabs.com/search";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day — this data changes rarely.
const REQUEST_TIMEOUT_MS = 5000;

const cache = new Map<string, { at: number; results: InstitutionResult[] }>();

/**
 * Institution search backed by Hipolabs' free, community-maintained mirror
 * of the "world universities" dataset (name, country, official domain and
 * web page per institution) — not scraped, not live-crawled, no API key.
 * This is deliberately the whole extent of the "verified institution data"
 * this app stores: a name, a country, and an official-looking URL. It does
 * NOT attempt to enrich that with programs, courses, or calendars scraped
 * from the institution's own site — those pages have no common structure,
 * and a scraper built against a handful of them would silently break or
 * mislead for every other one. See README/PERSONALIZATION report.
 *
 * Cached in-memory per (query, country) for a day, both to keep repeated
 * keystrokes fast and to be a reasonable citizen of a free, unauthenticated
 * public API rather than hitting it on every request.
 */
export async function searchInstitutions(query: string, countryCode?: string | null): Promise<InstitutionResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = `${trimmed.toLowerCase()}|${countryCode ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.results;

  const url = new URL(SOURCE_URL);
  url.searchParams.set("name", trimmed);
  if (countryCode) {
    const country = COUNTRY_NAME_BY_CODE[countryCode.toUpperCase()];
    if (country) url.searchParams.set("country", country);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Institution lookup failed with status ${response.status}`);

    const data = (await response.json()) as HipolabsEntry[];
    const results: InstitutionResult[] = data.slice(0, 15).map((entry) => ({
      name: entry.name,
      countryCode: guessCountryCode(entry) ?? null,
      website: entry.web_pages?.[0] ?? null,
      domain: entry.domains?.[0] ?? null,
    }));

    cache.set(cacheKey, { at: Date.now(), results });
    return results;
  } catch (err) {
    logger.error({ err, query: trimmed }, "Institution lookup failed");
    // A stale cache entry is still better than nothing if the source is
    // briefly unavailable; otherwise surface an empty list, never a crash —
    // the caller (route handler) turns this into a clean error response.
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// The source API takes a country *name*, not a code, and doesn't return a
// code reliably either (its "alpha_two_code" field is present but not
// always accurate) — this small reverse map covers the common case well
// enough for search filtering without pretending to be authoritative.
const COUNTRY_NAME_BY_CODE: Record<string, string> = {
  US: "United States", CA: "Canada", GB: "United Kingdom", AU: "Australia",
  IN: "India", DE: "Germany", FR: "France", NG: "Nigeria", PK: "Pakistan",
  BD: "Bangladesh", KE: "Kenya", ZA: "South Africa", GH: "Ghana", PH: "Philippines",
  BR: "Brazil", MX: "Mexico", ES: "Spain", IT: "Italy", NL: "Netherlands",
  IE: "Ireland", NZ: "New Zealand", SG: "Singapore", MY: "Malaysia", JP: "Japan",
  CN: "China", KR: "South Korea", EG: "Egypt", SA: "Saudi Arabia", AE: "United Arab Emirates",
};

function guessCountryCode(entry: HipolabsEntry): string | null {
  if (entry.alpha_two_code && entry.alpha_two_code.length === 2) return entry.alpha_two_code.toUpperCase();
  const match = Object.entries(COUNTRY_NAME_BY_CODE).find(([, name]) => name === entry.country);
  return match?.[0] ?? null;
}
