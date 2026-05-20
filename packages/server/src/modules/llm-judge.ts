import type { Bundle, Checker, Finding, Severity } from '@verdikt/engine';
import { POLICIES } from '@verdikt/engine';

/**
 * Optional subjective-category judge backed by the Claude API. Evaluates the
 * categories that deterministic rules can't truly judge: deceptive description
 * vs functionality (Red Nickel), single-purpose coherence (Red Magnesium), and
 * minimum-functionality value (Yellow Potassium).
 *
 * Without an API key this checker is simply not added to the run (the server
 * decides), so the engine degrades to rules-only with no failure.
 */
export function makeLlmJudge(opts: {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): Checker {
  const model = opts.model ?? 'claude-opus-4-7';
  const doFetch = opts.fetchImpl ?? fetch;

  return {
    id: 'llm-judge',
    async run(bundle: Bundle): Promise<Finding[]> {
      const summary = describeBundle(bundle);
      const body = {
        model,
        max_tokens: 1024,
        system:
          'You are a Chrome Web Store policy reviewer. Judge the extension against three policies: ' +
          '(1) Deceptive behavior (Red Nickel) — does the description match what the code/permissions actually do? ' +
          '(2) Single purpose (Red Magnesium) — is there one narrow, easy-to-understand purpose? ' +
          '(3) Minimum functionality (Yellow Potassium) — does it provide real value, not just a link-out? ' +
          'Respond ONLY with JSON: {"findings":[{"policy":"Red Nickel"|"Red Magnesium"|"Yellow Potassium","severity":"blocker"|"warning"|"manual","title":string,"reason":string}]}. ' +
          'Return an empty findings array if nothing is wrong. Be conservative: use "blocker" only when rejection is very likely.',
        messages: [{ role: 'user', content: summary }],
      };

      const res = await doFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as { content?: Array<{ text?: string }> };
      const text = data.content?.map((c) => c.text ?? '').join('') ?? '';
      return parseFindings(text);
    },
  };
}

function describeBundle(bundle: Bundle): string {
  const m = bundle.manifest;
  const fileList = bundle.files
    .filter((f) => f.path !== 'manifest.json')
    .map((f) => `${f.path} (${f.kind})`)
    .slice(0, 60)
    .join(', ');
  return [
    `Name: ${bundle.listing?.title ?? m.name ?? '(none)'}`,
    `Listing description: ${bundle.listing?.description ?? m.description ?? '(none)'}`,
    `Manifest version: ${m.manifestVersion ?? '?'}`,
    `Permissions: ${[...m.permissions, ...m.hostPermissions].join(', ') || '(none)'}`,
    `Files: ${fileList || '(none)'}`,
  ].join('\n');
}

const POLICY_BY_ID: Record<string, { quote: string; category: string }> = {
  'Red Nickel': { quote: POLICIES.RED_NICKEL.quote, category: POLICIES.RED_NICKEL.category },
  'Red Magnesium': { quote: POLICIES.RED_MAGNESIUM.quote, category: POLICIES.RED_MAGNESIUM.category },
  'Yellow Potassium': { quote: POLICIES.YELLOW_POTASSIUM.quote, category: POLICIES.YELLOW_POTASSIUM.category },
};

function parseFindings(text: string): Finding[] {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];
  let parsed: { findings?: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
  const out: Finding[] = [];
  for (const f of parsed.findings ?? []) {
    const policyId = String(f.policy ?? '');
    const policy = POLICY_BY_ID[policyId];
    if (!policy) continue;
    const severity: Severity =
      f.severity === 'blocker' || f.severity === 'warning' || f.severity === 'manual'
        ? f.severity
        : 'manual';
    out.push({
      notificationId: policyId,
      category: policy.category,
      severity,
      title: String(f.title ?? 'Policy concern'),
      howToFix: String(f.reason ?? ''),
      policyQuote: policy.quote,
      source: 'llm',
    });
  }
  return out;
}
