import { ConfigService } from "@nestjs/config";
import { MailHippoEmailProvider } from "./mailhippo-email.provider";

describe("MailHippoEmailProvider", () => {
  const SECRET = "super-secret-mailhippo-key-must-never-be-logged";

  let stdoutSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;

  function makeConfig(overrides: Record<string, string | undefined> = {}) {
    const values: Record<string, string | undefined> = {
      "email.mailhippoApiKey": SECRET,
      "email.fromAddress": "intake@atriawellness.com",
      ...overrides,
    };
    return { get: (key: string) => values[key] } as unknown as ConfigService;
  }

  beforeEach(() => {
    // Nest's default Logger writes through process.stdout/stderr — spying
    // here (rather than console.log) captures log output the same way
    // regardless of which specific logging call was used internally.
    stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function allLoggedText(): string {
    return [...stdoutSpy.mock.calls, ...stderrSpy.mock.calls].map((args) => String(args[0])).join("\n");
  }

  it("sends the correct request shape and maps a successful response", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messageId: 17703, status: "Sent", displayName: "Atria Wellness" }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const provider = new MailHippoEmailProvider(makeConfig());
    const result = await provider.send({
      to: "patient@example.com",
      subject: "Complete Your Patient Registration",
      html: "<p>Hi</p>",
    });

    expect(result).toEqual({ providerMessageId: "17703", provider: "mailhippo" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mailhippo.com/SendMessage",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Auth-Secret": SECRET, "Content-Type": "application/json" }),
      }),
    );
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({
      FromEmail: "intake@atriawellness.com",
      ToEmails: ["patient@example.com"],
      CcEmails: [],
      BccEmails: [],
      Subject: "Complete Your Patient Registration",
      Body: "<p>Hi</p>",
      Attachments: [],
    });
  });

  it("includes attachments in the request body when provided", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messageId: 1, status: "Sent" }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    const provider = new MailHippoEmailProvider(makeConfig());
    await provider.send({
      to: "a@example.com",
      subject: "s",
      html: "h",
      attachments: [{ filename: "packet.pdf", content: "YmFzZTY0", contentType: "application/pdf" }],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.Attachments).toEqual([{ FileName: "packet.pdf", Content: "YmFzZTY0", ContentType: "application/pdf" }]);
  });

  it("treats a non-Sent status as a failure even with HTTP 200 — 200 OK alone is not delivery confirmation", async () => {
    (global as unknown as { fetch: typeof fetch }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messageId: 17704, status: "Rejected" }),
    });

    const provider = new MailHippoEmailProvider(makeConfig());
    await expect(provider.send({ to: "patient@example.com", subject: "s", html: "h" })).rejects.toThrow(
      /did not confirm delivery/,
    );
  });

  it("treats a non-2xx HTTP response as a failure", async () => {
    (global as unknown as { fetch: typeof fetch }).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ status: "Unauthorized" }),
    });

    const provider = new MailHippoEmailProvider(makeConfig());
    await expect(provider.send({ to: "patient@example.com", subject: "s", html: "h" })).rejects.toThrow();
  });

  it("throws a clear error when MAILHIPPO_API_KEY is not set", async () => {
    const provider = new MailHippoEmailProvider(makeConfig({ "email.mailhippoApiKey": undefined }));
    await expect(provider.send({ to: "a@example.com", subject: "s", html: "h" })).rejects.toThrow(
      /MAILHIPPO_API_KEY is not set/,
    );
  });

  it("THE STANDING REQUIREMENT: never logs the X-Auth-Secret value, on success, rejection, or HTTP failure", async () => {
    (global as unknown as { fetch: typeof fetch }).fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ messageId: 1, status: "Sent" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ messageId: 2, status: "Rejected" }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ status: "Unauthorized" }) });

    const provider = new MailHippoEmailProvider(makeConfig());
    await provider.send({ to: "a@example.com", subject: "s", html: "h" });
    await provider.send({ to: "a@example.com", subject: "s", html: "h" }).catch(() => undefined);
    await provider.send({ to: "a@example.com", subject: "s", html: "h" }).catch(() => undefined);

    expect(allLoggedText()).not.toContain(SECRET);
  });
});
