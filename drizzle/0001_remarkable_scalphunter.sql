ALTER TABLE "items" DROP CONSTRAINT "items_kind_shape";--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_kind_shape" CHECK (("items"."kind" IN ('tool', 'image') AND "items"."url" IS NOT NULL AND "items"."cmd" IS NULL)
       OR ("items"."kind" = 'formula' AND "items"."cmd" IS NOT NULL AND "items"."url" IS NULL));