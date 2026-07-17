import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { ListPatientsQueryDto } from "./dto/list-patients-query.dto";

/**
 * Uses TenantPrismaService exclusively, never the raw PrismaService — see
 * project standing rule: every query here is automatically scoped to the
 * caller's clinic, so a cross-tenant id simply 404s.
 */
@Injectable()
export class PatientsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(dto: CreatePatientDto) {
    return this.tenantPrisma.scoped.patient.create({
      data: {
        clinicId: this.tenantPrisma.clinicId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dob: dto.dob,
        phone: dto.phone,
        email: dto.email,
        newOrExisting: dto.newOrExisting,
        preferredPharmacy: dto.preferredPharmacy,
        gender: dto.gender,
        address: dto.address as unknown as Prisma.InputJsonValue,
        emergencyContact: dto.emergencyContact as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findAll(query: ListPatientsQueryDto) {
    return this.tenantPrisma.scoped.patient.findMany({
      where: {
        deletedAt: null,
        ...(query.search && {
          OR: [
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  }

  async findById(id: string) {
    const patient = await this.tenantPrisma.scoped.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) {
      throw new NotFoundException("Patient not found");
    }
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto) {
    await this.findById(id);
    return this.tenantPrisma.scoped.patient.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.dob !== undefined && { dob: dto.dob }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.newOrExisting !== undefined && { newOrExisting: dto.newOrExisting }),
        ...(dto.preferredPharmacy !== undefined && { preferredPharmacy: dto.preferredPharmacy }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.address !== undefined && { address: dto.address as unknown as Prisma.InputJsonValue }),
        ...(dto.emergencyContact !== undefined && {
          emergencyContact: dto.emergencyContact as unknown as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async softDelete(id: string) {
    await this.findById(id);
    await this.tenantPrisma.scoped.patient.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
