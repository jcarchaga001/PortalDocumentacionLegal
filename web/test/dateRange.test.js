import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_DATE_RANGE,
  localIsoDate,
  localMonthStartIso,
  normalizeDateRange,
} from "../src/utils/dateRange.js";

test("normaliza rangos vacíos, completos e invertidos", () => {
  assert.deepEqual(normalizeDateRange(), EMPTY_DATE_RANGE);
  assert.deepEqual(normalizeDateRange(["2026-08-01", "2026-08-07"]), ["2026-08-01", "2026-08-07"]);
  assert.deepEqual(normalizeDateRange(["2026-08-07", "2026-08-01"]), ["2026-08-01", "2026-08-07"]);
});

test("calcula fechas locales sin conversiones UTC", () => {
  const localDate = new Date(2026, 7, 7, 23, 30, 0);
  assert.equal(localIsoDate(0, localDate), "2026-08-07");
  assert.equal(localIsoDate(1, localDate), "2026-08-08");
  assert.equal(localMonthStartIso(localDate), "2026-08-01");
});
