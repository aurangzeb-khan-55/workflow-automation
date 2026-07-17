import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { CLINICAL_STAFF_ROLES } from "../auth/roles.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AppointmentsService } from "./appointments.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";
import { ListAppointmentsQueryDto } from "./dto/list-appointments-query.dto";

@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Roles(...CLINICAL_STAFF_ROLES)
  @Post()
  create(@Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListAppointmentsQueryDto) {
    return this.appointmentsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.appointmentsService.findById(id);
  }

  @Roles(...CLINICAL_STAFF_ROLES)
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentsService.update(id, dto);
  }

  @Roles(...CLINICAL_STAFF_ROLES)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string) {
    await this.appointmentsService.remove(id);
  }
}
