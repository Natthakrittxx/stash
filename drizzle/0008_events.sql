ALTER TABLE "items" DROP CONSTRAINT "items_kind_shape";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_event_time" CHECK (("items"."starts_at" IS NULL AND "items"."ends_at" IS NULL)
       OR ("items"."kind" = 'event' AND "items"."starts_at" IS NOT NULL
           AND ("items"."ends_at" IS NULL OR "items"."ends_at" >= "items"."starts_at")));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_kind_shape" CHECK (("items"."kind" = 'tool' AND "items"."url" IS NOT NULL AND "items"."cmd" IS NULL)
       OR ("items"."kind" = 'formula' AND "items"."cmd" IS NOT NULL AND "items"."url" IS NULL)
       OR ("items"."kind" = 'place' AND "items"."url" IS NOT NULL AND "items"."cmd" IS NULL)
       OR ("items"."kind" = 'event' AND "items"."cmd" IS NULL));