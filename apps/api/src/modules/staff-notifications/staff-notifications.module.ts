import { Module } from "@nestjs/common";
import { StaffNotificationsController } from "./staff-notifications.controller";
import { StaffNotificationsService } from "./staff-notifications.service";

@Module({
  controllers: [StaffNotificationsController],
  providers: [StaffNotificationsService],
})
export class StaffNotificationsModule {}
