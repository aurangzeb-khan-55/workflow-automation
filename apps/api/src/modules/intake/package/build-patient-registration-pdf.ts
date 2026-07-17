import { Patient } from "@prisma/client";
import { drawField, startPdfPage } from "./pdf-helpers";

interface PersonalInfoData {
  address?: { street?: string; city?: string; state?: string; zip?: string };
  phone?: string;
  email?: string;
  gender?: string;
  preferredPharmacy?: string;
  emergencyContact?: { name?: string; phone?: string; relationship?: string };
}

interface InsuranceInfoData {
  noInsurance?: boolean;
  payerName?: string;
  policyNumber?: string;
  groupNumber?: string;
  subscriberName?: string;
  relationshipToSubscriber?: string;
}

/** Built from the intake's personal_info section (plus a short insurance summary) — the "Patient Registration" document in the staff package. */
export async function buildPatientRegistrationPdf(
  patient: Patient,
  personalInfo: PersonalInfoData | undefined,
  insuranceInfo: InsuranceInfoData | undefined,
): Promise<Uint8Array> {
  const cursor = await startPdfPage(
    "Patient Registration",
    `${patient.firstName} ${patient.lastName} — DOB ${formatDate(patient.dob)}`,
  );

  const address = personalInfo?.address;
  drawField(cursor, "Full Name", `${patient.firstName} ${patient.lastName}`);
  drawField(cursor, "Date of Birth", formatDate(patient.dob));
  drawField(cursor, "Phone", personalInfo?.phone || patient.phone);
  drawField(cursor, "Email", personalInfo?.email || patient.email);
  drawField(
    cursor,
    "Address",
    address ? `${address.street ?? ""}, ${address.city ?? ""}, ${address.state ?? ""} ${address.zip ?? ""}` : "—",
  );
  drawField(cursor, "Gender", personalInfo?.gender || "—");
  drawField(cursor, "Preferred Pharmacy", personalInfo?.preferredPharmacy || "—");

  const ec = personalInfo?.emergencyContact;
  drawField(
    cursor,
    "Emergency Contact",
    ec && (ec.name || ec.phone) ? `${ec.name ?? "—"} (${ec.relationship ?? "—"}) — ${ec.phone ?? "—"}` : "—",
  );

  if (insuranceInfo?.noInsurance) {
    drawField(cursor, "Insurance", "Self-pay (no insurance on file)");
  } else {
    drawField(cursor, "Insurance Provider", insuranceInfo?.payerName || "—");
    drawField(cursor, "Policy Number", insuranceInfo?.policyNumber || "—");
    drawField(cursor, "Group Number", insuranceInfo?.groupNumber || "—");
    drawField(
      cursor,
      "Subscriber",
      insuranceInfo?.subscriberName ? `${insuranceInfo.subscriberName} (${insuranceInfo.relationshipToSubscriber ?? "—"})` : "—",
    );
  }

  return cursor.doc.save();
}

function formatDate(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}
