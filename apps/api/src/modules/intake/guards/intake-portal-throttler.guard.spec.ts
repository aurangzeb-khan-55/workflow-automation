import { ExecutionContext, HttpException } from "@nestjs/common";
import { ThrottlerStorage } from "@nestjs/throttler";
import { IntakePortalThrottlerGuard } from "./intake-portal-throttler.guard";

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe("IntakePortalThrottlerGuard", () => {
  it("allows requests under both the IP and token limits", async () => {
    const storage: ThrottlerStorage = {
      increment: jest.fn().mockResolvedValue({ totalHits: 1, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }),
    };
    const guard = new IntakePortalThrottlerGuard(storage);
    const request = { params: { token: "abc" }, ip: "1.2.3.4" };
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
  });

  it("blocks once the IP-keyed bucket reports isBlocked, before even checking the token bucket", async () => {
    const increment = jest.fn().mockResolvedValueOnce({ totalHits: 999, timeToExpire: 60, isBlocked: true, timeToBlockExpire: 60 });
    const storage: ThrottlerStorage = { increment };
    const guard = new IntakePortalThrottlerGuard(storage);
    const request = { params: { token: "abc" }, ip: "1.2.3.4" };

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(HttpException);
    expect(increment).toHaveBeenCalledTimes(1);
    expect(increment.mock.calls[0][0]).toContain("intake-portal-ip:1.2.3.4");
  });

  it("blocks once the token-keyed bucket reports isBlocked, even with a fresh IP", async () => {
    const increment = jest
      .fn()
      .mockResolvedValueOnce({ totalHits: 1, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 })
      .mockResolvedValueOnce({ totalHits: 999, timeToExpire: 60, isBlocked: true, timeToBlockExpire: 60 });
    const storage: ThrottlerStorage = { increment };
    const guard = new IntakePortalThrottlerGuard(storage);
    const request = { params: { token: "hammered-token" }, ip: "5.6.7.8" };

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(HttpException);
    expect(increment.mock.calls[1][0]).toContain("intake-portal-token:hammered-token");
  });
});
