// A local Result, deliberately not imported from @matchday/domain: that package is a workspace
// dependency and isn't published, so an installed SDK could never resolve it.

/** Why a call failed. `status` is the HTTP status, or `"timeout"`/`"network"` when no response
 * arrived at all — the two cases a caller most often wants to retry differently. */
export type MatchdayApiError = {
  status: number | "timeout" | "network";
  message: string;
  cause?: unknown;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: MatchdayApiError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(error: MatchdayApiError): Result<T> {
  return { ok: false, error };
}

/** What openapi-fetch hands back from a `client.GET(...)` call. */
export type FetchOutcome<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

function messageFor(status: number, error: unknown): string {
  if (typeof error === "object" && error !== null && "error" in error) {
    const { error: message } = error;
    if (typeof message === "string") {
      return message;
    }
  }
  return `matchday API request failed with status ${status}`;
}

/**
 * Turns a `client.GET(...)` outcome into a `Result`, so call sites stop repeating
 * `if (result.error || !result.data) throw new Error(...)`.
 */
export function unwrap<T>(outcome: FetchOutcome<T>): Result<T> {
  const { data, error, response } = outcome;

  if (error !== undefined || !response.ok) {
    return err({
      status: response.status,
      message: messageFor(response.status, error),
      cause: error,
    });
  }

  if (data === undefined) {
    return err({
      status: response.status,
      message: "matchday API returned no body",
    });
  }

  return ok(data);
}

/**
 * `unwrap`, but throws on failure — for a transport boundary that wants an exception, or a script
 * where a failure should just stop things.
 */
export function unwrapOrThrow<T>(outcome: FetchOutcome<T>): T {
  const result = unwrap(outcome);
  if (result.ok) {
    return result.value;
  }
  throw Object.assign(new Error(result.error.message), {
    name: "MatchdayApiError",
    status: result.error.status,
    cause: result.error.cause,
  });
}
