import type { Bundle, Checker, CheckerContext, Finding, ReportNotice } from './types.js';

/**
 * Run a set of checkers over a bundle. Each checker is sandboxed: if one throws,
 * it produces a single "could not evaluate" notice and the rest still run.
 */
export async function runCheckers(
  checkers: Checker[],
  bundle: Bundle,
  ctx?: CheckerContext,
): Promise<{ findings: Finding[]; notices: ReportNotice[] }> {
  const findings: Finding[] = [];
  const notices: ReportNotice[] = [];

  for (const checker of checkers) {
    try {
      const result = await checker.run(bundle, ctx);
      findings.push(...result);
    } catch (err) {
      notices.push({
        level: 'warning',
        message: `Checker "${checker.id}" could not be evaluated: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }
  }

  return { findings, notices };
}
