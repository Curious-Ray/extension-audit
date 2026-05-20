import type { ParsedManifest } from './types.js';

/** Parse a manifest.json string into the engine's {@link ParsedManifest}. */
export function parseManifest(jsonText: string): ParsedManifest {
  const raw = JSON.parse(jsonText) as Record<string, unknown>;
  return fromObject(raw);
}

/** Build a {@link ParsedManifest} from an already-parsed object. */
export function fromObject(raw: Record<string, unknown>): ParsedManifest {
  return {
    raw,
    manifestVersion:
      typeof raw.manifest_version === 'number' ? raw.manifest_version : undefined,
    name: typeof raw.name === 'string' ? raw.name : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    permissions: asStringArray(raw.permissions),
    optionalPermissions: asStringArray(raw.optional_permissions),
    hostPermissions: asStringArray(raw.host_permissions),
    contentSecurityPolicy: raw.content_security_policy,
    webAccessibleResources: raw.web_accessible_resources,
    externallyConnectable: raw.externally_connectable,
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}
