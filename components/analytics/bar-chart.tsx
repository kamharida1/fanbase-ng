import { cn } from "@/lib/utils";

const CHART_HEIGHT = 160; // px for bar area
const MIN_BAR_PX = 3;

type BarSeries = {
  value: number;
  color: string; // Tailwind bg class
  label?: string;
};

type BarChartProps = {
  points: {
    label: string;
    series: BarSeries[];
  }[];
  formatValue?: (v: number) => string;
  emptyMessage?: string;
  className?: string;
};

export function BarChart({
  points,
  formatValue = (v) => String(v),
  emptyMessage = "No data yet",
  className,
}: BarChartProps) {
  const allValues = points.flatMap((p) => p.series.map((s) => s.value));
  const maxValue = Math.max(...allValues, 1);
  const hasData = allValues.some((v) => v > 0);

  if (!hasData) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed",
          className,
        )}
        style={{ height: CHART_HEIGHT + 48 }}
      >
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className="flex min-w-0 items-end gap-3 px-1" style={{ height: CHART_HEIGHT + 48 }}>
        {points.map((point) => {
          const topValue = point.series.reduce((m, s) => Math.max(m, s.value), 0);
          return (
            <div
              key={point.label}
              className="flex min-w-[40px] flex-1 flex-col items-center gap-1"
            >
              {/* Value label above tallest bar */}
              <span className="text-[10px] text-muted-foreground">
                {formatValue(topValue)}
              </span>

              {/* Bar group */}
              <div
                className="flex w-full items-end justify-center gap-0.5"
                style={{ height: CHART_HEIGHT }}
              >
                {point.series.map((s, i) => {
                  const barH = Math.max(
                    (s.value / maxValue) * CHART_HEIGHT,
                    s.value > 0 ? MIN_BAR_PX : 0,
                  );
                  return (
                    <div
                      key={i}
                      title={s.label ? `${s.label}: ${formatValue(s.value)}` : formatValue(s.value)}
                      className={cn("flex-1 rounded-t-sm transition-all", s.color)}
                      style={{ height: barH }}
                    />
                  );
                })}
              </div>

              {/* Month label */}
              <span className="text-[10px] text-muted-foreground">
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
