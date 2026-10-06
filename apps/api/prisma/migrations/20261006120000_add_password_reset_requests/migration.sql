ALTER TABLE "users" ADD COLUMN "email" TEXT;

UPDATE "users" AS app_user
SET "email" = lower(auth_user.email)
FROM auth.users AS auth_user
WHERE auth_user.id::text = app_user.auth_user_id
  AND app_user.email IS NULL;

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TYPE "PasswordResetRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "user_password_reset_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "PasswordResetRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_password_reset_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_password_reset_requests_user_id_key"
ON "user_password_reset_requests"("user_id");

CREATE INDEX "user_password_reset_requests_status_created_at_idx"
ON "user_password_reset_requests"("status", "created_at");

ALTER TABLE "user_password_reset_requests"
ADD CONSTRAINT "user_password_reset_requests_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_password_reset_requests"
ADD CONSTRAINT "user_password_reset_requests_reviewed_by_fkey"
FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
