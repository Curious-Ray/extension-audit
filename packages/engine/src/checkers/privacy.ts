import type { Bundle, Checker, CheckerContext, Finding } from '../types.js';
import { POLICIES } from '../policies.js';
import { regexEvidence } from '../scan-utils.js';

/**
 * Permissions that strongly imply handling of personal/sensitive user data.
 * Their presence (when a listing exists) makes a missing privacy policy a
 * blocker — these clearly expose browsing activity or sensitive records.
 */
const STRONG_SENSITIVE = new Set([
  'cookies', 'history', 'webRequest', 'webNavigation', 'browsingData',
  'geolocation', 'clipboardRead', '<all_urls>',
]);

/**
 * Permissions that *may* require a privacy policy depending on whether data is
 * actually collected/transmitted. Flagged as a warning rather than a blocker to
 * avoid over-predicting rejection for benign local-only extensions.
 */
const SOFT_SENSITIVE = new Set([
  'tabs', 'bookmarks', 'topSites', 'downloads', 'identity', 'identity.email',
]);

export const privacyChecker: Checker = {
  id: 'privacy',
  async run(bundle: Bundle, ctx?: CheckerContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const allPerms = [
      ...bundle.manifest.permissions,
      ...bundle.manifest.hostPermissions,
    ];
    const hasStrong = allPerms.some(
      (p) => STRONG_SENSITIVE.has(p) || p === '<all_urls>' || p.includes('://'),
    );
    const hasSoft = allPerms.some((p) => SOFT_SENSITIVE.has(p));

    // --- Privacy policy (Purple Lithium) ---
    const url = bundle.listing?.privacyPolicyUrl;
    if ((hasStrong || hasSoft) && !url) {
      // Strong sensitive perms with a listing => blocker; soft perms => warning;
      // anything without a listing => manual (can't see the dashboard).
      const severity = !bundle.listing ? 'manual' : hasStrong ? 'blocker' : 'warning';
      findings.push({
        notificationId: POLICIES.PURPLE_LITHIUM.notificationId,
        category: POLICIES.PURPLE_LITHIUM.category,
        severity,
        title: hasStrong
          ? 'Extension handles sensitive user data but no privacy policy URL is set'
          : 'Extension may handle user data but no privacy policy URL is set',
        policyQuote: POLICIES.PURPLE_LITHIUM.quote,
        howToFix:
          'Add a working privacy-policy URL in the Privacy tab of the developer dashboard. It must describe what user data is collected and how it is used, handled, and shared.',
        source: 'native',
      });
    }

    if (url && (hasStrong || hasSoft)) {
      if (ctx?.isUrlReachable) {
        const reachable = await ctx.isUrlReachable(url);
        if (!reachable) {
          findings.push({
            notificationId: POLICIES.PURPLE_LITHIUM.notificationId,
            category: POLICIES.PURPLE_LITHIUM.category,
            severity: 'blocker',
            title: `Privacy policy URL is not reachable: ${url}`,
            policyQuote: POLICIES.PURPLE_LITHIUM.quote,
            howToFix: 'Ensure the privacy-policy URL loads successfully and points to an actual privacy policy.',
            source: 'native',
          });
        }
      }
    }

    // --- Secure transmission (Purple Copper): user data over HTTP ---
    for (const file of bundle.files) {
      if (file.text === undefined) continue;
      if (!file.path.endsWith('.js') && !file.path.endsWith('.mjs')) continue;
      const httpCalls = regexEvidence(
        file.path,
        file.text,
        /\b(?:fetch|XMLHttpRequest|axios|\.open)\s*\(\s*['"`]http:\/\//g,
        15,
      );
      if (httpCalls.length) {
        findings.push({
          notificationId: POLICIES.PURPLE_COPPER.notificationId,
          category: POLICIES.PURPLE_COPPER.category,
          severity: 'blocker',
          title: 'Network request over insecure HTTP',
          evidence: httpCalls,
          policyQuote: POLICIES.PURPLE_COPPER.quote,
          howToFix: 'Transmit all user data over HTTPS. Replace http:// endpoints with https:// and avoid encoding sensitive data in URLs or headers.',
          source: 'native',
        });
      }
    }

    return findings;
  },
};
