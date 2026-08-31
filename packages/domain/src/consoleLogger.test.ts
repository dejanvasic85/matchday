import { createConsoleLogger } from "#consoleLogger.ts";

/** Run `fn` with `globalThis.process` removed, mimicking a Workers isolate without `nodejs_compat`. */
function withoutProcess(fn: () => void): void {
  const original = Reflect.getOwnPropertyDescriptor(globalThis, "process");
  Reflect.deleteProperty(globalThis, "process");
  try {
    fn();
  } finally {
    if (original !== undefined) {
      Reflect.defineProperty(globalThis, "process", original);
    }
  }
}

describe("createConsoleLogger", () => {
  it("writes debug through console.log as one JSON line", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createConsoleLogger().debug("scheduler.skipped", "outside a game window");

    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
      level: "debug",
      event: "scheduler.skipped",
      msg: "outside a game window",
    });
  });

  it("writes info through console.log, not console.warn or console.error", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    createConsoleLogger().info("scheduler.dispatched", "dispatched crawl workflow");

    expect(log).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("routes warn through console.warn so Workers Logs classifies it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    createConsoleLogger().warn("webhook.targetlookupfailed", "lookup failed");

    expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({ level: "warn" });
  });

  it("routes error through console.error so Workers Logs classifies it", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    createConsoleLogger().error("crawlleagues.failed", "crawl failed");

    expect(JSON.parse(error.mock.calls[0][0])).toMatchObject({ level: "error" });
  });

  it("merges fields into the line and stamps a time", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createConsoleLogger().info("scheduler.dispatched", "dispatched", {
      workflow: "a.yml",
      page: 3,
    });

    const line = JSON.parse(log.mock.calls[0][0]);
    expect(line).toMatchObject({ workflow: "a.yml", page: 3 });
    expect(Date.parse(line.time)).not.toBeNaN();
  });

  // Regression: `process.stdout.write` threw "process is not defined" on every scheduler tick.
  it("logs every level without touching process", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createConsoleLogger();

    withoutProcess(() => {
      expect(() => {
        logger.debug("e", "m");
        logger.info("e", "m");
        logger.warn("e", "m");
        logger.error("e", "m");
      }).not.toThrow();
    });

    // Not just "didn't throw" — a silently no-op `write` would also satisfy that.
    expect(log).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
