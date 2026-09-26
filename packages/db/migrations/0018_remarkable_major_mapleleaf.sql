CREATE TABLE "crawl_target" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"league_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawl_target" ADD CONSTRAINT "crawl_target_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crawl_target_competition_league_key" ON "crawl_target" USING btree ("competition_id","league_name");--> statement-breakpoint
-- Seed one target per league currently in crawl scope, so the first crawl after the change covers
-- the same leagues. A league's season row is dropped, so the target keeps only competition + name.
INSERT INTO "crawl_target" ("id", "competition_id", "league_name")
SELECT
	'crt_' || substr(md5(random()::text || clock_timestamp()::text || t."competition_id" || t."league_name"), 1, 12),
	t."competition_id",
	t."league_name"
FROM (
	SELECT DISTINCT l."competition_id", l."name" AS "league_name"
	FROM "client_subscription" s
	JOIN "league" l ON l."id" = s."league_id"
	WHERE s."deleted_at" IS NULL
) t
ON CONFLICT ("competition_id", "league_name") DO NOTHING;