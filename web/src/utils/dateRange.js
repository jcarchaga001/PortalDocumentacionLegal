export const EMPTY_DATE_RANGE = Object.freeze(["", ""]);

export function normalizeDateRange(value) {
  const startDate = typeof value?.[0] === "string" ? value[0] : "";
  const endDate = typeof value?.[1] === "string" ? value[1] : "";

  if (startDate && endDate && startDate > endDate) return [endDate, startDate];
  return [startDate, endDate];
}

export function localIsoDate(offsetDays = 0, now = new Date()) {
  const date = new Date(now.getTime());
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localMonthStartIso(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}
