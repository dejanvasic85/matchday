ALTER TABLE "subscription" RENAME TO "client_subscription";--> statement-breakpoint
ALTER TABLE "api_token" RENAME TO "client_api_token";--> statement-breakpoint
ALTER TABLE "client_subscription" RENAME CONSTRAINT "subscription_client_id_client_id_fk" TO "client_subscription_client_id_client_id_fk";--> statement-breakpoint
ALTER TABLE "client_subscription" RENAME CONSTRAINT "subscription_league_id_league_id_fk" TO "client_subscription_league_id_league_id_fk";--> statement-breakpoint
ALTER TABLE "client_api_token" RENAME CONSTRAINT "api_token_client_id_client_id_fk" TO "client_api_token_client_id_client_id_fk";--> statement-breakpoint
ALTER INDEX "subscription_client_league_key" RENAME TO "client_subscription_client_league_key";--> statement-breakpoint
ALTER INDEX "api_token_token_hash_key" RENAME TO "client_api_token_token_hash_key";--> statement-breakpoint
ALTER INDEX "api_token_client_idx" RENAME TO "client_api_token_client_idx";
