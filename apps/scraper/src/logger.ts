// Concrete console logger for the scraper CLI (transport layer). Emits one JSON line per event so
// the host (thanos / GH Actions / CF) can parse it; routes warn/error through console.warn/error so
// Cloudflare Workers Logs classifies them (AGENTS.md). The Logger *contract* lives in
// @matchday/domain and is injected into services — this factory is the real implementation the CLI
// constructs and threads through a job run.

import type { LogFields, Logger } from "@matchday/domain";

export type LogLevel = "debug" | "info" | "warn" | "error";

const levelRankValue = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const satisfies Record<LogLevel, number>;

type LogLine = {
  level: LogLevel;
  event: string;
  msg: string;
  time: string;
} & LogFields;

type LogSink = (line: string) => void;

// info/debug go to stdout via process.stdout (console.log is banned by no-console); warn/error go
// through console.warn/console.error so Cloudflare Workers Logs classifies them (AGENTS.md).
const stdoutSink: LogSink = (line) => {
  process.stdout.write(`${line}\n`);
};

function emit(
  sink: LogSink,
  level: LogLevel,
  event: string,
  msg: string,
  fields?: LogFields,
): void {
  const line: LogLine = { level, event, msg, time: new Date().toISOString(), ...fields };
  sink(JSON.stringify(line));
}

/** Builds a JSON-line console logger that suppresses events below `minLevel`. */
export function createConsoleLogger(minLevel: LogLevel): Logger {
  const threshold = levelRankValue[minLevel];
  const enabled = (level: LogLevel): boolean => levelRankValue[level] >= threshold;

  return {
    debug: (event, msg, fields) => {
      if (enabled("debug")) {
        emit(stdoutSink, "debug", event, msg, fields);
      }
    },
    info: (event, msg, fields) => {
      if (enabled("info")) {
        emit(stdoutSink, "info", event, msg, fields);
      }
    },
    warn: (event, msg, fields) => {
      if (enabled("warn")) {
        emit(console.warn, "warn", event, msg, fields);
      }
    },
    error: (event, msg, fields) => {
      if (enabled("error")) {
        emit(console.error, "error", event, msg, fields);
      }
    },
  };
}
