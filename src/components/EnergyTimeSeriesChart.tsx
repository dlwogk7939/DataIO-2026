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
import { buildingConsumption } from "@/data/mockData";

const chartData = [...buildingConsumption]
  .sort((a, b) => b.totalMonthlyKwh - a.totalMonthlyKwh)
  .map((b) => ({
    name: b.name,
    type: b.type,
    kWh: Math.round(b.totalMonthlyKwh / 1000), // Convert to MWh for readability
  }));

const EnergyTimeSeriesChart = () => (
  <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "400ms" }}>
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-foreground">Building Electricity Usage</h3>
      <p className="text-xs text-muted-foreground mt-1">
        Total monthly electricity consumption by building (MWh) — January 2025
      </p>
    </div>
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
          <defs>
            <linearGradient id="buildingBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(152, 76%, 48%)" stopOpacity={0.9} />
              <stop offset="100%" stopColor="hsl(152, 76%, 48%)" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9, fill: "hsl(220, 10%, 50%)" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
            angle={-40}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}`}
            label={{
              value: "MWh",
              angle: -90,
              position: "insideLeft",
              fontSize: 10,
              fill: "hsl(220, 10%, 50%)",
              offset: 10,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(220, 18%, 10%)",
              border: "1px solid hsl(220, 14%, 18%)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "hsl(160, 10%, 88%)",
            }}
            formatter={(value: number) => [`${value.toLocaleString()} MWh`, "Usage"]}
            labelFormatter={(label) => {
              const item = chartData.find((d) => d.name === label);
              return `${label} (${item?.type || ""})`;
            }}
          />
          <Bar dataKey="kWh" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  index < 3
                    ? "hsl(152, 76%, 48%)"
                    : index < 6
                    ? "hsl(190, 80%, 50%)"
                    : "hsl(220, 16%, 28%)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default EnergyTimeSeriesChart;
