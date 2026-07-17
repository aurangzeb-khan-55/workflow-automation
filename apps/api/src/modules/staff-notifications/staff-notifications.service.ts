import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";

const RECENT_LIMIT = 50;

/**
 * In-app staff alerts — distinct from EmailQueueService/Notification, which
 * handles outbound email to patients. These are clinic-wide (not per-user):
 * `readAt` is a single shared timestamp, so any staff member reading a
 * notification marks it read for the whole clinic. Tenant-scoped via
 * TenantPrismaService like every other module.
 */
@Injectable()
export class StaffNotificationsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findAll() {
    const [notifications, unreadCount] = await Promise.all([
      this.tenantPrisma.scoped.staffNotification.findMany({
        orderBy: { createdAt: "desc" },
        take: RECENT_LIMIT,
      }),
      this.tenantPrisma.scoped.staffNotification.count({ where: { readAt: null } }),
    ]);

    return { notifications, unreadCount };
  }

  async markRead(id: string) {
    const notification = await this.tenantPrisma.scoped.staffNotification.findUnique({ where: { id } });
    if (!notification) {
      throw new NotFoundException("Notification not found");
    }
    if (notification.readAt) {
      return notification;
    }
    return this.tenantPrisma.scoped.staffNotification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead() {
    await this.tenantPrisma.scoped.staffNotification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }
}
