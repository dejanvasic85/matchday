import type { Logger } from "@matchday/domain";

export function makeFakeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}
