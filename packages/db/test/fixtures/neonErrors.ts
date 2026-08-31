// The three error shapes the neon-http driver actually throws. Built from a real `Error` so
// `message` stays non-enumerable, which is the whole reason these failures logged as `{}`.

/** Stand-in for the driver's own error class: `name` plus whichever fields neon-http attaches. */
function makeNeonDbError(message: string, fields: Record<string, unknown> = {}): Error {
  const error = new Error(message);
  error.name = "NeonDbError";
  return Object.assign(error, fields);
}

/** `fetch` itself threw, so the SQL never reached Postgres — neon-http sets `sourceError`. */
export function makeConnectionError(): Error {
  return makeNeonDbError("Error connecting to database: TypeError: fetch failed", {
    sourceError: new TypeError("fetch failed"),
  });
}

/** Postgres rejected the statement (HTTP 400): SQLSTATE on the error, no `sourceError`. */
export function makeSqlError(): Error {
  return makeNeonDbError("duplicate key value violates unique constraint", {
    code: "23505",
    severity: "ERROR",
  });
}

/** A non-400 response from Neon's proxy — the status survives only in the message. */
export function makeProxyError(status: number): Error {
  return makeNeonDbError(`Server error (HTTP status ${status}): upstream unavailable`);
}
