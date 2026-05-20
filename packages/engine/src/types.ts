/**
 * Core shared types for the Verdikt engine.
 *
 * The engine is pure: it receives a {@link Bundle} (already normalized by the
 * server from a folder / zip / crx / Web Store URL) and returns a {@link Report}.
 * No network, no filesystem access happens in here.
 */

export type FileKind =
  | 'background'
  | 'content'
  | 'popup'
  | 'options'
  | 'service_worker'
  | 'other';

/** A single file inside the extension package. */
export interface BundleFile {
  /** Forward-slash path relative to the package root, e.g. "js/content.js". */
  path: string;
  /** Raw bytes. Always present. */
  bytes: Uint8Array;
  /** UTF-8 decoded text, when the file is textual (js/json/html/css). */
  text?: string;
  /** Role of the file, derived from manifest references. */
  kind: FileKind;
}

/**
 * Parsed manifest. We keep the raw object (manifests are open-ended) plus a few
 * conveniently-typed fields the checkers reach for most.
 */
export interface ParsedManifest {
  raw: Record<string, unknown>;
  manifestVersion?: number;
  name?: string;
  description?: string;
  permissions: string[];
  optionalPermissions: string[];
  hostPermissions: string[];
  /** Raw value of content_security_policy (string for MV2, object for MV3). */
  contentSecurityPolicy?: unknown;
  webAccessibleResources?: unknown;
  externallyConnectable?: unknown;
}

/** Store-listing metadata. Available for webstore-url scans or user-supplied. */
export interface ListingMetadata {
  title?: string;
  description?: string;
  /** Either screenshot URLs or just a count when only the count is known. */
  screenshots?: string[];
  screenshotCount?: number;
  privacyPolicyUrl?: string;
  category?: string;
  iconPresent?: boolean;
}

export type BundleSource = 'folder' | 'zip' | 'crx' | 'webstore-url';

/** The normalized unit of analysis the engine consumes. */
export interface Bundle {
  manifest: ParsedManifest;
  files: BundleFile[];
  listing?: ListingMetadata;
  source: BundleSource;
  /** Content hash of the package, used by the server for caching. */
  contentHash?: string;
}

export type Severity = 'blocker' | 'warning' | 'manual';

export type FindingSource = 'native' | 'nuclei' | 'llm';

/** A location in the package that triggered a finding. */
export interface Evidence {
  path: string;
  line?: number;
  snippet?: string;
}

/** A single detected issue, mapped to an official Chrome Web Store violation. */
export interface Finding {
  /** Human-readable Chrome notification ID, e.g. "Blue Argon". */
  notificationId: string;
  /** Short human label for the category, e.g. "Remote code (MV3)". */
  category: string;
  severity: Severity;
  title: string;
  evidence?: Evidence[];
  /** Verbatim policy text from the official violations doc. */
  policyQuote: string;
  /** Actionable remediation guidance. */
  howToFix: string;
  source: FindingSource;
}

/** A non-fatal problem encountered while scanning (bad input, module skipped). */
export interface ReportNotice {
  level: 'info' | 'warning' | 'error';
  message: string;
}

export type Verdict = 'likely_rejected' | 'at_risk' | 'looks_clear';

export interface CategorySummary {
  notificationId: string;
  category: string;
  blocker: number;
  warning: number;
  manual: number;
  findings: Finding[];
}

export interface Report {
  verdict: Verdict;
  counts: { blocker: number; warning: number; manual: number };
  categories: CategorySummary[];
  findings: Finding[];
  notices: ReportNotice[];
  source: BundleSource;
  generatedAt: string;
}

/**
 * A checker is a pure function over a bundle. It may also receive a context for
 * optional async capabilities (network reachability checks, llm), but the core
 * deterministic checkers ignore it.
 */
export interface CheckerContext {
  /** Resolves whether a URL is reachable; provided by the server. */
  isUrlReachable?: (url: string) => Promise<boolean>;
}

export interface Checker {
  id: string;
  run: (bundle: Bundle, ctx?: CheckerContext) => Finding[] | Promise<Finding[]>;
}
