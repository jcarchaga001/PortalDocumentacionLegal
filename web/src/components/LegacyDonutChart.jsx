import Highcharts from "highcharts/esm/highcharts.js";
import "highcharts/esm/modules/accessibility.js";
import { useEffect, useRef } from "react";

const CHART_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';

function number(value) {
  return Number(value || 0);
}

function percent(value, total) {
  return total ? `${((number(value) / total) * 100).toFixed(2)}%` : "0.00%";
}

export function LegacyDonutChart({
  current,
  expiring,
  missing,
  height,
  showLegend = false,
  onStatusSelect,
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const values = [number(current), number(expiring), number(missing)];
    const total = values.reduce((sum, value) => sum + value, 0);
    const points = [
      { name: "Aprobado", y: values[0], color: "#37b24d", status: 2 },
      { name: "Por Vencer", y: values[1], color: "#f76707", status: 4 },
      { name: "No Registrados", y: values[2], color: "#c92a2a", status: 5 },
    ].map((point) => ({
      ...point,
      custom: {
        status: point.status,
        tooltip: `N° Documentos: ${point.y} - ${percent(point.y, total)}`,
      },
    }));

    const chart = Highcharts.chart(containerRef.current, {
      chart: {
        type: "pie",
        height,
        backgroundColor: "transparent",
        animation: false,
        style: { fontFamily: CHART_FONT, fontSize: "1rem" },
      },
      accessibility: { enabled: true },
      credits: { enabled: false },
      title: { text: null },
      subtitle: { text: null },
      legend: showLegend
        ? {
            enabled: true,
            align: "center",
            verticalAlign: "bottom",
            layout: "horizontal",
            itemDistance: 50,
            itemStyle: {
              color: "#333333",
              cursor: "pointer",
              fontSize: "0.8em",
              fontWeight: "400",
              textDecoration: "none",
            },
            symbolHeight: 12,
            symbolRadius: 6,
            symbolWidth: 12,
          }
        : { enabled: false },
      tooltip: {
        headerFormat: "",
        pointFormat: "{point.custom.tooltip}",
      },
      plotOptions: {
        pie: {
          animation: false,
          borderColor: showLegend ? null : "#ffffff",
          borderRadius: 3,
          borderWidth: showLegend ? 0 : 1,
          cursor: "pointer",
          dataLabels: { enabled: false },
          innerSize: "50%",
          showInLegend: showLegend,
          point: {
            events: {
              click() {
                onStatusSelect?.(this.options.custom.status);
              },
            },
          },
        },
      },
      series: [{ type: "pie", name: "", data: points }],
    });

    return () => chart.destroy();
  }, [current, expiring, height, missing, onStatusSelect, showLegend]);

  return <div className="legacy-highcharts-donut" ref={containerRef} />;
}
