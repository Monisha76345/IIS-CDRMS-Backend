/** Indian mobile: exactly 10 digits, starting with 6–9. */
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const INDIAN_MOBILE_MESSAGE =
  'Mobile/phone number must be exactly 10 digits and start with 6, 7, 8, or 9';

/** Keep digits only, max 10 (for form inputs). */
export function digitsOnlyMobile(value: unknown): string {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 10);
}

export function isValidIndianMobile(value: unknown): boolean {
  const digits = String(value ?? '').replace(/\D/g, '');
  return INDIAN_MOBILE_REGEX.test(digits);
}

/**
 * Validate optional phone. Empty/null is allowed.
 * Throws BadRequestException-compatible Error with message — callers wrap.
 */
export function assertOptionalIndianMobile(
  value: unknown,
  fieldLabel = 'Mobile/phone number',
): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!INDIAN_MOBILE_REGEX.test(digits)) {
    throw new Error(
      `${fieldLabel} must be exactly 10 digits and start with 6, 7, 8, or 9`,
    );
  }
  return digits;
}
