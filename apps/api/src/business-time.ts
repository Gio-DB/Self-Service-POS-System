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
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ) - value.getTime();
}

export function restaurantBusinessDate(value: Date, timeZone: string): string {
  const parts = partsAt(value, timeZone);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

export function startOfRestaurantBusinessDay(
  value: Date,
  timeZone: string,
): Date {
  const parts = partsAt(value, timeZone);
  const midnightAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  let candidate = new Date(midnightAsUtc - offsetAt(new Date(midnightAsUtc), timeZone));
  candidate = new Date(midnightAsUtc - offsetAt(candidate, timeZone));
  return candidate;
}

export function restaurantTimeZone(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const timeZone = environment.RESTAURANT_TIME_ZONE?.trim() || "Europe/Berlin";
  formatterFor(timeZone);
  return timeZone;
}
