DROP INDEX "subscription_client_league_key";--> statement-breakpoint
ALTER TABLE "subscription" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_client_league_key" ON "subscription" USING btree ("client_id","league_id");--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "client_name";