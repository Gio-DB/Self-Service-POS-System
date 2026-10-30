const restaurantTimeZone =
  import.meta.env.VITE_RESTAURANT_TIME_ZONE ?? "Europe/Berlin";

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
});

export function formatMoney(minorUnits: number) {
  return moneyFormatter.format(minorUnits / 100);
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: restaurantTimeZone,
  }).format(new Date(value));
}

export function formatOrderReference(orderNumber: number) {
  return String(orderNumber).padStart(5, "0");
}
