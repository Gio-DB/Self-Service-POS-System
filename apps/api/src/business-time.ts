function formatterFor(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error(`RESTAURANT_TIME_ZONE is not a valid IANA timezone: ${timeZone}`);
  }
}

function partsAt(value: Date, timeZone: string) {
  const values = new Map(
    formatterFor(timeZone)
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second")),
  };
}

function offsetAt(value: Date, timeZone: string): number {
  const parts = partsAt(value, timeZone);
  const localAsUtc = utcCalendarDate(parts.year, parts.month, parts.day);
  localAsUtc.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  const wholeSecond = Math.floor(value.getTime() / 1_000) * 1_000;
  return localAsUtc.getTime() - wholeSecond;
}

export function restaurantBusinessDate(value: Date, timeZone: string): string {
  const parts = partsAt(value, timeZone);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function utcCalendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function startOfBusinessDate(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const midnightAsUtc = utcCalendarDate(year, month, day);
  let candidate = new Date(
    midnightAsUtc.getTime() - offsetAt(midnightAsUtc, timeZone),
  );
  candidate = new Date(
    midnightAsUtc.getTime() - offsetAt(candidate, timeZone),
  );
  return candidate;
}

export function startOfRestaurantBusinessDate(
  value: Date,
  timeZone: string,
): Date {
  return startOfBusinessDate(
    value.getUTCFullYear(),
    value.getUTCMonth() + 1,
    value.getUTCDate(),
    timeZone,
  );
}

export function startOfRestaurantBusinessDay(
  value: Date,
  timeZone: string,
): Date {
  const parts = partsAt(value, timeZone);
  return startOfBusinessDate(parts.year, parts.month, parts.day, timeZone);
}

export function restaurantTimeZone(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const timeZone = environment.RESTAURANT_TIME_ZONE?.trim() || "Europe/Berlin";
  formatterFor(timeZone);
  return timeZone;
}
