import { ConfigService } from "@nestjs/config";
import { createTransport } from "nodemailer";
import { GmailSmtpEmailProvider } from "./gmail-smtp-email.provider";

jest.mock("nodemailer");

describe("GmailSmtpEmailProvider (TEMPORARY testing provider)", () => {
  const APP_PASSWORD = "super-secret-gmail-app-password-must-never-be-logged";

  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  function makeConfig(overrides: Record<string, string | undefined> = {}) {
    const values: Record<string, string | undefined> = {
      "email.gmailUser": "sender@gmail.com",
      "email.gmailAppPassword": APP_PASSWORD,
      "email.fromAddress": "intake@atriawellness.com",
      ...overrides,
    };
    return { get: (key: string) => values[key] } as unknown as ConfigService;
  }

  beforeEach(() => {
    // Same rationale as MailHippoEmailProvider's tests — Nest's default
    // Logger writes through process.stdout/stderr, not console.log.
    stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function allLoggedText(): string {
    return [...stdoutSpy.mock.calls, ...stderrSpy.mock.calls].map((args) => String(args[0])).join("\n");
  }

  it("sends via Gmail SMTP with the correct transport config and maps a successful response", async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: "<abc123@gmail.com>", rejected: [] });
    (createTransport as jest.Mock).mockReturnValue({ sendMail });

    const provider = new GmailSmtpEmailProvider(makeConfig());
    const result = await provider.send({
      to: "patient@example.com",
      subject: "Complete Your Patient Registration",
      html: "<p>Hi</p>",
    });

    expect(result).toEqual({ providerMessageId: "<abc123@gmail.com>", provider: "gmail" });
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "sender@gmail.com", pass: APP_PASSWORD },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "intake@atriawellness.com",
        to: "patient@example.com",
        subject: "Complete Your Patient Registration",
        html: "<p>Hi</p>",
      }),
    );
  });

  it("throws when the SMTP server rejects the recipient, even though sendMail resolved", async () => {
    const sendMail = jest
      .fn()
      .mockResolvedValue({ messageId: "<abc@gmail.com>", rejected: ["patient@example.com"] });
    (createTransport as jest.Mock).mockReturnValue({ sendMail });

    const provider = new GmailSmtpEmailProvider(makeConfig());
    await expect(provider.send({ to: "patient@example.com", subject: "s", html: "h" })).rejects.toThrow(
      /rejected/,
    );
  });

  it("wraps a send failure in a plain error", async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error("Invalid login: 535-5.7.8"));
    (createTransport as jest.Mock).mockReturnValue({ sendMail });

    const provider = new GmailSmtpEmailProvider(makeConfig());
    await expect(provider.send({ to: "patient@example.com", subject: "s", html: "h" })).rejects.toThrow(
      /Gmail SMTP send failed/,
    );
  });

  it("throws a clear error when GMAIL_USER/GMAIL_APP_PASSWORD are not set", async () => {
    const provider = new GmailSmtpEmailProvider(makeConfig({ "email.gmailAppPassword": undefined }));
    await expect(provider.send({ to: "a@example.com", subject: "s", html: "h" })).rejects.toThrow(
      /GMAIL_USER.*GMAIL_APP_PASSWORD/,
    );
  });

  it("THE STANDING REQUIREMENT: never logs the app password, on success or failure", async () => {
    const sendMailOk = jest.fn().mockResolvedValue({ messageId: "<ok@gmail.com>", rejected: [] });
    const sendMailFail = jest.fn().mockRejectedValue(new Error("Invalid login"));
    (createTransport as jest.Mock)
      .mockReturnValueOnce({ sendMail: sendMailOk })
      .mockReturnValueOnce({ sendMail: sendMailFail });

    const provider = new GmailSmtpEmailProvider(makeConfig());
    await provider.send({ to: "a@example.com", subject: "s", html: "h" });
    await provider.send({ to: "a@example.com", subject: "s", html: "h" }).catch(() => undefined);

    expect(allLoggedText()).not.toContain(APP_PASSWORD);
  });
});
