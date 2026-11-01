-- A setup code nobody redeemed has no use now: the first signup needs no code.
DELETE FROM "invite_code" WHERE "is_setup";--> statement-breakpoint
DROP INDEX "invite_code_one_setup";--> statement-breakpoint
ALTER TABLE "invite_code" DROP COLUMN "is_setup";