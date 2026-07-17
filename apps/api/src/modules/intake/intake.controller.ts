import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { CLINICAL_STAFF_ROLES } from "../auth/roles.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-request";
import { IntakeService } from "./intake.service";
import { CreateIntakeDto } from "./dto/create-intake.dto";
import { UpdateIntakeDto } from "./dto/update-intake.dto";
import { ListIntakesQueryDto } from "./dto/list-intakes-query.dto";

@Controller("intakes")
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  /** The Create Intake action: body.action selects save_draft vs create_and_send. */
  @Roles(...CLINICAL_STAFF_ROLES)
  @Post()
  create(@Body() dto: CreateIntakeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.intakeService.create(dto, user.id);
  }

  // No @Roles() — the staff dashboard is readable by any authenticated role, including read_only.
  @Get()
  findAll(@Query() query: ListIntakesQueryDto) {
    return this.intakeService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.intakeService.findById(id);
  }

  /** Preview the patient-facing experience without a secure token — usable even before a draft has been sent. */
  @Get(":id/preview")
  preview(@Param("id") id: string) {
    return this.intakeService.preview(id);
  }

  /** Full read-only staff review of a submitted intake — the "eye icon" action once an intake reaches Ready for Staff Review (or later). */
  @Get(":id/review")
  review(@Param("id") id: string) {
    return this.intakeService.review(id);
  }

  /** Streams the generated document package zip — see IntakeService.generatePackage() for what's in it and why a zip. */
  @Roles(...CLINICAL_STAFF_ROLES)
  @Get(":id/package")
  async downloadPackage(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const { filename, buffer } = await this.intakeService.generatePackage(id, user.id);
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length,
    });
    res.send(buffer);
  }

  /** Edit a draft's patient/appointment fields. Only permitted while status is `draft`. */
  @Roles(...CLINICAL_STAFF_ROLES)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateIntakeDto) {
    return this.intakeService.update(id, dto);
  }

  /** "Create Intake & Send Email" and the Draft Workflow's "send whenever ready" both land here. */
  @Roles(...CLINICAL_STAFF_ROLES)
  @Patch(":id/send")
  sendEmail(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.intakeService.sendEmail(id, user.id);
  }

  @Roles(...CLINICAL_STAFF_ROLES)
  @Patch(":id/mark-missing-documents")
  markMissingDocuments(@Param("id") id: string) {
    return this.intakeService.markMissingDocuments(id);
  }

  @Roles(...CLINICAL_STAFF_ROLES)
  @Patch(":id/mark-documents-resolved")
  markDocumentsResolved(@Param("id") id: string) {
    return this.intakeService.markDocumentsResolved(id);
  }

  /** Step 10: staff confirming they've manually uploaded the downloaded package to Jane App. */
  @Roles(...CLINICAL_STAFF_ROLES)
  @Patch(":id/mark-uploaded-to-jane")
  markUploadedToJane(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.intakeService.markUploadedToJane(id, user.id);
  }

  @Roles(...CLINICAL_STAFF_ROLES)
  @Patch(":id/mark-completed")
  markCompleted(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.intakeService.markCompleted(id, user.id);
  }

  /** Delete is intentionally narrow — only ever a draft (see IntakeService.remove()). */
  @Roles(...CLINICAL_STAFF_ROLES)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string) {
    await this.intakeService.remove(id);
  }
}
