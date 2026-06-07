export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export const statusClass = (status: string) => status.toLowerCase().replace(/\s+/g, "-");
