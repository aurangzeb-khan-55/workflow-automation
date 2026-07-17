import { buildIntakeInvitationEmail } from "./intake-email-template";

describe("buildIntakeInvitationEmail", () => {
  const baseInput = {
    patientFirstName: "Jane",
    intakeLink: "http://localhost:3000/intake/abc123",
    clinicName: "Atria Wellness",
  };

  it("greets the patient by name", () => {
    const { html } = buildIntakeInvitationEmail(baseInput);
    expect(html).toContain("Hi Jane,");
  });

  it("includes the secure intake link", () => {
    const { html } = buildIntakeInvitationEmail(baseInput);
    expect(html).toContain(baseInput.intakeLink);
  });

  it("mentions every section the patient will be asked to complete", () => {
    const { html } = buildIntakeInvitationEmail(baseInput);
    expect(html).toContain("Personal information");
    expect(html).toContain("Medical history");
    expect(html).toContain("Insurance information");
    expect(html).toContain("driver's license");
    expect(html).toContain("medical documents");
    expect(html).toContain("Consent to treat");
    expect(html).toContain("HIPAA");
    expect(html).toContain("financial responsibility");
  });

  it("includes the estimated completion time", () => {
    const { html } = buildIntakeInvitationEmail(baseInput);
    expect(html).toContain("8–10 minutes");
  });

  it("has a clear subject line", () => {
    const { subject } = buildIntakeInvitationEmail(baseInput);
    expect(subject).toBe("Complete Your Patient Registration");
  });

  it("escapes HTML in patient/clinic names to avoid injection into the email body", () => {
    const { html } = buildIntakeInvitationEmail({
      ...baseInput,
      patientFirstName: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
