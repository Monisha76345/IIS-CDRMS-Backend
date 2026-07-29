/** Normalize Role.code / Role.name / userType for comparison. */
export function normalizeAccessKey(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
