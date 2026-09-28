CREATE TYPE "RegistrationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "user_registration_requests" (
    "id" TEXT NOT NULL,
    "auth_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "status" "RegistrationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_registration_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_registration_requests_auth_user_id_key"
ON "user_registration_requests"("auth_user_id");

CREATE INDEX "user_registration_requests_status_created_at_idx"
ON "user_registration_requests"("status", "created_at");

CREATE INDEX "user_registration_requests_email_idx"
ON "user_registration_requests"("email");

ALTER TABLE "user_registration_requests"
ADD CONSTRAINT "user_registration_requests_reviewed_by_fkey"
FOREIGN KEY ("reviewed_by") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
