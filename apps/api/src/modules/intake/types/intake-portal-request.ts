import { Request } from "express";
import { Intake } from "@prisma/client";

/** Populated exclusively by IntakeTokenGuard, from the row it resolved by secureToken. */
export interface IntakePortalRequest extends Request {
  intake?: Intake;
}
