import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { UpdateClinicDto } from "./dto/update-clinic.dto";

/**
 * Uses the raw PrismaService throughout, not TenantPrismaService. Clinic
 * is the tenant root, not a tenant-scoped child (it has no clinicId column
 * — its own `id` *is* the tenant boundary), so the auto-scoping extension
 * has nothing to key off here. "Own clinic" access is instead guarded
 * explicitly: findOwn/updateOwn only ever take a clinicId sourced from
 * request.user (see ClinicsController), never a client-supplied id.
 */
@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClinicDto) {
    try {
      return await this.prisma.clinic.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          logoUrl: dto.logoUrl,
          brandingConfig: (dto.brandingConfig ?? {}) as Prisma.InputJsonValue,
          settings: (dto.settings ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A clinic with this slug already exists");
      }
      throw err;
    }
  }

  async findAll() {
    return this.prisma.clinic.findMany({ where: { deletedAt: null } });
  }

  async findById(id: string) {
    const clinic = await this.prisma.clinic.findFirst({ where: { id, deletedAt: null } });
    if (!clinic) {
      throw new NotFoundException("Clinic not found");
    }
    return clinic;
  }

  async update(id: string, dto: UpdateClinicDto) {
    await this.findById(id);
    return this.prisma.clinic.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.brandingConfig !== undefined && {
          brandingConfig: dto.brandingConfig as Prisma.InputJsonValue,
        }),
        ...(dto.settings !== undefined && { settings: dto.settings as Prisma.InputJsonValue }),
      },
    });
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.prisma.clinic.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findOwn(clinicId: string) {
    return this.findById(clinicId);
  }

  async updateOwn(clinicId: string, dto: UpdateClinicDto) {
    return this.update(clinicId, dto);
  }
}
