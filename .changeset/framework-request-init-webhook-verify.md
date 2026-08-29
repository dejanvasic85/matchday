---
"@dejanvasic85/matchday-sdk": minor
---

Pass framework-specific `RequestInit` fields through to the API, and verify webhook signatures.

`getLeagueOverview` and `getLeagueTeams` take an optional third argument typed as the new
`MatchdayRequestInit` (`RequestInit` minus the fields the SDK already fixes). A Next.js consumer's
own `RequestInit` type augmentation flows straight through — no Next.js-specific type in the SDK:

```ts
await getLeagueTeams(client, leagueId, {
  next: { tags: [`matchday:league:${leagueId}`], revalidate: 3600 },
});
```

The retry layer now preserves any such custom property on every retry attempt, not just the first
— previously a retried request silently dropped it, because the standard `Request` constructor
only clones the fields it knows about.

Also adds `verifyWebhookSignature(rawBody, signatureHeader, secret)`, a Web Crypto-based verifier
for the `X-Matchday-Signature: sha256=<hex>` header matchday sends with every webhook delivery.
