import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp, FlaskConical } from "lucide-react";
import { useDataContext } from "@/contexts/DataContext";

const PredictedUsageChart = () => {
  const { data } = useDataContext();
  if (!data) return null;

  const predictions = data.buildingPredictions;

  if (!predictions || predictions.length === 0) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-5 animate-fade-in"
        style={{ animationDelay: "800ms" }}
      >
        <h3 className="text-sm font-semibold text-foreground">
          Predicted Next-Month Usage
        </h3>
        <p className="mt-4 text-xs text-muted-foreground text-center">
          Not enough historical data to generate predictions.
        </p>
      </div>
    );
  }

  const top10 = predictions.slice(0, 10);
  const nextMonthLabel = top10[0]?.predictedMonthLabel ?? "Next Month";

  return (
    <div
      className="rounded-lg border border-border bg-card p-5 animate-fade-in"
      style={{ animationDelay: "800ms" }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            Predicted Next-Month Usage
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Top 10 buildings — estimated for {nextMonthLabel}
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
          <FlaskConical className="h-3 w-3" />
          Estimated
        </span>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={top10}
            layout="vertical"
            margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220, 14%, 18%)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))
              }
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 9, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={120}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 18%)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(160, 10%, 88%)",
              }}
              formatter={(_value: number, _name: string, props: any) => {
                const entry = props.payload;
                return [
                  [
                    `Predicted: ${Math.round(entry.predictedKwh).toLocaleString()} kWh`,
                    `Last month: ${Math.round(entry.lastMonthKwh).toLocaleString()} kWh`,
                    `Avg MoM trend: ${entry.avgMoMChangePct >= 0 ? "+" : ""}${entry.avgMoMChangePct.toFixed(1)}%`,
                  ].join("\n"),
                  "Forecast",
                ];
              }}
              labelFormatter={(label) => String(label)}
            />
            <Bar dataKey="predictedKwh" radius={[0, 4, 4, 0]}>
              {top10.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.avgMoMChangePct > 5
                      ? "hsl(0, 72%, 55%)"
                      : entry.avgMoMChangePct > 0
                        ? "hsl(38, 92%, 60%)"
                        : "hsl(152, 76%, 48%)"
                  }
                  fillOpacity={0.75}
                  stroke={
                    entry.avgMoMChangePct > 5
                      ? "hsl(0, 72%, 55%)"
                      : entry.avgMoMChangePct > 0
                        ? "hsl(38, 92%, 60%)"
                        : "hsl(152, 76%, 48%)"
                  }
                  strokeWidth={1}
                  strokeDasharray="4 2"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(0, 72%, 55%)" }} /> Growing &gt;5%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(38, 92%, 60%)" }} /> Slight increase
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(152, 76%, 48%)" }} /> Decreasing
        </span>
        <span className="ml-auto italic">Linear extrapolation — replace with ML model</span>
      </div>
    </div>
  );
};

export default PredictedUsageChart;
