import { Controller, Get, Param, Patch } from "@nestjs/common";
import { StaffNotificationsService } from "./staff-notifications.service";

// No @Roles() on any route here — every authenticated staff role, including
// read_only, should see and be able to dismiss in-app alerts.
@Controller("staff-notifications")
export class StaffNotificationsController {
  constructor(private readonly staffNotificationsService: StaffNotificationsService) {}

  @Get()
  findAll() {
    return this.staffNotificationsService.findAll();
  }

  @Patch("read-all")
  markAllRead() {
    return this.staffNotificationsService.markAllRead();
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string) {
    return this.staffNotificationsService.markRead(id);
  }
}
