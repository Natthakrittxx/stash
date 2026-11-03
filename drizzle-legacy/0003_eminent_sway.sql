CREATE TABLE "collection_items" (
	"collection_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_collection_id_item_id_pk" PRIMARY KEY("collection_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_kind_shape";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "lat" double precision;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "lng" double precision;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_place_pin" CHECK (("items"."lat" IS NULL AND "items"."lng" IS NULL)
       OR ("items"."kind" = 'place' AND "items"."lat" IS NOT NULL AND "items"."lng" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_kind_shape" CHECK (("items"."kind" = 'tool' AND "items"."url" IS NOT NULL AND "items"."cmd" IS NULL)
       OR ("items"."kind" = 'formula' AND "items"."cmd" IS NOT NULL AND "items"."url" IS NULL)
       OR ("items"."kind" = 'place' AND "items"."url" IS NOT NULL AND "items"."cmd" IS NULL));