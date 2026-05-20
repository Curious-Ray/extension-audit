import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import type { Bundle, Checker, Finding } from '@verdikt/engine';

/**
 * Optional security module: shells out to the real `nuclei` binary with the
 * ChromeAudit templates. If the binary or templates are unavailable, the
 * checker resolves to an empty result (the engine notes nothing failed).
 *
 * @param templatesDir absolute path to the ChromeAudit templates directory
 */
export function makeNucleiChecker(templatesDir: string): Checker {
  return {
    id: 'nuclei',
    async run(bundle: Bundle): Promise<Finding[]> {
      if (!(await hasNuclei())) return [];

      const dir = await mkdtemp(join(tmpdir(), 'verdikt-nuclei-'));
      try {
        // Materialize the bundle's textual files so nuclei can scan them.
        for (const file of bundle.files) {
          const dest = join(dir, file.path);
          await mkdir(dirname(dest), { recursive: true });
          await writeFile(dest, Buffer.from(file.bytes));
        }
        const raw = await runNuclei(dir, templatesDir);
        return raw.map(toFinding);
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    },
  };
}

function hasNuclei(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn('nuclei', ['-version']);
    p.on('error', () => resolve(false));
    p.on('close', (code) => resolve(code === 0));
  });
}

interface NucleiResult {
  'template-id'?: string;
  info?: { name?: string; severity?: string };
  'matched-at'?: string;
}

function runNuclei(targetDir: string, templatesDir: string): Promise<NucleiResult[]> {
  return new Promise((resolve) => {
    const args = ['-target', targetDir, '-t', templatesDir, '-jsonl', '-silent'];
    const p = spawn('nuclei', args);
    let out = '';
    p.stdout.on('data', (d) => (out += d.toString()));
    p.on('error', () => resolve([]));
    p.on('close', () => {
      const results: NucleiResult[] = [];
      for (const line of out.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          results.push(JSON.parse(trimmed) as NucleiResult);
        } catch {
          // ignore non-JSON lines
        }
      }
      resolve(results);
    });
  });
}

function toFinding(r: NucleiResult): Finding {
  const sev = (r.info?.severity ?? 'info').toLowerCase();
  return {
    notificationId: 'Yellow Magnesium',
    category: `Security (Nuclei: ${r['template-id'] ?? 'unknown'})`,
    severity: sev === 'high' || sev === 'critical' ? 'warning' : 'manual',
    title: r.info?.name ?? r['template-id'] ?? 'Nuclei finding',
    evidence: r['matched-at'] ? [{ path: r['matched-at'] }] : undefined,
    policyQuote:
      'Security findings surfaced by the ChromeAudit Nuclei templates. These are not direct store-policy verdicts but indicate code that reviewers and the security community flag.',
    howToFix: 'Review the flagged pattern; see the corresponding ChromeAudit template for remediation guidance.',
    source: 'nuclei',
  };
}
