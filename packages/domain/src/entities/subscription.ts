import { z } from "zod";

// A client subscribes to one of our leagues (ADR 0012): the subscription drives the deep crawl
// (fixtures + tables are crawled only for subscribed leagues). It stores our internal `lea_` id,
// never a Dribl name/hash — the league already ties competition + season (0011), so the
// subscription is season-scoped through it. `clientName` is plain text for now; a real client
// entity + Sanity team ref is future work.
export const subscriptionSchema = z.object({
  id: z.string(),
  clientName: z.string(),
  leagueId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;
