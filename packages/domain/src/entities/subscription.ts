import { z } from "zod";

// A client subscribes to one of our leagues, driving the deep crawl (fixtures +
// tables crawled only for subscribed leagues). Stores our internal `lea_` id, never a Dribl name.
export const subscriptionSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  leagueId: z.string(),
  // Optional post-crawl notification target, set/cleared independently of the
  // subscription itself.
  webhookUrl: z.string().nullable(),
  webhookSecret: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;
