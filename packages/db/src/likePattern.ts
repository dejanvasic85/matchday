/** Escapes `%`, `_` and `\` so a caller's search text matches literally, not as a pattern. */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}
