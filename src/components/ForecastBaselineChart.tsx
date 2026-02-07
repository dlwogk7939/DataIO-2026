import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from "recharts";
import { TrendingUp, FlaskConical } from "lucide-react";
import { useDataContext } from "@/contexts/DataContext";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(220, 18%, 10%)",
  border: "1px solid hsl(220, 14%, 18%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(160, 10%, 88%)",
};

const LINE_COLORS = [
  "hsl(152, 76%, 48%)",
  "hsl(190, 80%, 50%)",
  "hsl(38, 92%, 60%)",
  "hsl(280, 60%, 60%)",
  "hsl(0, 72%, 55%)",
];

const ForecastBaselineChart = () => {
  const { data } = useDataContext();

  const { chartData, buildingNames, forecastLabel } = useMemo(() => {
    if (!data) return { chartData: [], buildingNames: [], forecastLabel: "" };
    const predictions = data.buildingPredictions;
    if (!predictions || predictions.length === 0) return { chartData: [], buildingNames: [], forecastLabel: "" };

    const top5 = predictions.slice(0, 5);
    const names = top5.map((b) => b.name);

    // Get monthly data for these buildings
    const monthlyByBuilding = new Map<string, Map<string, number>>();
    for (const entry of data.buildingMonthlyData) {
      if (!names.includes(entry.name)) continue;
      if (!monthlyByBuilding.has(entry.name)) monthlyByBuilding.set(entry.name, new Map());
      monthlyByBuilding.get(entry.name)!.set(entry.monthKey, entry.kwh);
    }

    // Collect all month keys across these buildings, take last 6
    const allMonthKeys = new Set<string>();
    for (const months of monthlyByBuilding.values()) {
      for (const key of months.keys()) allMonthKeys.add(key);
    }
    const sortedKeys = Array.from(allMonthKeys).sort().slice(-6);

    if (sortedKeys.length === 0) return { chartData: [], buildingNames: names, forecastLabel: "" };

    // Determine forecast month key
    const lastKey = sortedKeys[sortedKeys.length - 1];
    const [ly, lm] = lastKey.split("-").map(Number);
    const forecastKey = `${lm === 12 ? ly + 1 : ly}-${String((lm % 12) + 1).padStart(2, "0")}`;
    const fLabel = top5[0]?.predictedMonthLabel ?? "Next";

    // Build chart data: each row is a month, each building is a column
    const allKeys = [...sortedKeys, forecastKey];
    const result = allKeys.map((mk) => {
      const [y, m] = mk.split("-").map(Number);
      const label = new Date(y, m - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const isForecast = mk === forecastKey;

      const point: Record<string, any> = { monthKey: mk, month: label, isForecast };

      for (const name of names) {
        if (isForecast) {
          const pred = top5.find((p) => p.name === name);
          point[name] = pred ? Math.round(pred.predictedKwh / 1000) : null;
        } else {
          const months = monthlyByBuilding.get(name);
          const kwh = months?.get(mk);
          point[name] = kwh != null ? Math.round(kwh / 1000) : null;
        }
      }

      return point;
    });

    return { chartData: result, buildingNames: names, forecastLabel: fLabel };
  }, [data]);

  if (!data) return null;

  if (chartData.length < 2 || buildingNames.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "800ms" }}>
        <h3 className="text-sm font-semibold text-foreground">Predicted Future Demand</h3>
        <p className="mt-4 text-xs text-muted-foreground text-center">
          Not enough historical data to generate forecast comparisons.
        </p>
      </div>
    );
  }

  const forecastMonth = chartData[chartData.length - 1]?.month;
  const lastActualMonth = chartData[chartData.length - 2]?.month;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "800ms" }}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            Forecast Highlights Where Interventions Matter Most
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Last {chartData.length - 1} months actual + {forecastLabel} forecast for top 5 buildings (MWh)
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-energy-amber/30 bg-energy-amber/10 px-2 py-0.5 text-[10px] font-medium text-energy-amber">
          <FlaskConical className="h-3 w-3" />
          Estimated
        </span>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            {lastActualMonth && forecastMonth && (
              <ReferenceArea
                x1={lastActualMonth}
                x2={forecastMonth}
                fill="hsl(38, 92%, 60%)"
                fillOpacity={0.06}
                label={{
                  value: "Forecast",
                  position: "insideTopRight",
                  fontSize: 9,
                  fill: "hsl(38, 92%, 60%)",
                }}
              />
            )}
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              label={{ value: "MWh", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(220, 10%, 50%)", offset: 10 }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [`${value?.toLocaleString()} MWh`, name]}
            />
            <Legend
              wrapperStyle={{ fontSize: "9px" }}
              iconType="line"
              iconSize={12}
            />
            {buildingNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 2, stroke: "hsl(220, 18%, 10%)" }}
                connectNulls
                name={name.length > 25 ? name.substring(0, 23) + "…" : name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[10px] text-muted-foreground italic text-right">
        Linear extrapolation from historical MoM trends — replace with ML model for production
      </div>
    </div>
  );
};

export default ForecastBaselineChart;
