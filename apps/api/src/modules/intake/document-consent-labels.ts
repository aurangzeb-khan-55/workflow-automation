import { ConsentType, DocumentType } from "@prisma/client";

/** Human-readable labels for "what's missing" messages surfaced to the patient on an incomplete submit. */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  insurance_card_front: "Insurance Card (Front)",
  insurance_card_back: "Insurance Card (Back)",
  drivers_license: "Driver's License",
  referral: "Referral Form",
  prior_record: "Prior Medical Record",
  mammogram: "Mammogram Results",
  pap_smear: "Pap Smear Results",
  other: "Other Document",
};

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  consent_to_treat: "Consent to Treat",
  hipaa_privacy_acknowledgement: "HIPAA Privacy Acknowledgement",
  financial_responsibility: "Financial Responsibility Agreement",
  telehealth_consent: "Telehealth Consent",
};

/** The exact legal text the patient portal shows and the patient signs against — mirrored here (apps/web's labels.ts has the same copy) so the generated consent PDF reflects what was actually agreed to. */
export const CONSENT_TYPE_TEXT: Record<ConsentType, string> = {
  consent_to_treat:
    "I voluntarily consent to examination and treatment by the clinical staff of this practice, including any procedures reasonably necessary to diagnose or treat my condition.",
  hipaa_privacy_acknowledgement:
    "I acknowledge that I have been given the opportunity to review this practice's Notice of Privacy Practices, describing how my health information may be used and disclosed.",
  financial_responsibility:
    "I understand that I am financially responsible for charges not covered by my insurance, and agree to the practice's billing and payment policies.",
  telehealth_consent:
    "I consent to receive care via telehealth (audio/video) technology, understanding its benefits and limitations relative to an in-person visit.",
};

export function documentTypeLabel(type: DocumentType): string {
  return DOCUMENT_TYPE_LABELS[type];
}

export function consentTypeLabel(type: ConsentType): string {
  return CONSENT_TYPE_LABELS[type];
}
