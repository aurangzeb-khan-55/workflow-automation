import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-request";
import { ClinicsService } from "./clinics.service";
import { CreateClinicDto } from "./dto/create-clinic.dto";
import { UpdateClinicDto } from "./dto/update-clinic.dto";

@Controller("clinics")
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  // "me" routes must be declared before the ":id" routes below, or Nest's
  // router will try to match "me" as an :id value instead of this handler.
  @Get("me")
  getOwn(@CurrentUser() user: AuthenticatedUser) {
    return this.clinicsService.findOwn(user.clinicId);
  }

  @Roles(UserRole.clinic_admin, UserRole.super_admin)
  @Patch("me")
  updateOwn(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateClinicDto) {
    return this.clinicsService.updateOwn(user.clinicId, dto);
  }

  @Roles(UserRole.super_admin)
  @Post()
  create(@Body() dto: CreateClinicDto) {
    return this.clinicsService.create(dto);
  }

  @Roles(UserRole.super_admin)
  @Get()
  findAll() {
    return this.clinicsService.findAll();
  }

  @Roles(UserRole.super_admin)
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.clinicsService.findById(id);
  }

  @Roles(UserRole.super_admin)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateClinicDto) {
    return this.clinicsService.update(id, dto);
  }

  @Roles(UserRole.super_admin)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string) {
    await this.clinicsService.softDelete(id);
  }
}
