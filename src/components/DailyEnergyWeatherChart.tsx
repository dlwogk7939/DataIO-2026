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

const DailyEnergyWeatherChart = () => {
  const { data } = useDataContext();
  if (!data) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "800ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Daily Electricity with Temperature Overlay</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Weather influences demand, but structural factors have a stronger effect
        </p>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              interval={4}
            />
            <YAxis
              yAxisId="kwh"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
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
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 18%)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(160, 10%, 88%)",
              }}
              formatter={(value: number, name: string) => [
                name === "avgTemperature"
                  ? `${value}°F`
                  : `${value.toLocaleString()} kWh`,
                name === "avgTemperature" ? "Avg Temperature" : "Electricity",
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", color: "hsl(220, 10%, 50%)" }}
              formatter={(value) =>
                value === "totalKwh" ? "Daily kWh" : "Avg Temp (°F)"
              }
            />
            <Bar
              yAxisId="kwh"
              dataKey="totalKwh"
              fill="hsl(190, 80%, 50%)"
              fillOpacity={0.6}
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="avgTemperature"
              stroke="hsl(38, 92%, 60%)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DailyEnergyWeatherChart;
