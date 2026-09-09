CREATE TYPE "TaskApprovalStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'NEEDS_REVISION');
CREATE TYPE "TaskOfficialStatus" AS ENUM ('CANCELLED', 'IN_PROGRESS', 'INCOMPLETE', 'COMPLETED_EARLY', 'COMPLETED_ON_TIME', 'COMPLETED_LATE', 'NO_EVALUATION');
CREATE TYPE "TaskFeedbackType" AS ENUM ('DIRECTIVE', 'REVIEW');
CREATE TYPE "TaskFeedbackDecision" AS ENUM ('APPROVED', 'NEEDS_REVISION');

ALTER TABLE "tasks"
ADD COLUMN "approval_status" "TaskApprovalStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN "approved_status" "TaskOfficialStatus",
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "approved_by" TEXT;

CREATE TABLE "task_feedbacks" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "type" "TaskFeedbackType" NOT NULL,
    "decision" "TaskFeedbackDecision",
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_feedbacks_task_id_created_at_idx" ON "task_feedbacks"("task_id", "created_at");
ALTER TABLE "task_feedbacks" ADD CONSTRAINT "task_feedbacks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_feedbacks" ADD CONSTRAINT "task_feedbacks_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
