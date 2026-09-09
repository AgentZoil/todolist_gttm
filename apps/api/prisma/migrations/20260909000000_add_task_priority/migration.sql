-- AddTaskPriority
CREATE TYPE "TaskPriority" AS ENUM ('URGENT', 'NORMAL');

ALTER TABLE "tasks"
ADD COLUMN "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL';
