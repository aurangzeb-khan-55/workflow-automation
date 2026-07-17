import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";
import { ListAppointmentsQueryDto } from "./dto/list-appointments-query.dto";

/**
 * Appointment.provider is a to-one relation, which TenantPrismaService's
 * auto-scoping can't filter (Prisma's include/select API has no `where`
 * for to-one relations — see tenant-prisma.service.ts). So the guarantee
 * has to come from the write side instead: before ever setting patientId
 * or providerId, resolve the referenced row through TenantPrismaService.
 * A cross-tenant id 404s/400s right here, and can never be persisted.
 */
@Injectable()
export class AppointmentsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private async assertPatientInClinic(patientId: string) {
    const patient = await this.tenantPrisma.scoped.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      throw new BadRequestException("patientId does not reference a patient in this clinic");
    }
  }

  private async assertProviderInClinic(providerId: string) {
    const provider = await this.tenantPrisma.scoped.user.findUnique({ where: { id: providerId } });
    if (!provider) {
      throw new BadRequestException("providerId does not reference a user in this clinic");
    }
    if (provider.role !== UserRole.provider) {
      throw new BadRequestException("providerId must reference a user with the provider role");
    }
  }

  async create(dto: CreateAppointmentDto) {
    await this.assertPatientInClinic(dto.patientId);
    if (dto.providerId) {
      await this.assertProviderInClinic(dto.providerId);
    }

    return this.tenantPrisma.scoped.appointment.create({
      data: {
        clinicId: this.tenantPrisma.clinicId,
        patientId: dto.patientId,
        providerId: dto.providerId,
        reasonForVisit: dto.reasonForVisit,
        scheduledAt: dto.scheduledAt,
        notes: dto.notes,
      },
    });
  }

  async findAll(query: ListAppointmentsQueryDto) {
    return this.tenantPrisma.scoped.appointment.findMany({
      where: {
        ...(query.patientId && { patientId: query.patientId }),
        ...(query.providerId && { providerId: query.providerId }),
        ...((query.fromDate || query.toDate) && {
          scheduledAt: {
            ...(query.fromDate && { gte: query.fromDate }),
            ...(query.toDate && { lte: query.toDate }),
          },
        }),
      },
      orderBy: { scheduledAt: "asc" },
    });
  }

  async findById(id: string) {
    const appointment = await this.tenantPrisma.scoped.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundException("Appointment not found");
    }
    return appointment;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    await this.findById(id);
    if (dto.providerId) {
      await this.assertProviderInClinic(dto.providerId);
    }

    return this.tenantPrisma.scoped.appointment.update({
      where: { id },
      data: {
        ...(dto.providerId !== undefined && { providerId: dto.providerId }),
        ...(dto.reasonForVisit !== undefined && { reasonForVisit: dto.reasonForVisit }),
        ...(dto.scheduledAt !== undefined && { scheduledAt: dto.scheduledAt }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.tenantPrisma.scoped.appointment.delete({ where: { id } });
  }
}
