import { ConfigService } from "@nestjs/config";
import { createTransport } from "nodemailer";
import { promises as dns } from "dns";
import { SmtpEmailProvider } from "./smtp-email.provider";

jest.mock("nodemailer");
jest.mock("dns", () => ({ promises: { resolve4: jest.fn() } }));

describe("SmtpEmailProvider", () => {
  const PASSWORD = "super-secret-smtp-password-must-never-be-logged";

  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  function makeConfig(overrides: Record<string, string | number | undefined> = {}) {
    const values: Record<string, string | number | undefined> = {
      "email.smtpHost": "atriawell.com",
      "email.smtpPort": 465,
      "email.smtpUser": "test@atriawell.com",
      "email.smtpPassword": PASSWORD,
      "email.fromAddress": "test@atriawell.com",
      ...overrides,
    };
    return { get: (key: string) => values[key] } as unknown as ConfigService;
  }

  beforeEach(() => {
    // Nest's default Logger writes through process.stdout/stderr, not console.log.
    stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    jest.clearAllMocks();
    (dns.resolve4 as jest.Mock).mockResolvedValue(["203.0.113.10"]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function allLoggedText(): string {
    return [...stdoutSpy.mock.calls, ...stderrSpy.mock.calls].map((args) => String(args[0])).join("\n");
  }

  it("sends via the configured SMTP host and maps a successful response", async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: "<abc123@atriawell.com>", rejected: [] });
    (createTransport as jest.Mock).mockReturnValue({ sendMail });

    const provider = new SmtpEmailProvider(makeConfig());
    const result = await provider.send({
      to: "patient@example.com",
      subject: "Complete Your Patient Registration",
      html: "<p>Hi</p>",
    });

    expect(result).toEqual({ providerMessageId: "<abc123@atriawell.com>", provider: "smtp" });
    expect(dns.resolve4).toHaveBeenCalledWith("atriawell.com");
    expect(createTransport).toHaveBeenCalledWith({
      host: "203.0.113.10",
      port: 465,
      secure: true,
      auth: { user: "test@atriawell.com", pass: PASSWORD },
      tls: { servername: "atriawell.com" },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "test@atriawell.com",
        to: "patient@example.com",
        subject: "Complete Your Patient Registration",
        html: "<p>Hi</p>",
      }),
    );
  });

  it("falls back to connecting by hostname when the SMTP host has no A record", async () => {
    (dns.resolve4 as jest.Mock).mockRejectedValue(Object.assign(new Error("no A record"), { code: "ENODATA" }));
    const sendMail = jest.fn().mockResolvedValue({ messageId: "<abc@atriawell.com>", rejected: [] });
    (createTransport as jest.Mock).mockReturnValue({ sendMail });

    const provider = new SmtpEmailProvider(makeConfig());
    await provider.send({ to: "patient@example.com", subject: "s", html: "h" });

    expect(createTransport).toHaveBeenCalledWith({
      host: "atriawell.com",
      port: 465,
      secure: true,
      auth: { user: "test@atriawell.com", pass: PASSWORD },
    });
  });

  it("defaults the From address to the authenticated SMTP user when fromAddress isn't set", async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: "<x@atriawell.com>", rejected: [] });
    (createTransport as jest.Mock).mockReturnValue({ sendMail });

    const provider = new SmtpEmailProvider(makeConfig({ "email.fromAddress": undefined }));
    await provider.send({ to: "patient@example.com", subject: "s", html: "h" });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "test@atriawell.com" }));
  });

  it("throws when the SMTP server rejects the recipient, even though sendMail resolved", async () => {
    const sendMail = jest
      .fn()
      .mockResolvedValue({ messageId: "<abc@atriawell.com>", rejected: ["patient@example.com"] });
    (createTransport as jest.Mock).mockReturnValue({ sendMail });

    const provider = new SmtpEmailProvider(makeConfig());
    await expect(provider.send({ to: "patient@example.com", subject: "s", html: "h" })).rejects.toThrow(
      /rejected/,
    );
  });

  it("wraps a send failure in a plain error", async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error("Invalid login: 535-5.7.8"));
    (createTransport as jest.Mock).mockReturnValue({ sendMail });

    const provider = new SmtpEmailProvider(makeConfig());
    await expect(provider.send({ to: "patient@example.com", subject: "s", html: "h" })).rejects.toThrow(
      /SMTP send failed/,
    );
  });

  it("throws a clear error when SMTP_HOST/SMTP_USER/SMTP_PASSWORD are not set", async () => {
    const provider = new SmtpEmailProvider(makeConfig({ "email.smtpPassword": undefined }));
    await expect(provider.send({ to: "a@example.com", subject: "s", html: "h" })).rejects.toThrow(
      /SMTP_HOST.*SMTP_USER.*SMTP_PASSWORD/,
    );
  });

  it("THE STANDING REQUIREMENT: never logs the SMTP password, on success or failure", async () => {
    const sendMailOk = jest.fn().mockResolvedValue({ messageId: "<ok@atriawell.com>", rejected: [] });
    const sendMailFail = jest.fn().mockRejectedValue(new Error("Invalid login"));
    (createTransport as jest.Mock)
      .mockReturnValueOnce({ sendMail: sendMailOk })
      .mockReturnValueOnce({ sendMail: sendMailFail });

    const provider = new SmtpEmailProvider(makeConfig());
    await provider.send({ to: "a@example.com", subject: "s", html: "h" });
    await provider.send({ to: "a@example.com", subject: "s", html: "h" }).catch(() => undefined);

    expect(allLoggedText()).not.toContain(PASSWORD);
  });
});
