---
"@dejanvasic85/matchday-sdk": patch
---

Document that `leagueId` comes from the verified webhook body, and that matchday never appends it
to the delivery URL — so receivers route cache revalidation off signed data only.
