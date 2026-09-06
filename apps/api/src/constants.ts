// Tunables for the API's own behaviour, kept out of the services that read them.

/** How last-use tracking trades accuracy for writes. A token in constant use is stamped once per
 * window instead of once per request, so the date is accurate to the hour — enough to answer
 * "is anyone still calling with this?" without a DB write on every authenticated call. */
export const apiTokenUsageValue = {
  recordWindowMs: 60 * 60 * 1000,
} as const;
