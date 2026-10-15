---
"matchday-sdk": minor
---

Add `followClub`, `unfollowClub` and `addLeagueCrawlTarget`, so a client can follow a club, set its webhook and ask for a league to be crawled without the `mday` CLI. `followClub` returns the webhook secret once, and following again issues a new one. The webhook must be an https URL with a public hostname.
