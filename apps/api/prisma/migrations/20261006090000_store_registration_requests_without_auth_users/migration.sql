ALTER TABLE "user_registration_requests"
ALTER COLUMN "auth_user_id" DROP NOT NULL;

CREATE UNIQUE INDEX "user_registration_requests_email_key"
ON "user_registration_requests"("email");

DROP INDEX "user_registration_requests_email_idx";
