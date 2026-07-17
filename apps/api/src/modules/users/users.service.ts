import { Injectable } from "@nestjs/common";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";

/** Uses TenantPrismaService exclusively, per the project's standing tenant-isolation rule. */
@Injectable()
export class UsersService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findAll(query: ListUsersQueryDto) {
    return this.tenantPrisma.scoped.user.findMany({
      where: {
        isActive: true,
        ...(query.role && { role: query.role }),
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: "asc" }],
    });
  }
}
