CREATE TABLE "api_token" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_token_token_hash_key" ON "api_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_token_client_idx" ON "api_token" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_name_key" ON "client" USING btree ("name");--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;