import * as walk from 'acorn-walk';
import type { Bundle, Checker, Finding } from '../types.js';
import { POLICIES } from '../policies.js';
import { offsetToLine, regexEvidence, snippetAt, tryParse } from '../scan-utils.js';

/**
 * Blue Argon — Manifest V3 remotely-hosted-code violation.
 *
 * Flags:
 *  - <script src> / <link>‑style references to remote (http(s)) resources in HTML
 *  - eval(...) and new Function(...) calls (mechanisms to execute string code)
 *  - import() of a remote URL
 *
 * Only blocker-level for MV3 (the policy is MV3-specific); for MV2 it is a warning.
 */
export const remoteCodeChecker: Checker = {
  id: 'remote-code',
  run(bundle: Bundle): Finding[] {
    const findings: Finding[] = [];
    const isMv3 = bundle.manifest.manifestVersion === 3;
    const severity = isMv3 ? 'blocker' : 'warning';

    for (const file of bundle.files) {
      if (file.text === undefined) continue;

      // Remote <script src="http..."> in HTML files.
      if (file.path.endsWith('.html') || file.path.endsWith('.htm')) {
        const remoteScript = /<script[^>]+src\s*=\s*["']https?:\/\/[^"']+["']/gi;
        const ev = regexEvidence(file.path, file.text, remoteScript);
        if (ev.length) {
          findings.push({
            ...base(),
            severity,
            title: 'Remote <script src> loads code from outside the package',
            evidence: ev,
          });
        }
        continue;
      }

      if (!file.path.endsWith('.js') && !file.path.endsWith('.mjs')) continue;

      const ast = tryParse(file.text);
      if (ast) {
        const ev: Finding['evidence'] = [];
        walk.simple(ast, {
          CallExpression(node: any) {
            const callee = node.callee;
            const isEval = callee?.type === 'Identifier' && callee.name === 'eval';
            const isImport = callee?.type === 'Import';
            if (isEval || isImport) {
              ev.push({
                path: file.path,
                line: offsetToLine(file.text!, node.start),
                snippet: snippetAt(file.text!, node.start),
              });
            }
          },
          NewExpression(node: any) {
            if (node.callee?.type === 'Identifier' && node.callee.name === 'Function') {
              ev.push({
                path: file.path,
                line: offsetToLine(file.text!, node.start),
                snippet: snippetAt(file.text!, node.start),
              });
            }
          },
        });
        if (ev.length) {
          findings.push({
            ...base(),
            severity,
            title: 'Dynamic code execution (eval / new Function / dynamic import)',
            evidence: ev.slice(0, 25),
          });
        }
      } else {
        // Unparseable: fall back to a conservative text scan for eval/new Function.
        const ev = regexEvidence(file.path, file.text, /\b(eval|new\s+Function)\s*\(/g);
        if (ev.length) {
          findings.push({
            ...base(),
            severity,
            title: 'Dynamic code execution (eval / new Function) — text match',
            evidence: ev,
          });
        }
      }
    }

    return findings;
  },
};

function base(): Omit<Finding, 'severity' | 'title' | 'evidence'> {
  return {
    notificationId: POLICIES.BLUE_ARGON.notificationId,
    category: POLICIES.BLUE_ARGON.category,
    policyQuote: POLICIES.BLUE_ARGON.quote,
    howToFix:
      'Bundle all executable logic inside the extension package. Replace remote <script src> with local files, and remove eval()/new Function()/dynamic remote import in favor of self-contained code. External resources may supply data, but not logic.',
    source: 'native',
  };
}
