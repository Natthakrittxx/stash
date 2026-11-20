-- Was 0006 before the squash. Every name carries its schema, so the body works
-- whatever search_path a pooled connection happens to have (ADR 0002).
CREATE FUNCTION "stash"."spend_fetch"(account text, budget integer) RETURNS boolean LANGUAGE sql AS $$
  WITH spent AS (
    INSERT INTO "stash"."fetch_budget" AS b (user_id, window_start, used)
    VALUES (account, now(), 1)
    ON CONFLICT (user_id) DO UPDATE SET
      used = CASE WHEN b.window_start <= now() - interval '1 hour' THEN 1 ELSE b.used + 1 END,
      window_start = CASE WHEN b.window_start <= now() - interval '1 hour' THEN now() ELSE b.window_start END
    WHERE b.window_start <= now() - interval '1 hour' OR b.used < budget
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM spent)
$$;
