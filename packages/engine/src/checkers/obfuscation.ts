import type { Bundle, Checker, Finding } from '../types.js';
import { POLICIES } from '../policies.js';
import { regexEvidence } from '../scan-utils.js';

/**
 * Red Titanium — obfuscation. Minification is allowed; obfuscation is not.
 * Heuristics:
 *  - long base64-looking string literals (>= 120 chars of base64 alphabet)
 *  - heavy unicode/hex escape encoding (\uXXXX / \xXX) used many times in one file
 *  - decode-then-execute patterns: atob(...) or fromCharCode feeding eval/Function
 */
export const obfuscationChecker: Checker = {
  id: 'obfuscation',
  run(bundle: Bundle): Finding[] {
    const findings: Finding[] = [];

    for (const file of bundle.files) {
      if (file.text === undefined) continue;
      if (!file.path.endsWith('.js') && !file.path.endsWith('.mjs')) continue;
      const text = file.text;

      const longB64 = regexEvidence(
        file.path,
        text,
        /["'][A-Za-z0-9+/]{120,}={0,2}["']/g,
        10,
      );

      const escapes = text.match(/\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}/g) ?? [];
      const heavyEscapes = escapes.length >= 40;

      const decodeExec =
        /\b(atob|String\.fromCharCode|unescape)\s*\([^)]*\)[\s\S]{0,40}(eval|Function)\s*\(/.test(
          text,
        ) || /\b(eval|Function)\s*\(\s*(atob|unescape)\s*\(/.test(text);

      if (longB64.length || heavyEscapes || decodeExec) {
        const evidence = [...longB64];
        if (heavyEscapes) {
          evidence.push({
            path: file.path,
            snippet: `${escapes.length} unicode/hex escape sequences in this file`,
          });
        }
        if (decodeExec) {
          evidence.push(
            ...regexEvidence(file.path, text, /\b(atob|unescape|fromCharCode)\b/g, 5),
          );
        }
        findings.push({
          notificationId: POLICIES.RED_TITANIUM.notificationId,
          category: POLICIES.RED_TITANIUM.category,
          severity: decodeExec ? 'blocker' : 'warning',
          title: decodeExec
            ? 'Decoded string passed to eval/Function (obfuscated execution)'
            : 'Possible obfuscation (large encoded blobs / heavy escape encoding)',
          evidence,
          policyQuote: POLICIES.RED_TITANIUM.quote,
          howToFix:
            'Ship readable (optionally minified) source. Remove encoded payloads that are decoded and executed at runtime, and avoid concealing functionality behind base64/unicode-escape blobs.',
          source: 'native',
        });
      }
    }

    return findings;
  },
};
