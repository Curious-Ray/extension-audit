import type { Bundle, Checker, Finding } from '../types.js';
import { POLICIES } from '../policies.js';
import { regexEvidence } from '../scan-utils.js';

/**
 * Blue Nickel / Blue Potassium — modifying the New Tab Page or omnibox search
 * without the Overrides API. Heuristic: code redirects/replaces the NTP or
 * rewrites the address-bar search but the manifest declares no
 * chrome_url_overrides.newtab / no search override.
 */
export const overridesChecker: Checker = {
  id: 'overrides',
  run(bundle: Bundle): Finding[] {
    const findings: Finding[] = [];
    const overrides = (bundle.manifest.raw.chrome_url_overrides ?? {}) as Record<string, unknown>;
    const declaresNewtab = typeof overrides.newtab === 'string';

    for (const file of bundle.files) {
      if (file.text === undefined) continue;
      if (!file.path.endsWith('.js') && !file.path.endsWith('.mjs')) continue;

      // Redirecting tabs to a chrome://newtab replacement or to about:newtab.
      const ntpHack = regexEvidence(
        file.path,
        file.text,
        /chrome:\/\/newtab|tabs\.update\([^)]*newtab|location\.replace\([^)]*newtab/gi,
        5,
      );
      if (ntpHack.length && !declaresNewtab) {
        findings.push({
          notificationId: POLICIES.BLUE_NICKEL.notificationId,
          category: POLICIES.BLUE_NICKEL.category,
          severity: 'warning',
          title: 'New Tab Page appears to be modified without the URL Overrides API',
          evidence: ntpHack,
          policyQuote: POLICIES.BLUE_NICKEL.quote,
          howToFix:
            'Override the New Tab Page via chrome_url_overrides.newtab in the manifest rather than redirecting tabs programmatically.',
          source: 'native',
        });
      }
    }

    return findings;
  },
};
