import { IsEnum } from 'class-validator';
import { UserTheme } from '../../users/enums/user-theme.enum';

export class UpdateThemeDto {
  @IsEnum(UserTheme)
  themePreference: UserTheme;
}
