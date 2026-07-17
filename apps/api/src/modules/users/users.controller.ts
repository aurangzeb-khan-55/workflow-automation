import { Controller, Get, Query } from "@nestjs/common";
import { UsersService } from "./users.service";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // No @Roles() — any authenticated staff member can list their clinic's
  // own staff (e.g. to populate a provider filter dropdown).
  @Get()
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }
}
