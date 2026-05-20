import type { Checker } from '../types.js';
import { remoteCodeChecker } from './remote-code.js';
import { permissionsChecker } from './permissions.js';
import { obfuscationChecker } from './obfuscation.js';
import { packagingChecker } from './packaging.js';
import { securityChecker } from './security.js';
import { metadataChecker } from './metadata.js';
import { privacyChecker } from './privacy.js';
import { overridesChecker } from './overrides.js';
import { minimumFunctionalityChecker } from './minimum-functionality.js';

/** All deterministic native checkers, in display order. */
export const NATIVE_CHECKERS: Checker[] = [
  remoteCodeChecker,
  permissionsChecker,
  obfuscationChecker,
  packagingChecker,
  minimumFunctionalityChecker,
  overridesChecker,
  securityChecker,
  metadataChecker,
  privacyChecker,
];

export {
  remoteCodeChecker,
  permissionsChecker,
  obfuscationChecker,
  packagingChecker,
  securityChecker,
  metadataChecker,
  privacyChecker,
  overridesChecker,
  minimumFunctionalityChecker,
};
