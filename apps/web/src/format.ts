const currency = import.meta.env.VITE_CURRENCY ?? "GBP";

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency,
});

export function formatMoney(minorUnits: number) {
  return moneyFormatter.format(minorUnits / 100);
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
