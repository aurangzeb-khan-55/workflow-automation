export enum DocumentType {
  INSURANCE_CARD_FRONT = "insurance_card_front",
  INSURANCE_CARD_BACK = "insurance_card_back",
  DRIVERS_LICENSE = "drivers_license",
  REFERRAL = "referral",
  PRIOR_RECORD = "prior_record",
  MAMMOGRAM = "mammogram",
  PAP_SMEAR = "pap_smear",
  OTHER = "other",
}

export enum ConsentType {
  CONSENT_TO_TREAT = "consent_to_treat",
  HIPAA_PRIVACY_ACKNOWLEDGEMENT = "hipaa_privacy_acknowledgement",
  FINANCIAL_RESPONSIBILITY = "financial_responsibility",
  TELEHEALTH_CONSENT = "telehealth_consent",
}

export enum IntakeSectionType {
  PERSONAL_INFO = "personal_info",
  MEDICAL_HISTORY = "medical_history",
  INSURANCE_INFO = "insurance_info",
  CONSENTS = "consents",
}

export enum NotificationChannel {
  EMAIL = "email",
  SMS = "sms",
}

export enum NotificationRecipientType {
  PATIENT = "patient",
  STAFF = "staff",
}

export enum SummarySource {
  DB_GENERATED = "db_generated",
  AI_GENERATED = "ai_generated",
}
