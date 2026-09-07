// Thresholds the client services report against, named here so a report and its test agree.

/** When a token stops looking healthy. `idleAfterDays` is a season's worth of silence — long
 * enough that an off-season client isn't flagged; `renewAfterDays` is the rotation prompt. */
export const apiTokenLifecycleValue = {
  msPerDay: 24 * 60 * 60 * 1000,
  idleAfterDays: 90,
  renewAfterDays: 365,
} as const;
