CREATE TABLE "stash"."tags" (
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_user_id_name_pk" PRIMARY KEY("user_id","name")
);
--> statement-breakpoint
ALTER TABLE "stash"."tags" ADD CONSTRAINT "tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "stash"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Tags are lowercase (ADR 0004): "Git" and "git" on one item become one "git",
-- kept where the first of them stood.
UPDATE "stash"."items" SET "tags" = ARRAY(
	SELECT lower(t) FROM unnest("tags") WITH ORDINALITY AS u(t, i)
	GROUP BY lower(t) ORDER BY min(i)
) WHERE cardinality("tags") > 0;--> statement-breakpoint
-- Every name already on an account's items becomes one of its tags.
INSERT INTO "stash"."tags" ("user_id", "name")
	SELECT DISTINCT "user_id", unnest("tags") FROM "stash"."items"
ON CONFLICT DO NOTHING;
