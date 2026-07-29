import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/** Role updates are limited to privileges description only. */
export class UpdateRoleDto {
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;
}
