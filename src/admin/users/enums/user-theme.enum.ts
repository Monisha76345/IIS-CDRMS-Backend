/** CDRMS mobile themes — Ocean Blue only. */
export enum UserTheme {
  OCEAN = 'ocean',
}

/** Legacy theme ids that used to exist in the app / DB. */
export const LEGACY_USER_THEMES = [
  'blue',
  'navy',
  'azure',
  'sky',
  'indigo',
  'wave',
  'mesh',
  'teal',
  'violet',
  'curve',
] as const;

/** Coerce any stored / client theme value to Ocean Blue. */
export function normalizeUserTheme(_raw?: string | null): UserTheme {
  return UserTheme.OCEAN;
}
