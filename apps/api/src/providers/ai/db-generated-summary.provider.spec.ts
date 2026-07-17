import { DbGeneratedSummaryProvider } from "./db-generated-summary.provider";
import { IntakeSummaryInput } from "./ai-summary-provider.interface";

describe("DbGeneratedSummaryProvider", () => {
  const provider = new DbGeneratedSummaryProvider();

  const baseInput: IntakeSummaryInput = {
    reasonForVisit: "Annual physical",
    conditions: ["Hypertension"],
    allergies: ["Penicillin"],
    medications: ["Lisinopril 10mg"],
    uploadedDocumentTypes: ["drivers_license", "insurance_card_front"],
    insuranceProvided: true,
    missingItems: [],
  };

  it("marks source as db_generated", async () => {
    const result = await provider.generateSummary(baseInput);
    expect(result.source).toBe("db_generated");
  });

  it("includes reason for visit, conditions, allergies, and medications", async () => {
    const result = await provider.generateSummary(baseInput);
    expect(result.summaryText).toContain("Annual physical");
    expect(result.summaryText).toContain("Hypertension");
    expect(result.summaryText).toContain("Penicillin");
    expect(result.summaryText).toContain("Lisinopril 10mg");
  });

  it("reports missing items when present", async () => {
    const result = await provider.generateSummary({
      ...baseInput,
      missingItems: ["Signed HIPAA acknowledgement"],
    });
    expect(result.summaryText).toContain("Signed HIPAA acknowledgement");
  });

  it("reports intake as complete when there are no missing items", async () => {
    const result = await provider.generateSummary(baseInput);
    expect(result.summaryText).toContain("intake is complete");
  });

  it("falls back to explicit 'None reported' text for empty clinical fields", async () => {
    const result = await provider.generateSummary({
      ...baseInput,
      conditions: [],
      allergies: [],
      medications: [],
    });
    expect(result.summaryText).toContain("Conditions: None reported");
    expect(result.summaryText).toContain("Allergies: None reported");
    expect(result.summaryText).toContain("Medications: None reported");
  });
});
