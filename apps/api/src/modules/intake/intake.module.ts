import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AiModule } from "../../providers/ai/ai.module";
import { StorageModule } from "../../providers/storage/storage.module";
import { AppointmentsModule } from "../appointments/appointments.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { DocumentsModule } from "../documents/documents.module";
import { ConsentsModule } from "../consents/consents.module";
import { IntakeController } from "./intake.controller";
import { IntakeService } from "./intake.service";
import { IntakePortalController } from "./intake-portal.controller";
import { IntakePortalService } from "./intake-portal.service";
import { IntakeTokenGuard } from "./guards/intake-token.guard";
import { IntakePortalThrottlerGuard } from "./guards/intake-portal-throttler.guard";

@Module({
  imports: [
    AiModule,
    StorageModule,
    AppointmentsModule,
    NotificationsModule,
    DocumentsModule,
    ConsentsModule,
    // Own instance, independent of any app-wide throttling config — see
    // IntakePortalThrottlerGuard, which drives it with hardcoded limits
    // rather than the named-throttler config this module normally reads.
    ThrottlerModule.forRoot([]),
  ],
  controllers: [IntakeController, IntakePortalController],
  providers: [IntakeService, IntakePortalService, IntakeTokenGuard, IntakePortalThrottlerGuard],
})
export class IntakeModule {}
