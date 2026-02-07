import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { hourlyData } from "@/data/mockData";

const chartData = hourlyData
  .filter((_, i) => i % 3 === 0) // Sample every 3 hours for performance
  .map((d) => ({
    time: new Date(d.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    hour: `${new Date(d.timestamp).getHours()}:00`,
    kWh: d.totalKwh,
  }));

const EnergyTimeSeriesChart = () => (
  <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "400ms" }}>
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-foreground">Hourly Electricity Usage</h3>
      <p className="text-xs text-muted-foreground mt-1">
        Campus-wide electricity consumption over 30 days (sampled every 3 hours)
      </p>
    </div>
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(152, 76%, 48%)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(152, 76%, 48%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
            interval={Math.floor(chartData.length / 6)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(220, 18%, 10%)",
              border: "1px solid hsl(220, 14%, 18%)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "hsl(160, 10%, 88%)",
            }}
            formatter={(value: number) => [`${value.toLocaleString()} kWh`, "Usage"]}
          />
          <Area
            type="monotone"
            dataKey="kWh"
            stroke="hsl(152, 76%, 48%)"
            strokeWidth={1.5}
            fill="url(#energyGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default EnergyTimeSeriesChart;
