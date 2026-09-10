CREATE TABLE "task_feedback_reads" (
    "feedback_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_feedback_reads_pkey" PRIMARY KEY ("feedback_id", "user_id")
);

CREATE INDEX "task_feedback_reads_user_id_read_at_idx" ON "task_feedback_reads"("user_id", "read_at");

ALTER TABLE "task_feedback_reads" ADD CONSTRAINT "task_feedback_reads_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "task_feedbacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_feedback_reads" ADD CONSTRAINT "task_feedback_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
