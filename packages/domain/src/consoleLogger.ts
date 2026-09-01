// Production `Logger` implementation (AGENTS.md): one JSON line per call. `warn`/`error` route
// through `console.warn`/`console.error` so Cloudflare Workers Logs classifies them correctly.
//
// Console only, never `process`: this runs in Workers isolates without `nodejs_compat`, where
// `process` is undefined and touching it throws. `console.log` still reaches stdout under Node.

import type { LogFields, Logger } from "#logger.ts";

type LogLevel = "debug" | "info" | "warn" | "error";

function write(level: LogLevel, event: string, msg: string, fields?: LogFields): void {
  const line = JSON.stringify({ level, event, msg, ...fields, time: new Date().toISOString() });
  switch (level) {
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
    default:
      // The sanctioned console.log: this module is the transport no-console funnels others into.
      // oxlint-disable-next-line no-console
      console.log(line);
  }
}

export function createConsoleLogger(): Logger {
  return {
    debug: (event, msg, fields) => write("debug", event, msg, fields),
    info: (event, msg, fields) => write("info", event, msg, fields),
    warn: (event, msg, fields) => write("warn", event, msg, fields),
    error: (event, msg, fields) => write("error", event, msg, fields),
  };
}
