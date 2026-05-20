import type { Bundle, Checker, Finding } from '../types.js';
import { POLICIES } from '../policies.js';

/**
 * Yellow Zinc (missing/insufficient metadata) + Yellow Argon (keyword stuffing).
 * Operates on listing metadata when available; falls back to the manifest's
 * name/description. When no listing is supplied, emits a manual reminder.
 */
export const metadataChecker: Checker = {
  id: 'metadata',
  run(bundle: Bundle): Finding[] {
    const findings: Finding[] = [];
    const listing = bundle.listing;
    const title = listing?.title ?? bundle.manifest.name;
    const description = listing?.description ?? bundle.manifest.description;

    if (!listing) {
      findings.push({
        notificationId: POLICIES.YELLOW_ZINC.notificationId,
        category: POLICIES.YELLOW_ZINC.category,
        severity: 'manual',
        title: 'Store-listing metadata not provided — verify icon, screenshots, and description manually',
        policyQuote: POLICIES.YELLOW_ZINC.quote,
        howToFix:
          'Provide listing metadata (title, description, screenshots, icon) so this can be checked, or verify in the developer dashboard that all are present and meaningful.',
        source: 'native',
      });
    }

    // Missing pieces -> blocker (the policy says these are auto-rejected).
    const missing: string[] = [];
    if (!title || title.trim().length === 0) missing.push('title');
    if (!description || description.trim().length === 0) missing.push('description');
    if (listing) {
      const shots = listing.screenshotCount ?? listing.screenshots?.length ?? 0;
      if (shots === 0) missing.push('screenshots');
      if (listing.iconPresent === false) missing.push('icon');
    }
    if (missing.length) {
      findings.push({
        notificationId: POLICIES.YELLOW_ZINC.notificationId,
        category: POLICIES.YELLOW_ZINC.category,
        severity: 'blocker',
        title: `Missing required listing metadata: ${missing.join(', ')}`,
        policyQuote: POLICIES.YELLOW_ZINC.quote,
        howToFix: `Add the missing ${missing.join(', ')}. A blank description or missing icon/screenshots will be rejected.`,
        source: 'native',
      });
    }

    // Thin description -> warning.
    if (description && description.trim().length > 0 && description.trim().length < 25) {
      findings.push({
        notificationId: POLICIES.YELLOW_ZINC.notificationId,
        category: POLICIES.YELLOW_ZINC.category,
        severity: 'warning',
        title: 'Description is very short and may not adequately explain functionality',
        policyQuote: POLICIES.YELLOW_ZINC.quote,
        howToFix: 'Expand the description to clearly explain all major features the extension provides.',
        source: 'native',
      });
    }

    // Keyword stuffing (Yellow Argon): same keyword repeated > 5 times.
    if (description) {
      const stuffed = findRepeatedKeyword(description, 5);
      if (stuffed) {
        findings.push({
          notificationId: POLICIES.YELLOW_ARGON.notificationId,
          category: POLICIES.YELLOW_ARGON.category,
          severity: 'warning',
          title: `Possible keyword stuffing: "${stuffed.word}" repeated ${stuffed.count} times`,
          policyQuote: POLICIES.YELLOW_ARGON.quote,
          howToFix:
            'Remove unnatural keyword repetition and lists of sites/regions. Write a clear description that uses keywords in context.',
          source: 'native',
        });
      }
    }

    return findings;
  },
};

function findRepeatedKeyword(text: string, threshold: number): { word: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[a-z][a-z0-9'-]{3,}/g) ?? []) {
    if (STOPWORDS.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  let worst: { word: string; count: number } | null = null;
  for (const [word, count] of counts) {
    if (count > threshold && (!worst || count > worst.count)) worst = { word, count };
  }
  return worst;
}

const STOPWORDS = new Set([
  'this', 'that', 'with', 'your', 'from', 'have', 'will', 'they', 'them', 'then',
  'when', 'what', 'which', 'into', 'about', 'just', 'like', 'also', 'more', 'than',
  'over', 'such', 'only', 'most', 'some', 'these', 'those', 'their', 'there', 'here',
  'each', 'every', 'page', 'pages', 'extension', 'chrome', 'browser', 'using', 'used',
]);
