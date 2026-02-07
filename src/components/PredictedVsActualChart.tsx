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

const PredictedVsActualChart = () => {
  const { data } = useDataContext();

  const { plotData, domain, maeFormatted, rmseFormatted } = useMemo(() => {
    if (!data?.weatherModel) return { plotData: [], domain: [0, 1] as [number, number], maeFormatted: "0", rmseFormatted: "0" };

    const preds = data.weatherModel.predictions;
    const allVals = [...preds.map((p) => p.actual), ...preds.map((p) => p.predicted)];
    const maxVal = Math.max(...allVals);
    const minVal = Math.min(0, Math.min(...allVals));

    // Error metrics
    const n = preds.length;
    const mae = preds.reduce((s, p) => s + Math.abs(p.actual - p.predicted), 0) / n;
    const rmse = Math.sqrt(preds.reduce((s, p) => s + (p.actual - p.predicted) ** 2, 0) / n);

    return {
      plotData: preds.map((p) => ({ actual: p.actual, predicted: p.predicted })),
      domain: [minVal, maxVal * 1.05] as [number, number],
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
