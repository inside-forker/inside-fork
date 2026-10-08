/**
 * Shared Profanity and Explicit Content Filter
 *
 * Checks for prohibited English and Roman Urdu explicit words, vulgarities,
 * abusive language, threats, and spam keywords.
 */

export const EXPLICIT_CONTENT_ERROR =
  "Your text contains language that isn't allowed. Please edit and try again.";

export const EXPLICIT_CONTENT_CODE = "EXPLICIT_CONTENT";

interface WordRule {
  canonical: string;
  pattern: RegExp;
}

// Helper to construct boundary-safe pattern allowing common masks (*, ., -, leet characters)
function createWordPattern(canonical: string, customRegex?: string): WordRule {
  if (customRegex) {
    return {
      canonical,
      pattern: new RegExp(`(?:^|\\b|[^a-zA-Z0-9])${customRegex}(?:$|\\b|[^a-zA-Z0-9])`, "i"),
    };
  }

  // Multi-word phrase
  if (canonical.includes(" ")) {
    const parts = canonical.split(/\s+/).map((p) => escapeRegex(p));
    return {
      canonical,
      pattern: new RegExp(`(?:^|\\b|[^a-zA-Z0-9])${parts.join("\\s+")}(?:$|\\b|[^a-zA-Z0-9])`, "i"),
    };
  }

  // Single word default
  const escaped = escapeRegex(canonical);
  return {
    canonical,
    pattern: new RegExp(`(?:^|\\b|[^a-zA-Z0-9])${escaped}(?:$|\\b|[^a-zA-Z0-9])`, "i"),
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RULES: WordRule[] = [
  // --- English Profanity & Vulgarities ---
  createWordPattern("fuck", "f[u*._@#4\\-]*[c*._#\\-]*k(?:ing|ed|er|s)?"),
  createWordPattern("motherfucker", "mother\\s*f[u*._@#4\\-]*[c*._#\\-]*k(?:er|ing|s)?"),
  createWordPattern("shit", "s[h*._#\\-]*[i*!1._#\\-]*t(?:ty|s)?"),
  createWordPattern("bullshit", "bull\\s*s[h*._#\\-]*[i*!1._#\\-]*t"),
  createWordPattern("bitch", "b[i!*1._#\\-]*t[c*._#\\-]*h(?:es|ing)?"),
  createWordPattern("asshole", "(?:a[s$5]{2}|a[*._#\\-][s$5])\\s*hole(?:s)?"),
  createWordPattern("bastard", "b[a@4*._#\\-]*stard(?:s)?"),
  createWordPattern("cunt", "c[u*._#\\-]*nt(?:s)?"),
  createWordPattern("dick", "d[i!*1._#\\-]*ck(?:head|s)?"),
  createWordPattern("pussy", "p[u*._#\\-]*s{2}y"),
  createWordPattern("cock", "c[o0*._#\\-]*ck(?:s)?"),
  createWordPattern("slut", "s[l*._#\\-]*[u*._#\\-]*t(?:s)?"),
  createWordPattern("whore", "wh[o0*._#\\-]*r[e*._#\\-]*(?:s)?"),
  createWordPattern("dumbass", "dumb\\s*a[s$5]{2}"),
  createWordPattern("jackass", "jack\\s*a[s$5]{2}"),
  createWordPattern("dipshit", "dip\\s*s[h*._#\\-]*[i*!1._#\\-]*t"),
  createWordPattern("wanker", "w[a@4*._#\\-]*nk[e*._#\\-]*r(?:s)?"),
  createWordPattern("prick", "pr[i!*1._#\\-]*ck(?:s)?"),
  createWordPattern("douchenozzle", "douche\\s*nozzle"),
  createWordPattern("douchebag", "douche\\s*bag(?:s)?"),
  createWordPattern("retard", "r[e*._#\\-]*t[a@4*._#\\-]*rd(?:ed|s)?"),
  createWordPattern("faggot", "f[a@4*._#\\-]*g{1,2}[o0*._#\\-]*t(?:s)?"),
  createWordPattern("nigger", "n[i!*1._#\\-]*g{2}[e*a@4._#\\-]*r(?:s)?"),
  createWordPattern("nigga", "n[i!*1._#\\-]*g{2}[a@4._#\\-]*"),
  createWordPattern("twat", "tw[a@4*._#\\-]*t(?:s)?"),
  createWordPattern("boobs", "b[o0*._#\\-]{2}b(?:s)?"),
  createWordPattern("blowjob", "blow\\s*j[o0*._#\\-]*b(?:s)?"),
  createWordPattern("porn", "p[o0*._#\\-]*rn(?:o|ography|ographic)?"),
  createWordPattern("masturbate", "masturbat(?:e|ing|ion)"),
  createWordPattern("orgasm", "orgasm(?:s)?"),

  // --- Roman Urdu / Local Pakistani Abusive Terms & Vulgarities ---
  createWordPattern("chutiya", "ch[u*o0._#\\-]*t[i!1y._#\\-]*[a@4._#\\-]*(?:a|on|pan)?"),
  createWordPattern("chutya", "ch[u*o0._#\\-]*ty[a@4._#\\-]*"),
  createWordPattern("chod", "ch[o0*._#\\-]*d(?:u|ing)?"),
  createWordPattern("madarchod", "m[a@4*._#\\-]*d[a@4*._#\\-]*r\\s*ch[o0*._#\\-]*d"),
  createWordPattern("maderchod", "m[a@4*._#\\-]*d[e*._#\\-]*r\\s*ch[o0*._#\\-]*d"),
  createWordPattern("bhenchod", "bh?[e*a@4._#\\-]*n\\s*ch[o0*._#\\-]*d"),
  createWordPattern("behnchod", "b[e*a@4._#\\-]*hn\\s*ch[o0*._#\\-]*d"),
  createWordPattern("bhen k laure", "bh?[e*a@4._#\\-]*n\\s*k[aey]?\\s*l[o0au*._#\\-]*r[ey]?"),
  createWordPattern("gandu", "g[a@4*._#\\-]*n[d*._#\\-]*[u0o*._#\\-]{1,2}"),
  createWordPattern("gaand", "g[a@4*._#\\-]{1,2}nd"),
  createWordPattern("haramzada", "h[a@4*._#\\-]*r[a@4*._#\\-]*mz[a@4*._#\\-]*d[a@4e]*"),
  createWordPattern("haramzadi", "h[a@4*._#\\-]*r[a@4*._#\\-]*mz[a@4*._#\\-]*d[i!1y]*"),
  createWordPattern("harami", "h[a@4*._#\\-]*r[a@4*._#\\-]*m[i!1y]+"),
  createWordPattern("haramkhor", "h[a@4*._#\\-]*r[a@4*._#\\-]*mk[h*._#\\-]*[o0*._#\\-]*r"),
  createWordPattern("bsdk", "b[s$5*._#\\-]*d[k*._#\\-]*"),
  createWordPattern("bhosdike", "bh[o0*._#\\-]*s[d*._#\\-]*[i!1y]*k[e*a@4]*"),
  createWordPattern("bhosdiwale", "bh[o0*._#\\-]*s[d*._#\\-]*[i!1y]*w[a@4]*l[e*a@4]*"),
  createWordPattern("kutta", "k[u*._#\\-]*t{1,2}[a@4e]+"),
  createWordPattern("kutti", "k[u*._#\\-]*t{1,2}[i!1y]+"),
  createWordPattern("kanjar", "k[a@4*._#\\-]*nj[a@4*._#\\-]*r"),
  createWordPattern("kanjari", "k[a@4*._#\\-]*nj[a@4*._#\\-]*r[i!1y]"),
  createWordPattern("randi", "r[a@4*._#\\-]*n[d*._#\\-]*[i!1y]+"),
  createWordPattern("dalli", "d[a@4*._#\\-]*l{1,2}[i!1y]+"),
  createWordPattern("dalla", "d[a@4*._#\\-]*l{1,2}[a@4e]+"),
  createWordPattern("gashti", "g[a@4*._#\\-]*sh?t[i!1y]+"),
  createWordPattern("loda", "l[o0au*._#\\-]{1,2}d[a@4e]*"),
  createWordPattern("lauda", "l[a@4]*[u*o0]*d[a@4e]*"),
  createWordPattern("lund", "l[u*o0._#\\-]*nd"),
  createWordPattern("tatty", "t[a@4*._#\\-]*t{1,2}[i!1y]+"),
  createWordPattern("tatti", "t[a@4*._#\\-]*t{1,2}[i!1y]+"),
  createWordPattern("choot", "ch[o0u*._#\\-]{1,2}t"),
  createWordPattern("suar", "s[u*._#\\-]*[a@4*._#\\-]*r"),
  createWordPattern("bayghairat", "b[a@4ey]{1,3}gh[a@4ey]{1,2}r[a@4]*t"),
  createWordPattern("beghairat", "b[e*a@4]*gh[a@4ey]{1,2}r[a@4]*t"),
  createWordPattern("kameena", "k[a@4*._#\\-]*m[e*i!1._#\\-]{1,2}n[a@4e]*"),
  createWordPattern("kamini", "k[a@4*._#\\-]*m[i!1._#\\-]*n[i!1y]"),
  createWordPattern("zaleel", "z[a@4*._#\\-]*l[e*i!1]{1,2}l"),
  createWordPattern("jahil", "j[a@4*._#\\-]*h[i!1._#\\-]*l"),
  createWordPattern("lanat", "l[a@4*._#\\-]*[a@4*._#\\-]*n[a@4*._#\\-]*t"),
  createWordPattern("khanzeer", "kh[a@4*._#\\-]*nz[e*i!1]{1,2}r"),
  createWordPattern("ullu k pathe", "ullu\\s*k[aey]?\\s*p[a@4]*th[aey]*"),
  createWordPattern("maa ki chut", "m[a@4]{1,2}\\s*k[i!1y]?\\s*ch[u*o0]{1,2}t"),
  createWordPattern("behn ki chut", "b[e*a@4]*hn\\s*k[i!1y]?\\s*ch[u*o0]{1,2}t"),
  createWordPattern("bharwa", "bh[a@4*._#\\-]*rw[a@4e]*"),
  createWordPattern("bhadwa", "bh[a@4*._#\\-]*dw[a@4e]*"),
  createWordPattern("gandi aulad", "g[a@4]*nd[i!1y]*\\s*[a@4]*ul[a@4]*d"),

  // --- Harassment, Violence & Threats ---
  createWordPattern("kill you", "kill\\s+you"),
  createWordPattern("murder you", "murder\\s+you"),
  createWordPattern("suicide", "suicide"),
  createWordPattern("slaughter", "slaughter"),
  createWordPattern("rapist", "rapist(?:s)?"),
  createWordPattern("rape", "rape(?:d|s)?"),
  createWordPattern("terrorist", "terrorist(?:s)?"),
  createWordPattern("terrorism", "terrorism"),

  // --- Spam, Scams & Fraudulent Promos ---
  createWordPattern("whatsapp group", "whatsapp\\s*group"),
  createWordPattern("crypto investment", "crypto\\s*investment"),
  createWordPattern("casino", "casino"),
  createWordPattern("betting", "betting"),
  createWordPattern("earn money online", "earn\\s*money\\s*online"),
  createWordPattern("scammer", "scammer(?:s)?"),
  createWordPattern("fake reviews", "fake\\s*reviews?"),
  createWordPattern("telegram link", "telegram\\s*(?:link|group)"),
  createWordPattern("adult dating", "adult\\s*dating"),
  createWordPattern("escort service", "escort\\s*service"),
  createWordPattern("sugar daddy", "sugar\\s*daddy"),
  createWordPattern("viagra", "viagra"),
  createWordPattern("easy cash", "easy\\s*cash"),
  createWordPattern("get rich quick", "get\\s*rich\\s*quick"),
];

/**
 * Checks for spaced letter obfuscation (e.g. "s h i t", "f u c k", "c h u t i y a")
 */
function checkSpacedLetters(raw: string): string[] {
  const collapsed = raw.replace(/\b([a-zA-Z])\s+([a-zA-Z])\s+([a-zA-Z])(?:\s+([a-zA-Z]))*\b/g, (match) =>
    match.replace(/\s+/g, "")
  );

  if (collapsed !== raw) {
    const found: string[] = [];
    for (const rule of RULES) {
      if (rule.pattern.test(collapsed)) {
        found.push(rule.canonical);
      }
    }
    return found;
  }

  return [];
}

/**
 * Finds all explicit matches in a given text.
 */
export function findExplicitMatches(text: string): string[] {
  if (!text || typeof text !== "string") return [];

  const found = new Set<string>();

  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      found.add(rule.canonical);
    }
  }

  const spacedMatches = checkSpacedLetters(text);
  for (const match of spacedMatches) {
    found.add(match);
  }

  return Array.from(found);
}

/**
 * Returns true if the text contains any prohibited explicit words or phrases.
 */
export function containsExplicitContent(text: string): boolean {
  if (!text || typeof text !== "string") return false;

  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return true;
    }
  }

  return checkSpacedLetters(text).length > 0;
}

/**
 * Validates text content. Returns isValid: false with error details if explicit content is found.
 */
export function validateReviewContent(text: string): {
  isValid: boolean;
  error?: string;
  code?: string;
  flaggedWords?: string[];
} {
  const matches = findExplicitMatches(text);

  if (matches.length > 0) {
    return {
      isValid: false,
      error: EXPLICIT_CONTENT_ERROR,
      code: EXPLICIT_CONTENT_CODE,
      flaggedWords: matches,
    };
  }

  return { isValid: true };
}
