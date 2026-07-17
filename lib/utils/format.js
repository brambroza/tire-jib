export function formatTHB(amount) {
  const number = Number(amount || 0);
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(number);
}
