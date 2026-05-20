import { BundleError } from './build.js';

/**
 * Strip the CRX header and return the embedded ZIP bytes.
 *
 * Supports CRX2 and CRX3:
 *   CRX2: "Cr24" | version(2) | pubKeyLen(4) | sigLen(4) | pubKey | sig | zip
 *   CRX3: "Cr24" | version(3) | headerLen(4) | header(headerLen) | zip
 */
export function crxToZip(input: Uint8Array): Uint8Array {
  if (input.length < 16) throw new BundleError('File is too small to be a CRX.');
  const magic = String.fromCharCode(input[0]!, input[1]!, input[2]!, input[3]!);
  if (magic !== 'Cr24') {
    // Maybe it's already a plain zip (PK\x03\x04).
    if (input[0] === 0x50 && input[1] === 0x4b) return input;
    throw new BundleError('Not a CRX file (missing "Cr24" magic).');
  }

  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const version = view.getUint32(4, true);

  let zipStart: number;
  if (version === 2) {
    const pubKeyLen = view.getUint32(8, true);
    const sigLen = view.getUint32(12, true);
    zipStart = 16 + pubKeyLen + sigLen;
  } else if (version === 3) {
    const headerLen = view.getUint32(8, true);
    zipStart = 12 + headerLen;
  } else {
    throw new BundleError(`Unsupported CRX version: ${version}`);
  }

  if (zipStart >= input.length) throw new BundleError('CRX header length exceeds file size.');
  return input.subarray(zipStart);
}
