const FALLBACK_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function partsToOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - instant.getTime();
}

/**
 * Converts a wall-clock date/time as entered in `timeZone` into the UTC instant it
 * represents, correctly accounting for that zone's DST rules on that date. Standard
 * two-pass Intl-offset technique: guess the offset, then refine once more since the
 * offset itself can depend on which side of a DST transition the guess lands on.
 * No date library needed -- `Intl` already carries the full IANA tz database.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = partsToOffsetMs(new Date(naiveUtc), timeZone);
  const refinedOffset = partsToOffsetMs(new Date(naiveUtc - firstOffset), timeZone);
  return new Date(naiveUtc - refinedOffset);
}

/** Extracts the wall-clock date/time that `instant` corresponds to in `timeZone`. */
export function getWallClockParts(
  instant: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Human-readable rendering of `instant` in `timeZone`, e.g. "2 Aug 2026, 17:00". */
export function formatInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Every IANA zone name the runtime knows about, for a timezone picker. Falls back to a short curated list on runtimes without `Intl.supportedValuesOf`. Always includes "UTC", which `Intl.supportedValuesOf` omits despite being a valid `Intl` timezone. */
export function listTimeZones(): string[] {
  let zones = FALLBACK_TIMEZONES;
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      zones = Intl.supportedValuesOf("timeZone");
    } catch {
      // fall through to the fallback list
    }
  }
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}
