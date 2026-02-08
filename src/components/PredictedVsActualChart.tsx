import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useDataContext } from "@/contexts/DataContext";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(220, 18%, 10%)",
  border: "1px solid hsl(220, 14%, 18%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(160, 10%, 88%)",
};

function formatCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(v % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * Math.max(0, Math.min(1, q));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

const PredictedVsActualChart = () => {
  const { data } = useDataContext();

  const { plotData, domain, maeFormatted, rmseFormatted } = useMemo(() => {
    if (!data?.weatherModel) return { plotData: [], domain: [0, 1] as [number, number], maeFormatted: "0", rmseFormatted: "0" };

    const preds = data.weatherModel.predictions;
    const cleanPreds = preds.filter(
      (p) => Number.isFinite(p.actual) && Number.isFinite(p.predicted) && p.actual >= 0 && p.predicted >= 0
    );
    const allVals = [...cleanPreds.map((p) => p.actual), ...cleanPreds.map((p) => p.predicted)];
    const p99 = quantile(allVals, 0.99);
    const plotCap = Math.max(1, p99 * 1.15);
    const plotRows = cleanPreds
      .filter((p) => p.actual <= plotCap && p.predicted <= plotCap)
      .map((p) => ({ actual: p.actual, predicted: p.predicted }));
    const domainMax = Math.max(1, quantile(allVals, 0.995) * 1.05);

    // Error metrics
    const n = Math.max(cleanPreds.length, 1);
    const mae = cleanPreds.reduce((s, p) => s + Math.abs(p.actual - p.predicted), 0) / n;
    const rmse = Math.sqrt(cleanPreds.reduce((s, p) => s + (p.actual - p.predicted) ** 2, 0) / n);

    return {
      plotData: plotRows,
      domain: [0, domainMax] as [number, number],
      maeFormatted: formatCompact(Math.round(mae)),
      rmseFormatted: formatCompact(Math.round(rmse)),
    };
  }, [data]);

  if (!data?.weatherModel || plotData.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "1400ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Predicted vs Actual Electricity Usage
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Model behavior evaluation — MAE: {maeFormatted} kWh · RMSE: {rmseFormatted} kWh · R² = {(data.weatherModel.r2 * 100).toFixed(1)}%
        </p>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 15, left: 15, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            <XAxis
              dataKey="actual"
              type="number"
              name="Actual"
              domain={domain}
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              tickFormatter={formatCompact}
              label={{
                value: "Actual (kWh)",
                position: "bottom",
                fontSize: 10,
                fill: "hsl(220, 10%, 50%)",
                offset: 5,
              }}
            />
            <YAxis
              dataKey="predicted"
              type="number"
              name="Predicted"
              domain={domain}
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={55}
              tickFormatter={formatCompact}
              label={{
                value: "Predicted (kWh)",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
                fill: "hsl(220, 10%, 50%)",
                dx: -15,
              }}
            />
            {/* y = x perfect prediction line */}
            <ReferenceLine
              segment={[
                { x: domain[0], y: domain[0] },
                { x: domain[1], y: domain[1] },
              ]}
              stroke="hsl(38, 92%, 60%)"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: "y = x", position: "insideTopLeft", fontSize: 9, fill: "hsl(38, 92%, 60%)" }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                `${value.toLocaleString()} kWh`,
                name,
              ]}
            />
            <Scatter
              data={plotData}
              fill="hsl(152, 76%, 48%)"
              fillOpacity={0.5}
              r={3}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PredictedVsActualChart;
