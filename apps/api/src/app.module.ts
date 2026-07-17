import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { EmailModule } from "./providers/email/email.module";
import { StorageModule } from "./providers/storage/storage.module";
import { AiModule } from "./providers/ai/ai.module";
import { OcrModule } from "./providers/ocr/ocr.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ClinicsModule } from "./modules/clinics/clinics.module";
import { PatientsModule } from "./modules/patients/patients.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { IntakeModule } from "./modules/intake/intake.module";
import { UsersModule } from "./modules/users/users.module";
import { StaffNotificationsModule } from "./modules/staff-notifications/staff-notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    QueueModule,
    EmailModule,
    StorageModule,
    AiModule,
    OcrModule,
    HealthModule,
    AuthModule,
    ClinicsModule,
    PatientsModule,
    AppointmentsModule,
    IntakeModule,
    UsersModule,
    StaffNotificationsModule,
    // Remaining feature modules (AuditLogs, Dashboard, Settings) are added
    // phase-by-phase per the project's build plan — see README.
  ],
})
export class AppModule {}
