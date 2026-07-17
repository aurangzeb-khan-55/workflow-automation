-- AlterTable
ALTER TABLE "intakes" ADD COLUMN     "required_consent_types" "ConsentType"[] DEFAULT ARRAY['consent_to_treat', 'hipaa_privacy_acknowledgement', 'financial_responsibility']::"ConsentType"[],
ADD COLUMN     "required_document_types" "DocumentType"[] DEFAULT ARRAY[]::"DocumentType"[];

