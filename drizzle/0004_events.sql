ALTER TABLE "stash"."items" DROP CONSTRAINT "items_kind_shape";--> statement-breakpoint
ALTER TABLE "stash"."items" ADD COLUMN "starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "stash"."items" ADD COLUMN "ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "stash"."items" ADD CONSTRAINT "items_event_time" CHECK (("stash"."items"."starts_at" IS NULL AND "stash"."items"."ends_at" IS NULL)
       OR ("stash"."items"."kind" = 'event' AND "stash"."items"."starts_at" IS NOT NULL
           AND ("stash"."items"."ends_at" IS NULL OR "stash"."items"."ends_at" >= "stash"."items"."starts_at")));--> statement-breakpoint
ALTER TABLE "stash"."items" ADD CONSTRAINT "items_kind_shape" CHECK (("stash"."items"."kind" = 'tool' AND "stash"."items"."url" IS NOT NULL AND "stash"."items"."cmd" IS NULL)
       OR ("stash"."items"."kind" = 'formula' AND "stash"."items"."cmd" IS NOT NULL AND "stash"."items"."url" IS NULL)
       OR ("stash"."items"."kind" = 'place' AND "stash"."items"."url" IS NOT NULL AND "stash"."items"."cmd" IS NULL)
       OR ("stash"."items"."kind" = 'event' AND "stash"."items"."cmd" IS NULL));