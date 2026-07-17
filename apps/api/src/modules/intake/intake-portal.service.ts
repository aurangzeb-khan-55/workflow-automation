import { Inject, Injectable } from "@nestjs/common";
import { Intake, IntakeSectionType, IntakeStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AI_SUMMARY_PROVIDER, AiSummaryProvider } from "../../providers/ai/ai-summary-provider.interface";
import { DocumentsService } from "../documents/documents.service";
import { ConsentsService } from "../consents/consents.service";
import { assertTransition, canTransition } from "./intake-status.state-machine";
import { SUBMITTABLE_SECTION_TYPES, validateSectionData } from "./section-validation";
import { buildIntakeSummaryInput } from "./intake-summary-input.builder";
import { documentTypeLabel, consentTypeLabel } from "./document-consent-labels";

export interface MissingItem {
  category: "section" | "document" | "consent";
  type: string;
  message: string;
}

/**
 * Patient-facing intake actions. Every method here receives an already
 * token-resolved `Intake` row from IntakeTokenGuard (via @CurrentIntake()) —
 * there is no re-resolution by token in this file, and no query anywhere
 * below ever accepts a client-supplied id for the intake itself. This uses
 * the raw PrismaService directly (not TenantPrismaService), which is safe
 * specifically because every query is additionally scoped to that one
 * already-resolved intake's id — see IntakeTokenGuard's doc-comment for the
 * full authorization story.
 */
@Injectable()
export class IntakePortalService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_SUMMARY_PROVIDER) private readonly aiSummaryProvider: AiSummaryProvider,
    private readonly documentsService: DocumentsService,
    private readonly consentsService: ConsentsService,
  ) {}

  async findByToken(intake: Intake) {
    const [patient, appointment, sections, documents, consents] = await Promise.all([
      this.prisma.patient.findUnique({ where: { id: intake.patientId } }),
      intake.appointmentId
        ? this.prisma.appointment.findUnique({ where: { id: intake.appointmentId } })
        : Promise.resolve(null),
      this.prisma.intakeSection.findMany({ where: { intakeId: intake.id } }),
      this.documentsService.listForIntake(intake.id),
      this.consentsService.listForIntake(intake.id),
    ]);

    return {
      id: intake.id,
      status: intake.status,
      tokenExpiresAt: intake.tokenExpiresAt,
      requiredDocumentTypes: intake.requiredDocumentTypes,
      requiredConsentTypes: intake.requiredConsentTypes,
      patient: patient && { firstName: patient.firstName, lastName: patient.lastName, dob: patient.dob },
      appointment: appointment && {
        reasonForVisit: appointment.reasonForVisit,
        scheduledAt: appointment.scheduledAt,
      },
      sections: sections.map((s) => ({ sectionType: s.sectionType, data: s.data, completedAt: s.completedAt })),
      documents,
      consents,
    };
  }

  async upsertSection(intake: Intake, sectionType: IntakeSectionType, data: Record<string, unknown>) {
    const section = await this.prisma.intakeSection.upsert({
      where: { intakeId_sectionType: { intakeId: intake.id, sectionType } },
      create: { intakeId: intake.id, sectionType, data: data as Prisma.InputJsonValue },
      update: { data: data as Prisma.InputJsonValue },
    });

    await this.advanceOnSectionSave(intake);

    return section;
  }

  /**
   * Validates required sections, documents, and consents. If anything is
   * missing, the intake visibly moves to `missing_documents` ("Missing
   * Information" to staff — see the dashboard's statusLabel()) and the
   * response tells the patient exactly what's left, rather than a generic
   * rejection. If everything is present, proceeds to intake_submitted ->
   * ready_for_staff_review as before.
   */
  async submit(intake: Intake) {
    const sections = await this.prisma.intakeSection.findMany({ where: { intakeId: intake.id } });
    const sectionData = new Map(sections.map((s) => [s.sectionType, s.data]));

    const missing: MissingItem[] = [];

    for (const sectionType of SUBMITTABLE_SECTION_TYPES) {
      const problems = validateSectionData(sectionType, sectionData.get(sectionType));
      missing.push(...problems.map((message) => ({ category: "section" as const, type: sectionType, message })));
    }

    const presentDocTypes = await this.documentsService.requiredTypesPresence(intake);
    for (const type of intake.requiredDocumentTypes) {
      if (!presentDocTypes.has(type)) {
        missing.push({ category: "document", type, message: `Please upload your ${documentTypeLabel(type)}` });
      }
    }

    const presentConsentTypes = await this.consentsService.requiredTypesPresence(intake);
    for (const type of intake.requiredConsentTypes) {
      if (!presentConsentTypes.has(type)) {
        missing.push({ category: "consent", type, message: `Please review and sign the ${consentTypeLabel(type)}` });
      }
    }

    if (missing.length > 0) {
      let resultStatus = intake.status;
      if (intake.status !== IntakeStatus.missing_documents && canTransition(intake.status, IntakeStatus.missing_documents)) {
        await this.prisma.intake.update({ where: { id: intake.id }, data: { status: IntakeStatus.missing_documents } });
        resultStatus = IntakeStatus.missing_documents;
      }
      return { id: intake.id, status: resultStatus, missing };
    }

    assertTransition(intake.status, IntakeStatus.intake_submitted);
    await this.prisma.intake.update({
      where: { id: intake.id },
      data: { status: IntakeStatus.intake_submitted, submittedAt: new Date() },
    });

    // AUTOMATIC: generate the summary and advance to staff review in the
    // same request. V1 keeps this synchronous since the db_generated
    // provider is cheap; if a real AI call becomes slow, this can move to
    // a BullMQ job (QueueModule already exists) without changing the
    // state machine — intake_submitted -> ready_for_staff_review would
    // just be triggered by the job instead of inline here.
    const appointment = intake.appointmentId
      ? await this.prisma.appointment.findUnique({ where: { id: intake.appointmentId } })
      : null;
    const documents = await this.prisma.document.findMany({ where: { intakeId: intake.id, deletedAt: null } });
    const summaryInput = buildIntakeSummaryInput(appointment, sections, documents);
    const summary = await this.aiSummaryProvider.generateSummary(summaryInput);

    await this.prisma.intakeSummary.create({
      data: {
        intakeId: intake.id,
        summaryText: summary.summaryText,
        missingItems: summaryInput.missingItems as Prisma.InputJsonValue,
        source: summary.source,
      },
    });

    assertTransition(IntakeStatus.intake_submitted, IntakeStatus.ready_for_staff_review);
    const updated = await this.prisma.intake.update({
      where: { id: intake.id },
      data: { status: IntakeStatus.ready_for_staff_review },
    });

    // In-app staff alert — distinct from the patient-facing email
    // Notification model above. Clinic-wide (no per-user target), same raw
    // PrismaService as the rest of this file: there's no staff/clinicId
    // auth context in the patient-portal request, so clinicId comes
    // directly from the already-resolved intake row, not TenantPrismaService.
    const patient = await this.prisma.patient.findUnique({ where: { id: intake.patientId } });
    if (patient) {
      await this.prisma.staffNotification.create({
        data: {
          clinicId: intake.clinicId,
          intakeId: intake.id,
          message: `${patient.firstName} ${patient.lastName} has submitted their intake form`,
        },
      });
    }

    return { id: updated.id, status: updated.status, missing: [] as MissingItem[] };
  }

  /**
   * AUTOMATIC — the only two forward transitions triggered purely by the
   * patient interacting with the form, not an explicit submit. Later
   * statuses (missing_documents, intake_submitted, ...) are never touched
   * here; those are driven by submit() or staff actions.
   */
  private async advanceOnSectionSave(intake: Intake) {
    let next: IntakeStatus | undefined;
    if (intake.status === IntakeStatus.intake_email_sent) {
      next = IntakeStatus.patient_started_intake;
    } else if (intake.status === IntakeStatus.patient_started_intake) {
      next = IntakeStatus.waiting_for_patient;
    }

    if (next) {
      assertTransition(intake.status, next);
      await this.prisma.intake.update({ where: { id: intake.id }, data: { status: next } });
    }
  }
}
