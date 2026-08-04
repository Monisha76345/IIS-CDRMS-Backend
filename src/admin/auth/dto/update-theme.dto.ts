import { IsIn, IsString } from 'class-validator';
import { UserTheme, LEGACY_USER_THEMES } from '../../users/enums/user-theme.enum';

/** Accept Ocean Blue or any legacy id (normalized to ocean in the service). */
const ACCEPTED_THEMES = [UserTheme.OCEAN, ...LEGACY_USER_THEMES] as const;

export class UpdateThemeDto {
  @IsString()
  @IsIn(ACCEPTED_THEMES as unknown as string[])
  themePreference: string;
}
