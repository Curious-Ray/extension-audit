import type { Bundle, Checker, Finding } from '../types.js';
import { POLICIES } from '../policies.js';

/**
 * Map of permission -> the chrome.* API namespace(s) whose usage justifies it.
 * If none of the namespaces appear anywhere in the extension's JS, the
 * permission is very likely unused (Purple Potassium).
 *
 * Only permissions that gate a detectable API surface are listed. Permissions
 * not in this map are not flagged as "unused" (we can't prove a negative for
 * things like "background" or pure host strings).
 */
const PERMISSION_API: Record<string, string[]> = {
  alarms: ['chrome.alarms'],
  bookmarks: ['chrome.bookmarks'],
  contextMenus: ['chrome.contextMenus'],
  cookies: ['chrome.cookies'],
  debugger: ['chrome.debugger'],
  downloads: ['chrome.downloads'],
  geolocation: ['navigator.geolocation'],
  history: ['chrome.history'],
  identity: ['chrome.identity'],
  idle: ['chrome.idle'],
  management: ['chrome.management'],
  notifications: ['chrome.notifications'],
  pageCapture: ['chrome.pageCapture'],
  scripting: ['chrome.scripting'],
  storage: ['chrome.storage'],
  tabs: ['chrome.tabs'],
  tabCapture: ['chrome.tabCapture'],
  topSites: ['chrome.topSites'],
  tts: ['chrome.tts'],
  webNavigation: ['chrome.webNavigation'],
  webRequest: ['chrome.webRequest'],
  bookmarks_read: ['chrome.bookmarks'],
};

/** Host patterns that grant broad cross-origin access and warrant a warning. */
function isBroadHost(pattern: string): boolean {
  return (
    pattern === '<all_urls>' ||
    /^\*:\/\/\*\/?\*?$/.test(pattern) ||
    /:\/\/\*\//.test(pattern)
  );
}

export const permissionsChecker: Checker = {
  id: 'permissions',
  run(bundle: Bundle): Finding[] {
    const findings: Finding[] = [];
    const code = bundle.files
      .filter((f) => f.text !== undefined && (f.path.endsWith('.js') || f.path.endsWith('.mjs') || f.path.endsWith('.html')))
      .map((f) => f.text!)
      .join('\n');

    // Declared-but-unused API permissions -> blocker (clear excessive permission).
    for (const perm of bundle.manifest.permissions) {
      const apis = PERMISSION_API[perm];
      if (!apis) continue;
      const used = apis.some((api) => code.includes(api));
      if (!used) {
        findings.push({
          notificationId: POLICIES.PURPLE_POTASSIUM.notificationId,
          category: POLICIES.PURPLE_POTASSIUM.category,
          severity: 'blocker',
          title: `Permission "${perm}" is declared but its API (${apis.join(', ')}) is never used`,
          policyQuote: POLICIES.PURPLE_POTASSIUM.quote,
          howToFix: `Remove "${perm}" from the manifest's permissions array. Request only permissions whose APIs you actually call.`,
          source: 'native',
        });
      }
    }

    // Broad host permissions -> warning (often flagged as excessive).
    const hosts = [
      ...bundle.manifest.hostPermissions,
      // MV2 keeps host patterns inside permissions.
      ...bundle.manifest.permissions.filter((p) => p.includes('://') || p === '<all_urls>'),
    ];
    const broad = [...new Set(hosts.filter(isBroadHost))];
    if (broad.length) {
      findings.push({
        notificationId: POLICIES.PURPLE_POTASSIUM.notificationId,
        category: POLICIES.PURPLE_POTASSIUM.category,
        severity: 'warning',
        title: `Broad host permission(s): ${broad.join(', ')}`,
        policyQuote: POLICIES.PURPLE_POTASSIUM.quote,
        howToFix:
          'Narrow host permissions to the specific origins your extension needs. Broad patterns like <all_urls> or *://*/* are commonly flagged as excessive unless clearly justified by the extension’s single purpose.',
        source: 'native',
      });
    }

    return findings;
  },
};
