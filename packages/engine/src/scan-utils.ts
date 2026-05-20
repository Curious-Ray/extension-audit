import * as acorn from 'acorn';
import type { Evidence } from './types.js';

/** Convert a character offset into a 1-based line number. */
export function offsetToLine(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

/** Extract a single-line, trimmed snippet around a character offset. */
export function snippetAt(text: string, offset: number, max = 160): string {
  const start = text.lastIndexOf('\n', offset) + 1;
  let end = text.indexOf('\n', offset);
  if (end === -1) end = text.length;
  return text.slice(start, end).trim().slice(0, max);
}

/**
 * Parse JS text to an AST, tolerant of modern syntax. Returns null when the
 * file cannot be parsed (callers fall back to text scanning).
 */
export function tryParse(text: string): acorn.Node | null {
  for (const sourceType of ['module', 'script'] as const) {
    try {
      return acorn.parse(text, {
        ecmaVersion: 'latest',
        sourceType,
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
      });
    } catch {
      // try the next sourceType
    }
  }
  return null;
}

/**
 * Find all matches of a regex in text and produce {@link Evidence} entries with
 * line numbers and snippets. Use for text-level checks and as an AST fallback.
 */
export function regexEvidence(
  path: string,
  text: string,
  re: RegExp,
  max = 25,
): Evidence[] {
  const evidence: Evidence[] = [];
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) !== null && evidence.length < max) {
    evidence.push({
      path,
      line: offsetToLine(text, match.index),
      snippet: snippetAt(text, match.index),
    });
    if (match.index === global.lastIndex) global.lastIndex++;
  }
  return evidence;
}
