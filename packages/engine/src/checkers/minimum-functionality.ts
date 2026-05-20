import type { Bundle, Checker, Finding } from '../types.js';
import { POLICIES } from '../policies.js';

/**
 * Yellow Potassium — minimum functionality. The clearest deterministic signal:
 * the package contains only a manifest (no other functional files), which the
 * doc lists verbatim as a violation.
 */
export const minimumFunctionalityChecker: Checker = {
  id: 'minimum-functionality',
  run(bundle: Bundle): Finding[] {
    const functional = bundle.files.filter((f) => {
      const p = f.path.toLowerCase();
      if (p === 'manifest.json') return false;
      return p.endsWith('.js') || p.endsWith('.mjs') || p.endsWith('.html') || p.endsWith('.css');
    });

    if (functional.length === 0) {
      return [
        {
          notificationId: POLICIES.YELLOW_POTASSIUM.notificationId,
          category: POLICIES.YELLOW_POTASSIUM.category,
          severity: 'blocker',
          title: 'Package contains no functional files beyond the manifest',
          policyQuote: POLICIES.YELLOW_POTASSIUM.quote,
          howToFix:
            'Provide actual functionality (scripts, pages) directly in the extension. Extensions with no functionality or that only link out to an external service are rejected.',
          source: 'native',
        },
      ];
    }

    return [];
  },
};
