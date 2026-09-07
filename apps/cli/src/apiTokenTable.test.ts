import { renderApiTokenTable } from "#apiTokenTable.ts";
import { apiTokenStatusValue, type ApiTokenUsage } from "#services/apiTokenService.ts";

function makeToken(overrides: Partial<ApiTokenUsage> = {}): ApiTokenUsage {
  return {
    id: "tok_active0000",
    status: apiTokenStatusValue.active,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    lastUsedAt: new Date("2026-09-05T04:00:00.000Z"),
    revokedAt: null,
    ageDays: 248,
    idleDays: 1,
    renewalDue: false,
    ...overrides,
  };
}

describe("renderApiTokenTable", () => {
  it("prompts the operator to issue one when the client has no tokens", () => {
    expect(renderApiTokenTable([])).toContain("mday client create-token");
  });

  it("renders a token's id, status, issue date, age and last use", () => {
    const output = renderApiTokenTable([makeToken()]);
    const [, row] = output.split("\n");

    expect(row).toContain("tok_active0000");
    expect(row).toContain("active");
    expect(row).toContain("2026-01-01");
    expect(row).toContain("248d");
    expect(row).toContain("2026-09-05 (1d ago)");
  });

  it("says never for a token that has not authenticated a request", () => {
    const output = renderApiTokenTable([
      makeToken({ status: apiTokenStatusValue.unused, lastUsedAt: null, idleDays: null }),
    ]);

    expect(output).toContain("never");
  });

  it("calls out a token due for renewal alongside its status", () => {
    const output = renderApiTokenTable([makeToken({ renewalDue: true })]);

    expect(output).toContain("active, renew");
  });

  // A revoked token is already dead, so the service never marks one due — and nothing here
  // re-decides that.
  it("does not ask for renewal on a revoked token", () => {
    const output = renderApiTokenTable([
      makeToken({
        status: apiTokenStatusValue.revoked,
        revokedAt: new Date("2026-09-01T00:00:00.000Z"),
        renewalDue: false,
      }),
    ]);

    expect(output).toContain("revoked");
    expect(output).not.toContain("renew");
  });
});
