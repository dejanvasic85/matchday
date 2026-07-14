// Structured logger contract (AGENTS.md): injected as a dependency so services stay unit-testable
// and tests can assert on log calls. Events are dotted namespaces, e.g. "crawl.competition".

export type LogFields = Record<string, unknown>;

export type Logger = {
  debug: (event: string, msg: string, fields?: LogFields) => void;
  info: (event: string, msg: string, fields?: LogFields) => void;
  warn: (event: string, msg: string, fields?: LogFields) => void;
  error: (event: string, msg: string, fields?: LogFields) => void;
};
