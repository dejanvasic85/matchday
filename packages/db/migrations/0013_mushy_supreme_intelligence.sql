CREATE TABLE "client_club" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"club_id" text NOT NULL,
	"webhook_url" text,
	"webhook_secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_club" ADD CONSTRAINT "client_club_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_club" ADD CONSTRAINT "client_club_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_club_client_club_key" ON "client_club" USING btree ("client_id","club_id");--> statement-breakpoint
ALTER TABLE "client_subscription" DROP COLUMN "webhook_url";--> statement-breakpoint
ALTER TABLE "client_subscription" DROP COLUMN "webhook_secret";