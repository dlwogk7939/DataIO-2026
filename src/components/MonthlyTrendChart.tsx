import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useDataContext } from "@/contexts/DataContext";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(220, 18%, 10%)",
  border: "1px solid hsl(220, 14%, 18%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(160, 10%, 88%)",
};

const MonthlyTrendChart = () => {
  const { data } = useDataContext();

  const monthlyData = useMemo(() => {
    if (!data) return [];
    const monthMap = new Map<string, { kwh: number; temps: number[] }>();

    for (const d of data.dailyData) {
      const date = new Date(d.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(monthKey) || { kwh: 0, temps: [] };
      existing.kwh += d.totalKwh;
      if (d.avgTemperature !== 0) existing.temps.push(d.avgTemperature);
      monthMap.set(monthKey, existing);
    }

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [y, m] = key.split("-").map(Number);
        return {
          month: new Date(y, m - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          totalMwh: Math.round(val.kwh / 1000),
          avgTemp:
            val.temps.length > 0
              ? Math.round((val.temps.reduce((s, t) => s + t, 0) / val.temps.length) * 10) / 10
              : 0,
        };
      });
  }, [data]);

  if (!data) return null;

  if (monthlyData.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "700ms" }}>
        <h3 className="text-sm font-semibold text-foreground">Seasonal Trends Do Not Scale Linearly</h3>
        <p className="mt-4 text-xs text-muted-foreground text-center">
          Not enough monthly data to show seasonal trends.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "700ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Seasonal Demand Exists but Doesn't Scale Linearly with Weather
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Monthly electricity (MWh) vs average temperature — structural baseload exceeds weather-driven demand
        </p>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={monthlyData} margin={{ top: 5, right: 10, left: 15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
            />
            <YAxis
              yAxisId="mwh"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(v: number) => {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                return String(v);
              }}
              label={{ value: "MWh", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(220, 10%, 50%)", dx: -10 }}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              tick={{ fontSize: 10, fill: "hsl(38, 92%, 60%)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}°`}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => {
                if (name === "avgTemp") return [`${value}°F`, "Avg Temperature"];
                return [`${value.toLocaleString()} MWh`, "Total Electricity"];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "10px", color: "hsl(220, 10%, 50%)" }}
              formatter={(value) => (value === "totalMwh" ? "Monthly MWh" : "Avg Temperature (°F)")}
            />
            <Bar
              yAxisId="mwh"
              dataKey="totalMwh"
              fill="hsl(190, 80%, 50%)"
              fillOpacity={0.7}
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="avgTemp"
              stroke="hsl(38, 92%, 60%)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "hsl(38, 92%, 60%)", stroke: "hsl(220, 18%, 10%)", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MonthlyTrendChart;
