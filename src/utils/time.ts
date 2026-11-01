// src/utils/time.ts
export function todayKarachi(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Monday-to-Sunday week boundary calculation using calendar math
export function weekOf(isoDate: string): { start: string; end: string } {
  const dow = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const start = addDays(isoDate, -((dow + 6) % 7));
  return { start, end: addDays(start, 6) };
}