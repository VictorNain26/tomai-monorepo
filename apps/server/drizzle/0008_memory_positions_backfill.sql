-- Each reset becomes the last exercise position at its date: from now on the memory compares positions, not clocks.
-- The dates are all the old rows hold; past resets keep the clock's order, later ones no longer depend on it.
UPDATE "student_profile" AS "profile"
SET "memory_reset_after" = (
  SELECT coalesce(max("exercise"."position"), 0)
  FROM "exercise"
  WHERE "exercise"."created_at" <= "profile"."memory_reset_at"
)
WHERE "profile"."memory_reset_at" IS NOT NULL;--> statement-breakpoint
UPDATE "learner_notion_reset" AS "reset"
SET "after_position" = (
  SELECT coalesce(max("exercise"."position"), 0)
  FROM "exercise"
  WHERE "exercise"."created_at" <= "reset"."reset_at"
);
