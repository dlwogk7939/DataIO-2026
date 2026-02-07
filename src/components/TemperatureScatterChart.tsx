import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import { useDataContext } from "@/contexts/DataContext";

const TemperatureScatterChart = () => {
  const { data } = useDataContext();
  if (!data) return null;

  const correlation = data.summaryMetrics.weatherCorrelation;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "600ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Electricity vs Temperature</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Correlation r={correlation} — {Math.abs(correlation) < 0.4 ? "internal loads dominate over weather sensitivity" : "moderate weather sensitivity detected"}
        </p>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            <XAxis
              type="number"
              dataKey="temperature"
              name="Temperature"
              unit="°F"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              label={{ value: "Temperature (°F)", position: "bottom", fontSize: 10, fill: "hsl(220, 10%, 50%)", offset: -2 }}
            />
            <YAxis
              type="number"
              dataKey="electricity"
              name="Electricity"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <ZAxis range={[40, 40]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 18%)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(160, 10%, 88%)",
              }}
              formatter={(value: number, name: string) => [
                name === "Temperature" ? `${value}°F` : `${value.toLocaleString()} kWh`,
                name,
              ]}
            />
            <Scatter data={data.tempVsElectricity} fill="hsl(38, 92%, 60%)" fillOpacity={0.8} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TemperatureScatterChart;
