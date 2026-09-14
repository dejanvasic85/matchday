// Making a thrown error readable in a JSON log line. Lives here rather than beside the Neon
// driver's quirks because data access and the crawlers both log causes this way.

/** How far to follow an error's `cause` chain when flattening it. Also what stops a
 * self-referencing chain from recursing forever. */
const maxCauseDepth = 5;

/** Errors JSON.stringify to `{}` — `message` and friends are non-enumerable — which is how a
 * production failure logged as `sourceError:{}` and said nothing. Flatten to a plain object. */
export function describeCause(cause: unknown, depth = 0): unknown {
  if (!(cause instanceof Error)) {
    return cause;
  }
  // Own entries cover whatever the thrower attached (a driver's code/constraint/table, Playwright's
  // log) with no hand-kept list to drift; `name` and `message` are never among them.
  const described: Record<string, unknown> = Object.fromEntries(Object.entries(cause));
  described.name = cause.name;
  described.message = cause.message;
  // Those entries carried these raw, which would drag the whole object graph — and any cycle in
  // it — into the log line. Re-add them below, flattened and depth-bounded.
  delete described.sourceError;
  delete described.cause;
  if (depth >= maxCauseDepth) {
    return described;
  }
  // `sourceError` is the nested-error field the neon-http driver uses; `cause` is the standard one.
  const sourceError = Reflect.get(cause, "sourceError");
  if (sourceError !== undefined) {
    described.sourceError = describeCause(sourceError, depth + 1);
  }
  if (cause.cause !== undefined) {
    described.cause = describeCause(cause.cause, depth + 1);
  }
  return described;
}
