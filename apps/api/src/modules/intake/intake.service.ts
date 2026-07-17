import { randomBytes } from "crypto";
import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ConsentType,
  IntakeSection,
  IntakeSectionType,
  IntakeStatus,
  NotificationChannel,
  NotificationRecipientType,
  NotificationStatus,
  Prisma,
} from "@prisma/client";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service";
import { STORAGE_PROVIDER, StorageProvider } from "../../providers/storage/storage-provider.interface";
import { AppointmentsService } from "../appointments/appointments.service";
import { EmailQueueService } from "../notifications/email-queue.service";
import { assertTransition } from "./intake-status.state-machine";
import { CreateIntakeAction, CreateIntakeDto } from "./dto/create-intake.dto";
import { UpdateIntakeDto } from "./dto/update-intake.dto";
import { ListIntakesQueryDto } from "./dto/list-intakes-query.dto";
import { buildIntakePackage } from "./package/intake-package.builder";

const INTAKE_TOKEN_TTL_DAYS = 14;

/** Always required unless staff opts an intake out entirely (there's no "no consents" case in this pass). */
const BASE_CONSENT_TYPES: ConsentType[] = [
  ConsentType.consent_to_treat,
  ConsentType.hipaa_privacy_acknowledgement,
  ConsentType.financial_responsibility,
];

function resolveRequiredConsentTypes(isTelehealth?: boolean): ConsentType[] {
  return isTelehealth ? [...BASE_CONSENT_TYPES, ConsentType.telehealth_consent] : BASE_CONSENT_TYPES;
}

function sectionDataOf(sections: IntakeSection[], type: IntakeSectionType): Record<string, unknown> | undefined {
  return sections.find((s) => s.sectionType === type)?.data as Record<string, unknown> | undefined;
}

/**
 * Staff-facing intake actions — tenant-scoped via TenantPrismaService like
 * every other module. The patient-facing token flow lives in
 * IntakePortalService instead, which has no clinicId/staff context at all
 * and is scoped by the secure token itself (see that file for why that's
 * still safe).
 */
@Injectable()
export class IntakeService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly appointmentsService: AppointmentsService,
    private readonly emailQueueService: EmailQueueService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /**
   * Create Intake, step 2 of the review workflow: the form data has
   * already been confirmed in the review modal by this point. Always
   * creates the intake in `draft` status first; `create_and_send` then
   * immediately calls the same sendEmail() a later "send whenever ready"
   * action would use, rather than duplicating that logic.
   */
  async create(dto: CreateIntakeDto, userId: string) {
    const patient = await this.findOrCreatePatient(dto);

    const appointment = await this.appointmentsService.create({
      patientId: patient.id,
      providerId: dto.providerId,
      reasonForVisit: dto.reasonForVisit,
      scheduledAt: dto.scheduledAt,
      notes: dto.notes,
    });

    const intake = await this.tenantPrisma.scoped.intake.create({
      data: {
        clinicId: this.tenantPrisma.clinicId,
        patientId: patient.id,
        appointmentId: appointment.id,
        requiredDocumentTypes: dto.requiredDocumentTypes ?? [],
        requiredConsentTypes: resolveRequiredConsentTypes(dto.isTelehealth),
        // status defaults to `draft` per schema
      },
    });

    if (dto.action === CreateIntakeAction.create_and_send) {
      return this.sendEmail(intake.id, userId);
    }
    return intake;
  }

  /**
   * Matches an existing patient by email + DOB within the clinic (email
   * alone isn't unique on Patient, unlike User) rather than always
   * creating a new row — avoids duplicate patient records when the same
   * person gets a new intake for a later visit.
   */
  private async findOrCreatePatient(dto: CreateIntakeDto) {
    const existing = await this.tenantPrisma.scoped.patient.findFirst({
      where: { email: { equals: dto.email, mode: "insensitive" }, dob: dto.dob },
    });
    if (existing) return existing;

    return this.tenantPrisma.scoped.patient.create({
      data: {
        clinicId: this.tenantPrisma.clinicId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dob: dto.dob,
        email: dto.email,
        phone: dto.phone,
        newOrExisting: dto.newOrExisting,
      },
    });
  }

  /** Backs the staff dashboard: filter by provider, status, appointment date range, patient name. */
  async findAll(query: ListIntakesQueryDto) {
    const appointmentFilter: Record<string, unknown> = {};
    if (query.providerId) {
      appointmentFilter.providerId = query.providerId;
    }
    if (query.fromDate || query.toDate) {
      appointmentFilter.scheduledAt = {
        ...(query.fromDate && { gte: query.fromDate }),
        ...(query.toDate && { lte: query.toDate }),
      };
    }

    return this.tenantPrisma.scoped.intake.findMany({
      where: {
        ...(query.status && { status: query.status }),
        ...(Object.keys(appointmentFilter).length > 0 && { appointment: appointmentFilter }),
        ...(query.patientName && {
          patient: {
            OR: [
              { firstName: { contains: query.patientName, mode: "insensitive" } },
              { lastName: { contains: query.patientName, mode: "insensitive" } },
            ],
          },
        }),
      },
      include: { patient: true, appointment: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    const intake = await this.tenantPrisma.scoped.intake.findUnique({
      where: { id },
      include: { patient: true, appointment: true, sections: true, documents: true, consents: true },
    });
    if (!intake) {
      throw new NotFoundException("Intake not found");
    }
    return intake;
  }

  /**
   * Staff-side equivalent of the patient portal's view — same shape, but
   * reached by clinic-scoped id instead of the (possibly not-yet-issued,
   * for a draft) secure token. Lets staff preview the patient experience
   * before ever sending the email.
   */
  async preview(id: string) {
    const intake = await this.findById(id);
    return {
      id: intake.id,
      status: intake.status,
      patient: {
        firstName: intake.patient.firstName,
        lastName: intake.patient.lastName,
        dob: intake.patient.dob,
      },
      appointment: intake.appointment && {
        reasonForVisit: intake.appointment.reasonForVisit,
        scheduledAt: intake.appointment.scheduledAt,
        notes: intake.appointment.notes,
      },
      sections: intake.sections.map((s) => ({
        sectionType: s.sectionType,
        data: s.data,
        completedAt: s.completedAt,
      })),
      requiredDocumentTypes: intake.requiredDocumentTypes,
      requiredConsentTypes: intake.requiredConsentTypes,
      documents: intake.documents
        .filter((d) => !d.deletedAt)
        .map((d) => ({ id: d.id, type: d.type, fileName: d.fileName, uploadedAt: d.uploadedAt })),
      consents: intake.consents.map((c) => ({ type: c.type, signedAt: c.signedAt })),
    };
  }

  /**
   * Full read-only staff review of a submitted intake — everything the
   * patient entered, plus documents as signed download URLs (never raw S3
   * paths) and consents as type + signedAt only (never the raw signature
   * image here; that's what the generated consent PDF in the package is
   * for). Callable regardless of exact status past submission so staff can
   * still look back at a completed intake later, not just while it's
   * sitting in Ready for Staff Review.
   */
  async review(id: string) {
    const intake = await this.findById(id);
    const documents = await Promise.all(
      intake.documents
        .filter((d) => !d.deletedAt)
        .map(async (d) => ({
          id: d.id,
          type: d.type,
          fileName: d.fileName,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          uploadedAt: d.uploadedAt,
          downloadUrl: await this.storage.getSignedDownloadUrl(d.s3Key),
        })),
    );

    return {
      id: intake.id,
      status: intake.status,
      submittedAt: intake.submittedAt,
      uploadedToJaneAt: intake.uploadedToJaneAt,
      patient: {
        firstName: intake.patient.firstName,
        lastName: intake.patient.lastName,
        dob: intake.patient.dob,
        phone: intake.patient.phone,
        email: intake.patient.email,
      },
      appointment: intake.appointment && {
        reasonForVisit: intake.appointment.reasonForVisit,
        scheduledAt: intake.appointment.scheduledAt,
        notes: intake.appointment.notes,
      },
      personalInfo: sectionDataOf(intake.sections, IntakeSectionType.personal_info),
      medicalHistory: sectionDataOf(intake.sections, IntakeSectionType.medical_history),
      insuranceInfo: sectionDataOf(intake.sections, IntakeSectionType.insurance_info),
      documents,
      consents: intake.consents.map((c) => ({ type: c.type, signedAt: c.signedAt })),
    };
  }

  /**
   * Builds the downloadable document package (see intake-package.builder.ts
   * for the packaging design) and writes the audit log entry the original
   * spec calls "Package Downloaded" — logged here, at generation time,
   * rather than trusting the client to report a successful download.
   */
  async generatePackage(id: string, userId: string) {
    const intake = await this.findById(id);

    const documentBuffers = await Promise.all(
      intake.documents
        .filter((d) => !d.deletedAt)
        .map(async (d) => ({
          type: d.type,
          fileName: d.fileName,
          buffer: await this.storage.getObject(d.s3Key),
        })),
    );

    const result = await buildIntakePackage({
      patient: intake.patient,
      intakeDate: intake.submittedAt ?? intake.createdAt,
      sections: intake.sections,
      documents: documentBuffers,
      consents: intake.consents.map((c) => ({
        type: c.type,
        signedAt: c.signedAt,
        signatureData: c.signatureData,
        ipAddress: c.ipAddress,
      })),
    });

    await this.tenantPrisma.scoped.auditLog.create({
      data: {
        clinicId: this.tenantPrisma.clinicId,
        userId,
        patientId: intake.patientId,
        entity: "Intake",
        entityId: intake.id,
        action: "package_downloaded",
        newValue: { filename: result.filename } as Prisma.InputJsonValue,
      },
    });

    return result;
  }

  /** Edit a draft's patient/appointment fields. Only permitted while status is `draft` — see class doc. */
  async update(id: string, dto: UpdateIntakeDto) {
    const intake = await this.findById(id);
    if (intake.status !== IntakeStatus.draft) {
      throw new ForbiddenException("Only draft intakes can be edited directly — this one has already been sent");
    }

    const patientData: Prisma.PatientUpdateInput = {};
    if (dto.firstName !== undefined) patientData.firstName = dto.firstName;
    if (dto.lastName !== undefined) patientData.lastName = dto.lastName;
    if (dto.dob !== undefined) patientData.dob = dto.dob;
    if (dto.email !== undefined) patientData.email = dto.email;
    if (dto.phone !== undefined) patientData.phone = dto.phone;
    if (dto.newOrExisting !== undefined) patientData.newOrExisting = dto.newOrExisting;
    if (Object.keys(patientData).length > 0) {
      await this.tenantPrisma.scoped.patient.update({ where: { id: intake.patientId }, data: patientData });
    }

    if (intake.appointmentId && (dto.reasonForVisit || dto.providerId || dto.scheduledAt || dto.notes !== undefined)) {
      await this.appointmentsService.update(intake.appointmentId, {
        reasonForVisit: dto.reasonForVisit,
        providerId: dto.providerId,
        scheduledAt: dto.scheduledAt,
        notes: dto.notes,
      });
    }

    const intakeData: Prisma.IntakeUpdateInput = {};
    if (dto.requiredDocumentTypes !== undefined) intakeData.requiredDocumentTypes = dto.requiredDocumentTypes;
    if (dto.isTelehealth !== undefined) intakeData.requiredConsentTypes = resolveRequiredConsentTypes(dto.isTelehealth);
    if (Object.keys(intakeData).length > 0) {
      await this.tenantPrisma.scoped.intake.update({ where: { id }, data: intakeData });
    }

    return this.findById(id);
  }

  /**
   * "Create Intake & Send Email" (from a fresh draft), "send whenever
   * ready" (from an existing draft), and resending after a prior
   * email_failed all land here: generate the secure token, transition to
   * intake_email_sent, write an audit log, and queue the actual send on
   * the `email` BullMQ queue — reaching intake_email_sent here means the
   * send was queued, not that it's confirmed delivered (EmailProcessor
   * moves the status to email_failed if delivery ultimately fails after
   * retries are exhausted).
   */
  async sendEmail(id: string, userId: string) {
    const intake = await this.tenantPrisma.scoped.intake.findUnique({ where: { id } });
    if (!intake) {
      throw new NotFoundException("Intake not found");
    }
    assertTransition(intake.status, IntakeStatus.intake_email_sent);

    const updated = await this.tenantPrisma.scoped.intake.update({
      where: { id },
      data: {
        status: IntakeStatus.intake_email_sent,
        secureToken: randomBytes(32).toString("hex"),
        tokenExpiresAt: new Date(Date.now() + INTAKE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    await this.tenantPrisma.scoped.auditLog.create({
      data: {
        clinicId: this.tenantPrisma.clinicId,
        userId,
        patientId: intake.patientId,
        entity: "Intake",
        entityId: intake.id,
        action: "intake_email_sent",
        previousValue: { status: intake.status } as Prisma.InputJsonValue,
        newValue: { status: updated.status } as Prisma.InputJsonValue,
      },
    });

    const notification = await this.tenantPrisma.scoped.notification.create({
      data: {
        clinicId: this.tenantPrisma.clinicId,
        intakeId: intake.id,
        recipientType: NotificationRecipientType.patient,
        channel: NotificationChannel.email,
        provider: this.config.get<string>("email.provider") ?? "stub",
        status: NotificationStatus.queued,
        reason: "intake_invitation",
      },
    });
    await this.emailQueueService.enqueueIntakeInvitation(notification.id);

    return updated;
  }

  /** STAFF seam — will be called by the future Documents/Consents module once it can detect this itself. */
  async markMissingDocuments(id: string) {
    return this.transition(id, IntakeStatus.missing_documents);
  }

  async markDocumentsResolved(id: string) {
    return this.transition(id, IntakeStatus.waiting_for_patient);
  }

  /** STAFF, Step 10: the manual confirmation that the package was uploaded to Jane App outside this system. */
  async markUploadedToJane(id: string, userId: string) {
    return this.transition(id, IntakeStatus.uploaded_to_jane, {
      extraData: { uploadedToJaneAt: new Date() },
      userId,
      auditAction: "uploaded_to_jane",
    });
  }

  /** STAFF: closes the intake out once staff consider the episode fully done (e.g. Jane's own ingestion confirmed). */
  async markCompleted(id: string, userId: string) {
    return this.transition(id, IntakeStatus.completed, { userId, auditAction: "marked_completed" });
  }

  /** Deleting is intentionally narrow: only ever a draft, never a real in-flight intake. The linked Patient/Appointment are left alone. */
  async remove(id: string) {
    const intake = await this.tenantPrisma.scoped.intake.findUnique({ where: { id } });
    if (!intake) {
      throw new NotFoundException("Intake not found");
    }
    if (intake.status !== IntakeStatus.draft) {
      throw new ForbiddenException("Only draft intakes can be deleted");
    }
    await this.tenantPrisma.scoped.intake.delete({ where: { id } });
  }

  private async transition(
    id: string,
    to: IntakeStatus,
    opts?: { extraData?: Record<string, unknown>; userId?: string; auditAction?: string },
  ) {
    const intake = await this.tenantPrisma.scoped.intake.findUnique({ where: { id } });
    if (!intake) {
      throw new NotFoundException("Intake not found");
    }
    assertTransition(intake.status, to);
    const updated = await this.tenantPrisma.scoped.intake.update({
      where: { id },
      data: { status: to, ...opts?.extraData },
    });

    if (opts?.auditAction && opts?.userId) {
      await this.tenantPrisma.scoped.auditLog.create({
        data: {
          clinicId: this.tenantPrisma.clinicId,
          userId: opts.userId,
          patientId: intake.patientId,
          entity: "Intake",
          entityId: intake.id,
          action: opts.auditAction,
          previousValue: { status: intake.status } as Prisma.InputJsonValue,
          newValue: { status: updated.status } as Prisma.InputJsonValue,
        },
      });
    }

    return updated;
  }
}
