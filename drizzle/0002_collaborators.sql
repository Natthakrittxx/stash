CREATE TABLE "stash"."collaborators" (
	"collection_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collaborators_collection_id_user_id_pk" PRIMARY KEY("collection_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "stash"."collaborators" ADD CONSTRAINT "collaborators_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "stash"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stash"."collaborators" ADD CONSTRAINT "collaborators_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "stash"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collaborators_user_id_idx" ON "stash"."collaborators" USING btree ("user_id");