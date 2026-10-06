-- Keep task and feedback history if a user is permanently deleted.
CREATE TABLE "pending_auth_deletions" (
  "auth_user_id" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pending_auth_deletions_pkey" PRIMARY KEY ("auth_user_id")
);

ALTER TABLE "tasks" DROP CONSTRAINT "tasks_created_by_fkey";
ALTER TABLE "tasks" ALTER COLUMN "created_by" DROP NOT NULL;
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task_feedbacks" DROP CONSTRAINT "task_feedbacks_author_id_fkey";
ALTER TABLE "task_feedbacks" ALTER COLUMN "author_id" DROP NOT NULL;
ALTER TABLE "task_feedbacks"
  ADD CONSTRAINT "task_feedbacks_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
