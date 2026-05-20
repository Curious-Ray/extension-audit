import type { Bundle, Checker, Finding } from '../types.js';
import { POLICIES } from '../policies.js';
import { regexEvidence } from '../scan-utils.js';

/**
 * Native ports of the ChromeAudit / tarnish security checks. These are mostly
 * warning-level: they rarely cause an outright rejection on their own, but they
 * are the security signals those tools surface. The one exception — HTTP usage —
 * is handled by the privacy checker (Purple Copper) when user data is involved.
 *
 * Findings here are filed under the closest policy bucket; pure security smells
 * with no direct store-policy mapping use Yellow Magnesium (quality) as a
 * neutral home and are warning severity.
 */
export const securityChecker: Checker = {
  id: 'security',
  run(bundle: Bundle): Finding[] {
    const findings: Finding[] = [];

    // --- Missing CSP (MV3 has a sane default; MV2 without CSP is weaker) ---
    if (bundle.manifest.manifestVersion === 2 && bundle.manifest.contentSecurityPolicy == null) {
      findings.push({
        notificationId: POLICIES.BLUE_ARGON.notificationId,
        category: 'Content Security Policy',
        severity: 'warning',
        title: 'No explicit content_security_policy in manifest',
        policyQuote: POLICIES.BLUE_ARGON.quote,
        howToFix:
          'Add an explicit content_security_policy to mitigate XSS. Avoid unsafe-eval and remote script sources in the policy.',
        source: 'native',
      });
    }

    // --- innerHTML / document.write across JS files ---
    for (const file of bundle.files) {
      if (file.text === undefined) continue;
      if (!file.path.endsWith('.js') && !file.path.endsWith('.mjs')) continue;

      const dom = regexEvidence(file.path, file.text, /\b(document\.write|\.innerHTML\s*=)/g, 15);
      if (dom.length) {
        findings.push({
          notificationId: 'Yellow Magnesium',
          category: 'Security — DOM injection',
          severity: 'warning',
          title: 'Use of document.write / innerHTML (potential script injection)',
          evidence: dom,
          policyQuote: POLICIES.YELLOW_MAGNESIUM.quote,
          howToFix:
            'Prefer textContent or DOM APIs / sanitized templating instead of innerHTML and document.write to avoid injection.',
          source: 'native',
        });
      }
    }

    // --- Manifest wildcards (broad match patterns) handled in permissions;
    //     here we flag externally_connectable wildcards and web_accessible_resources. ---
    const ec = bundle.manifest.externallyConnectable;
    if (ec && typeof ec === 'object') {
      const matches = (ec as Record<string, unknown>).matches;
      if (Array.isArray(matches) && matches.some((m) => typeof m === 'string' && m.includes('*'))) {
        findings.push({
          notificationId: 'Yellow Magnesium',
          category: 'Security — externally_connectable',
          severity: 'warning',
          title: 'externally_connectable uses a wildcard match pattern',
          policyQuote: POLICIES.YELLOW_MAGNESIUM.quote,
          howToFix:
            'Limit externally_connectable.matches to specific trusted origins instead of wildcards to reduce the attack surface.',
          source: 'native',
        });
      }
    }

    const war = bundle.manifest.webAccessibleResources;
    if (war && (Array.isArray(war) ? war.length : true)) {
      findings.push({
        notificationId: 'Yellow Magnesium',
        category: 'Security — web_accessible_resources',
        severity: 'manual',
        title: 'Extension declares web_accessible_resources',
        policyQuote: POLICIES.YELLOW_MAGNESIUM.quote,
        howToFix:
          'Keep web_accessible_resources to the minimum set required. Exposed resources enable fingerprinting and, for HTML pages, potential clickjacking.',
        source: 'native',
      });
    }

    return findings;
  },
};
