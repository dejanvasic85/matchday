import { z } from "zod";

// A client subscribes to one of our leagues (ADR 0012): the subscription drives the deep crawl
// (fixtures + tables are crawled only for subscribed leagues). It stores our internal `lea_` id,
// never a Dribl name/hash — the league already ties competition + season (0011), so the
// subscription is season-scoped through it. `clientId` references the client entity (ADR 0013),
// which also owns API tokens.
export const subscriptionSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  leagueId: z.string(),
  // Optional post-crawl notification target (#105), set/cleared independently of the
  // subscription itself.
  webhookUrl: z.string().nullable(),
  webhookSecret: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;
