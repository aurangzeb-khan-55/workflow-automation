-- AlterEnum
BEGIN;
CREATE TYPE "IntakeStatus_new" AS ENUM ('draft', 'intake_email_sent', 'patient_started_intake', 'waiting_for_patient', 'missing_documents', 'intake_submitted', 'ready_for_staff_review', 'uploaded_to_jane', 'completed');
ALTER TABLE "intakes" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "intakes" ALTER COLUMN "status" TYPE "IntakeStatus_new" USING ("status"::text::"IntakeStatus_new");
ALTER TYPE "IntakeStatus" RENAME TO "IntakeStatus_old";
ALTER TYPE "IntakeStatus_new" RENAME TO "IntakeStatus";
DROP TYPE "IntakeStatus_old";
ALTER TABLE "intakes" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "intakes" ALTER COLUMN "secure_token" DROP NOT NULL,
ALTER COLUMN "token_expires_at" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'draft';

