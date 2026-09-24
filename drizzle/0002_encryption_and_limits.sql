CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notebooks" ALTER COLUMN "title" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "notebooks" ADD COLUMN "title_enc" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "title_enc" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "content_enc" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "enc_version" smallint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wrapped_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_wrapped_key" text;--> statement-breakpoint
CREATE INDEX "pages_user_idx" ON "pages" USING btree ("user_id");