import type { Bundle, Checker, Finding, ParsedManifest } from '../types.js';
import { POLICIES } from '../policies.js';

/**
 * Yellow Magnesium — packaging errors that make the extension fail to load:
 *  - files referenced by the manifest that are not present in the package
 *  - case-sensitivity mismatches (manifest says Background.js, file is background.js)
 *
 * Missing referenced files are blockers; case-only mismatches are blockers too
 * (they break on case-sensitive filesystems, exactly the doc's example).
 */
export const packagingChecker: Checker = {
  id: 'packaging',
  run(bundle: Bundle): Finding[] {
    const findings: Finding[] = [];
    const present = new Set(bundle.files.map((f) => normalize(f.path)));
    const presentLower = new Map<string, string>();
    for (const f of bundle.files) presentLower.set(normalize(f.path).toLowerCase(), normalize(f.path));

    const referenced = collectReferencedPaths(bundle.manifest);

    for (const ref of referenced) {
      const norm = normalize(ref);
      if (present.has(norm)) continue;

      const caseMatch = presentLower.get(norm.toLowerCase());
      if (caseMatch) {
        findings.push({
          notificationId: POLICIES.YELLOW_MAGNESIUM.notificationId,
          category: POLICIES.YELLOW_MAGNESIUM.category,
          severity: 'blocker',
          title: `Case mismatch: manifest references "${ref}" but package contains "${caseMatch}"`,
          policyQuote: POLICIES.YELLOW_MAGNESIUM.quote,
          howToFix: `Make the manifest path and the actual file name match exactly (including case). Case-sensitive filesystems will fail to load "${ref}".`,
          source: 'native',
        });
      } else {
        findings.push({
          notificationId: POLICIES.YELLOW_MAGNESIUM.notificationId,
          category: POLICIES.YELLOW_MAGNESIUM.category,
          severity: 'blocker',
          title: `Referenced file is missing from the package: "${ref}"`,
          policyQuote: POLICIES.YELLOW_MAGNESIUM.quote,
          howToFix: `Include "${ref}" in the submitted package, or fix the path in manifest.json. Test the exact packed artifact you upload, not just your dev build.`,
          source: 'native',
        });
      }
    }

    return findings;
  },
};

function normalize(p: string): string {
  return p.replace(/^\.?\//, '').replace(/\\/g, '/');
}

/** Pull every file path the manifest points at. Best-effort across MV2/MV3 keys. */
function collectReferencedPaths(manifest: ParsedManifest): string[] {
  const raw = manifest.raw;
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === 'string' && v && !v.includes('://')) out.add(v);
  };
  const addIconMap = (v: unknown) => {
    if (v && typeof v === 'object') for (const val of Object.values(v as object)) add(val);
  };

  addIconMap(raw.icons);

  const action = (raw.action ?? raw.browser_action ?? raw.page_action) as
    | Record<string, unknown>
    | undefined;
  if (action) {
    add(action.default_popup);
    addIconMap(action.default_icon);
    add(action.default_icon);
  }

  const background = raw.background as Record<string, unknown> | undefined;
  if (background) {
    add(background.service_worker);
    add(background.page);
    if (Array.isArray(background.scripts)) background.scripts.forEach(add);
  }

  if (Array.isArray(raw.content_scripts)) {
    for (const cs of raw.content_scripts as Array<Record<string, unknown>>) {
      if (Array.isArray(cs.js)) cs.js.forEach(add);
      if (Array.isArray(cs.css)) cs.css.forEach(add);
    }
  }

  const optionsUi = raw.options_ui as Record<string, unknown> | undefined;
  add(optionsUi?.page);
  add(raw.options_page);
  add(raw.devtools_page);

  const overrides = (raw.chrome_url_overrides ?? {}) as Record<string, unknown>;
  for (const val of Object.values(overrides)) add(val);

  return [...out];
}
