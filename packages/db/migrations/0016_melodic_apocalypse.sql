CREATE TABLE "competition_season" (
	"id" text PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"season_id" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "season" ADD COLUMN "source" text;--> statement-breakpoint
UPDATE "season" s SET "source" = er."source" FROM "external_ref" er WHERE er."entity_type" = 'season' AND er."internal_id" = s."id" AND s."source" IS NULL;--> statement-breakpoint
ALTER TABLE "season" ALTER COLUMN "source" SET NOT NULL;--> statement-breakpoint
INSERT INTO "competition_season" ("id", "competition_id", "season_id", "starts_on", "ends_on")
SELECT
	'cse_' || substr(md5(random()::text || clock_timestamp()::text || l."competition_id" || l."season_id"), 1, 12),
	l."competition_id",
	l."season_id",
	s."starts_on",
	s."ends_on"
FROM (SELECT DISTINCT "competition_id", "season_id" FROM "league") l
JOIN "season" s ON s."id" = l."season_id";--> statement-breakpoint
ALTER TABLE "competition_season" ADD CONSTRAINT "competition_season_competition_id_competition_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_season" ADD CONSTRAINT "competition_season_season_id_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."season"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competition_season_competition_season_key" ON "competition_season" USING btree ("competition_id","season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "season_source_name_key" ON "season" USING btree ("source","name");
