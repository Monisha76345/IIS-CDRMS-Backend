/** Parse JWT duration strings like `15m`, `7d`, `10800s` → milliseconds. */
export function jwtDurationToMs(
  raw: string | undefined | null,
  fallbackMs: number,
): number {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return fallbackMs;

  const match = /^(\d+)\s*([smhd])?$/.exec(value);
  if (!match) {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : fallbackMs;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallbackMs;
  const unit = match[2] || 's';
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (multipliers[unit] || 1000);
}
