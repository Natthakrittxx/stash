CREATE TABLE "fetch_budget" (
	"user_id" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"used" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fetch_budget" ADD CONSTRAINT "fetch_budget_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE FUNCTION spend_fetch(account text, budget integer) RETURNS boolean LANGUAGE sql AS $$
  WITH spent AS (
    INSERT INTO fetch_budget AS b (user_id, window_start, used)
    VALUES (account, now(), 1)
    ON CONFLICT (user_id) DO UPDATE SET
      used = CASE WHEN b.window_start <= now() - interval '1 hour' THEN 1 ELSE b.used + 1 END,
      window_start = CASE WHEN b.window_start <= now() - interval '1 hour' THEN now() ELSE b.window_start END
    WHERE b.window_start <= now() - interval '1 hour' OR b.used < budget
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM spent)
$$;
