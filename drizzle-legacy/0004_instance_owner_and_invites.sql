CREATE TABLE "invite_code" (
	"code" text PRIMARY KEY NOT NULL,
	"is_setup" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_code_one_setup" ON "invite_code" USING btree ("is_setup") WHERE is_setup;--> statement-breakpoint
CREATE UNIQUE INDEX "user_one_owner" ON "user" USING btree ("is_owner") WHERE is_owner;--> statement-breakpoint
-- An existing instance's earliest account becomes its Owner.
UPDATE "user" SET "is_owner" = true WHERE "id" = (SELECT "id" FROM "user" ORDER BY "created_at", "id" LIMIT 1);
