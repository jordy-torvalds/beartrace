function toUtcDays(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function diffDays(fromIsoDate: string, toIsoDate: string): number {
  return toUtcDays(toIsoDate) - toUtcDays(fromIsoDate);
}

export function addDays(isoDate: string, days: number): string {
  const totalMs = (toUtcDays(isoDate) + days) * 86_400_000;
  const date = new Date(totalMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
