/** Mirrors apps/api's document-consent-labels.ts — kept local since the frontend has no shared-types link to the API's Prisma enums. */
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  insurance_card_front: "Insurance Card (Front)",
  insurance_card_back: "Insurance Card (Back)",
  drivers_license: "Driver's License",
  referral: "Referral Form",
  prior_record: "Prior Medical Record",
  mammogram: "Mammogram Results",
  pap_smear: "Pap Smear Results",
  other: "Other Document",
};

export const CONSENT_TYPE_LABELS: Record<string, string> = {
  consent_to_treat: "Consent to Treat",
  hipaa_privacy_acknowledgement: "HIPAA Privacy Acknowledgement",
  financial_responsibility: "Financial Responsibility Agreement",
  telehealth_consent: "Telehealth Consent",
};

export const CONSENT_TYPE_TEXT: Record<string, string> = {
  consent_to_treat:
    "I voluntarily consent to examination and treatment by the clinical staff of this practice, including any procedures reasonably necessary to diagnose or treat my condition.",
  hipaa_privacy_acknowledgement:
    "I acknowledge that I have been given the opportunity to review this practice's Notice of Privacy Practices, describing how my health information may be used and disclosed.",
  financial_responsibility:
    "I understand that I am financially responsible for charges not covered by my insurance, and agree to the practice's billing and payment policies.",
  telehealth_consent:
    "I consent to receive care via telehealth (audio/video) technology, understanding its benefits and limitations relative to an in-person visit.",
};

export function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type] ?? type;
}

export function consentTypeLabel(type: string): string {
  return CONSENT_TYPE_LABELS[type] ?? type;
}
