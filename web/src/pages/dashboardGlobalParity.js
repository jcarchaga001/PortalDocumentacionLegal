export const DASHBOARD_STATUS_FILTERS = Object.freeze({
  current: 2,
  expiring: 4,
  missing: 5,
});

export const DASHBOARD_SORT_DIRECTIONS = Object.freeze(["ascend", "descend", "ascend"]);

export const DASHBOARD_TABLE_WIDTHS = Object.freeze({
  empty: [118.828125, 132.265625, 122.15625, 127.359375, 149.484375, 182.203125, 185.296875, 178.8125, 90.453125],
  2: [137.5625, 132.265625, 164.203125, 127.359375, 149.484375, 182.203125, 185.296875, 178.8125, 106.09375],
  4: [137.5625, 132.265625, 122.15625, 127.359375, 149.484375, 182.203125, 185.296875, 178.8125, 100.765625],
  5: [137.5625, 132.265625, 164.203125, 127.359375, 149.484375, 182.203125, 185.296875, 178.8125, 107.484375],
});

export const DASHBOARD_EXPORT_FIELDS = Object.freeze([
  "vigente",
  "porVencer",
  "nombreSubcategoria",
  "nombreSucursal",
  "nombreEstado",
  "codigoSucursal",
  "codigoSubcategoria",
  "estado",
  "noExiste",
]);

function number(value) {
  return Number(value || 0);
}

export function dashboardProgress({ current, expiring, required }) {
  const requiredCount = number(required);
  const registered = number(current) + number(expiring);
  const percentage = requiredCount
    ? Math.max(0, Math.min(100, Math.floor((registered / requiredCount) * 100)))
    : 0;
  return {
    percentage,
    color: percentage === 100 ? "#37b24d" : "#c92a2a",
  };
}

export function dashboardExportTimestamp(date = new Date()) {
  const part = (value) => String(value).padStart(2, "0");
  const twelveHour = date.getHours() % 12 || 12;
  return `${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(twelveHour)}${part(date.getMinutes())}${part(date.getSeconds())}`;
}

export function dashboardExportFileName(date = new Date()) {
  return `DocumentacionObligarotioLegalHN_${dashboardExportTimestamp(date)}.xlsx`;
}

export function dashboardPaginationWindow(count, startIndex, maxRecords = 50) {
  const total = Math.max(0, Number(count) || 0);
  const offset = Math.max(0, Number(startIndex) || 0);
  const pageSize = Math.max(1, Number(maxRecords) || 50);
  return {
    pages: Math.ceil(total / pageSize),
    current: Math.floor(offset / pageSize) + 1,
    first: total ? offset + 1 : 0,
    last: Math.min(offset + pageSize, total),
  };
}
