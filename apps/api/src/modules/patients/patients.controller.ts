import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { CLINICAL_STAFF_ROLES } from "../auth/roles.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { PatientsService } from "./patients.service";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { ListPatientsQueryDto } from "./dto/list-patients-query.dto";

@Controller("patients")
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Roles(...CLINICAL_STAFF_ROLES)
  @Post()
  create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  // No @Roles() — any authenticated staff member (including read_only) may list/view patients.
  @Get()
  findAll(@Query() query: ListPatientsQueryDto) {
    return this.patientsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.patientsService.findById(id);
  }

  @Roles(...CLINICAL_STAFF_ROLES)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @Roles(...CLINICAL_STAFF_ROLES)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string) {
    await this.patientsService.softDelete(id);
  }
}
