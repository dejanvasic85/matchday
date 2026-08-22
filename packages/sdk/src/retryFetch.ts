// Timeout + bounded retry, applied by the client so callers stop hand-rolling
// `AbortSignal.timeout(...)` at every call site.

/** openapi-fetch always calls its `fetch` with a built `Request`, never `(input, init)`. */
export type FetchLike = (request: Request) => Promise<Response>;

export type RetryFetchOptions = {
  fetch: FetchLike;
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
};

const retryableMethodValue = new Set(["GET", "HEAD", "OPTIONS"]);
const firstRetryableStatus = 500;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Aborts when either the caller's signal or the timeout fires, without discarding whichever one
 * the caller passed. */
function withTimeout(signal: AbortSignal | null, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** Retries only idempotent methods, and only on 5xx or a failed request — never on a 4xx, which
 * says the request itself was wrong and will stay wrong. A retried `Request` is rebuilt per
 * attempt because a consumed body can't be re-sent; safe here since only bodyless methods retry. */
export function createRetryFetch(options: RetryFetchOptions): FetchLike {
  const { fetch: baseFetch, timeoutMs, retries, retryDelayMs, sleep = defaultSleep } = options;

  return async (request) => {
    const retryable = retryableMethodValue.has(request.method.toUpperCase());
    const attempts = retryable ? retries + 1 : 1;

    let lastFailure: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) {
        await sleep(retryDelayMs * attempt);
      }

      const attemptRequest = new Request(request, {
        signal: withTimeout(request.signal, timeoutMs),
      });

      try {
        const response = await baseFetch(attemptRequest);

        if (response.status < firstRetryableStatus || attempt === attempts - 1) {
          return response;
        }
        lastFailure = response;
      } catch (cause) {
        if (attempt === attempts - 1) {
          throw cause;
        }
        lastFailure = cause;
      }
    }

    // Unreachable: the loop returns or throws on its final attempt.
    throw lastFailure;
  };
}
