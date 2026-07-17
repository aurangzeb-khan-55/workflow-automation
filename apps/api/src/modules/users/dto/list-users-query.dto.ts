import { IsEnum, IsOptional } from "class-validator";
import { UserRole } from "@prisma/client";

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
