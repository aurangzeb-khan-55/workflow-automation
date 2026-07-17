import { Controller, Get } from "@nestjs/common";
import { connect } from "net";
import { promises as dns } from "dns";
import { Public } from "../modules/auth/decorators/public.decorator";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  /**
   * TEMPORARY — diagnosing why Render can resolve atriawell.com's IPv4
   * address but time out connecting to it on SMTP ports. Remove once the
   * SMTP delivery issue is resolved. Reveals only connect-succeeded/failed
   * booleans, no secrets.
   */
  @Public()
  @Get("network-check")
  async networkCheck() {
    const testPort = (host: string, port: number, timeoutMs = 6000): Promise<{ host: string; port: number; ok: boolean; error?: string }> =>
      new Promise((resolve) => {
        const socket = connect({ host, port, timeout: timeoutMs });
        const done = (ok: boolean, error?: string) => {
          socket.destroy();
          resolve({ host, port, ok, error });
        };
        socket.once("connect", () => done(true));
        socket.once("timeout", () => done(false, "timeout"));
        socket.once("error", (err) => done(false, err.message));
      });

    let resolvedIp: string | undefined;
    let resolveError: string | undefined;
    try {
      const addresses = await dns.resolve4("atriawell.com");
      resolvedIp = addresses[0];
    } catch (err) {
      resolveError = (err as Error).message;
    }

    const checks = await Promise.all([
      testPort("atriawell.com", 465),
      testPort("atriawell.com", 587),
      ...(resolvedIp ? [testPort(resolvedIp, 465)] : []),
      testPort("google.com", 443),
      testPort("smtp.gmail.com", 465),
    ]);

    return { resolvedIp, resolveError, checks };
  }
}
