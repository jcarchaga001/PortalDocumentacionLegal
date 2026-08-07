import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import "../styles/legacy-date-range-picker.css";
import { EMPTY_DATE_RANGE, normalizeDateRange } from "../utils/dateRange.js";

function selectedDatesToRange(selectedDates, instance) {
  return [
    selectedDates[0] ? instance.formatDate(selectedDates[0], "Y-m-d") : "",
    selectedDates[1] ? instance.formatDate(selectedDates[1], "Y-m-d") : "",
  ];
}

function rangesAreEqual(left, right) {
  return left[0] === right[0] && left[1] === right[1];
}

/**
 * Replica el DatePickerRange de OutSystemsUI sobre Flatpickr.
 *
 * `value` y `onChange` usan siempre la tupla [fechaInicial, fechaFinal], con
 * fechas en formato ISO `YYYY-MM-DD`. Flatpickr conserva internamente una
 * selección todavía incompleta; `onChange` solo emite un rango completo o el
 * rango vacío ["", ""].
 */
export const LegacyDateRangePicker = forwardRef(function LegacyDateRangePicker(
  {
    value = EMPTY_DATE_RANGE,
    onChange,
    maxDate,
    placeholder = "",
    className = "",
    inputClassName = "",
    disabled = false,
    showClearButton = false,
    clearLabel = "Limpiar rango de fechas",
    ...inputProps
  },
  forwardedRef,
) {
  const inputRef = useRef(null);
  const pickerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(EMPTY_DATE_RANGE);
  onChangeRef.current = onChange;

  const [startDate, endDate] = normalizeDateRange(value);
  valueRef.current = [startDate, endDate];
  const hasValue = Boolean(startDate || endDate);

  const clear = () => {
    const picker = pickerRef.current;
    if (picker) {
      picker.clear(false);
    } else if (inputRef.current) {
      inputRef.current.value = "";
    }
    onChangeRef.current?.([...EMPTY_DATE_RANGE]);
  };

  useImperativeHandle(
    forwardedRef,
    () => ({
      clear,
      close: () => pickerRef.current?.close(),
      focus: () => inputRef.current?.focus(),
      open: () => {
        if (!disabled) pickerRef.current?.open();
      },
    }),
    [disabled],
  );

  useEffect(() => {
    if (!inputRef.current) return undefined;

    const picker = flatpickr(inputRef.current, {
      allowInput: false,
      clickOpens: !disabled,
      conjunction: " to ",
      dateFormat: "Y-m-d",
      disableMobile: true,
      maxDate: maxDate || undefined,
      mode: "range",
      onChange(selectedDates, _dateString, instance) {
        if (selectedDates.length === 0) {
          onChangeRef.current?.([...EMPTY_DATE_RANGE]);
        } else if (selectedDates.length === 2) {
          onChangeRef.current?.(selectedDatesToRange(selectedDates, instance));
        }
      },
      onClose(selectedDates, _dateString, instance) {
        inputRef.current?.setAttribute("aria-expanded", "false");
        if (selectedDates.length !== 1) return;

        const [currentStartDate, currentEndDate] = valueRef.current;
        const controlledDates = currentStartDate
          ? currentEndDate
            ? [currentStartDate, currentEndDate]
            : [currentStartDate]
          : [];
        instance.setDate(controlledDates, false, "Y-m-d");
      },
      onDayCreate(_selectedDates, _dateString, _instance, dayElement) {
        dayElement.setAttribute("role", "button");
      },
      onOpen() {
        inputRef.current?.setAttribute("aria-expanded", "true");
      },
      onReady(_selectedDates, _dateString, instance) {
        const calendar = instance.calendarContainer;
        calendar.classList.add("legacy-date-range-calendar");
        calendar.setAttribute("role", "dialog");
        calendar.setAttribute("aria-modal", "true");
        calendar.setAttribute("aria-label", "Calendar");
        calendar.setAttribute("tabindex", "-1");
        instance.prevMonthNav.setAttribute("role", "button");
        instance.prevMonthNav.setAttribute("aria-label", "Previous month");
        instance.nextMonthNav.setAttribute("role", "button");
        instance.nextMonthNav.setAttribute("aria-label", "Next month");
        instance.currentYearElement?.setAttribute("tabindex", "0");
        calendar.querySelector(".flatpickr-monthDropdown-months")?.setAttribute("tabindex", "0");
      },
    });

    pickerRef.current = picker;

    return () => {
      pickerRef.current = null;
      picker.destroy();
    };
    // Flatpickr se crea una sola vez. Los valores configurables se sincronizan
    // en efectos separados para conservar la instancia y el foco del usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;

    const nextRange = [startDate, endDate];
    const currentRange = selectedDatesToRange(picker.selectedDates, picker);
    if (rangesAreEqual(nextRange, currentRange)) return;

    const selectedDates = startDate
      ? endDate
        ? [startDate, endDate]
        : [startDate]
      : [];
    picker.setDate(selectedDates, false, "Y-m-d");
  }, [startDate, endDate]);

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    picker.set("maxDate", maxDate || null);
  }, [maxDate]);

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    picker.set("clickOpens", !disabled);
    if (disabled) picker.close();
  }, [disabled]);

  const wrapperClassName = [
    "legacy-date-range-picker",
    showClearButton && hasValue ? "has-clear-button" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const fieldClassName = ["legacy-date-range-picker__input", inputClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClassName}>
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        className={fieldClassName}
        disabled={disabled}
        placeholder={placeholder}
        readOnly
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded="false"
        autoComplete="off"
        spellCheck={false}
      />
      {showClearButton && hasValue && !disabled ? (
        <button
          type="button"
          className="legacy-date-range-picker__clear"
          aria-label={clearLabel}
          title={clearLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={clear}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      ) : null}
    </div>
  );
});

LegacyDateRangePicker.displayName = "LegacyDateRangePicker";
