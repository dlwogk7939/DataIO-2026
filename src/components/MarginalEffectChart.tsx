import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

const MarginalEffectChart = () => {
  const { data } = useDataContext();

  if (!data?.weatherModel) return null;

  const { marginalEffect, coefficients } = data.weatherModel;
  const perDegree = Math.round(coefficients.temperature);

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "1100ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Marginal Effect of Temperature on Electricity
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Model-predicted usage holding wind &amp; precipitation constant — {perDegree > 0 ? "+" : ""}{perDegree.toLocaleString()} kWh per °F
        </p>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={marginalEffect} margin={{ top: 5, right: 15, left: 15, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            <XAxis
              dataKey="temperature"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              label={{
                value: "Temperature (°F)",
                position: "bottom",
                fontSize: 10,
                fill: "hsl(220, 10%, 50%)",
                offset: 5,
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={55}
              tickFormatter={formatCompact}
              label={{
                value: "Predicted Electricity (kWh)",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
                fill: "hsl(220, 10%, 50%)",
                dx: -15,
              }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number) => [`${value.toLocaleString()} kWh`, "Predicted"]}
              labelFormatter={(label) => `Temperature: ${label}°F`}
            />
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="hsl(190, 80%, 50%)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "hsl(190, 80%, 50%)", stroke: "hsl(220, 18%, 10%)", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default MarginalEffectChart;
