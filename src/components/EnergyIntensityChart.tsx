import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { useDataContext } from "@/contexts/DataContext";

const EnergyIntensityChart = () => {
  const { data } = useDataContext();
  if (!data) return null;

  const sortedByIntensity = [...data.buildingConsumption].sort(
    (a, b) => b.intensityKwhPerSqft - a.intensityKwhPerSqft
  );

  const avgIntensity =
    sortedByIntensity.length > 0
      ? sortedByIntensity.reduce((s, b) => s + b.intensityKwhPerSqft, 0) / sortedByIntensity.length
      : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "700ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Electricity Intensity by Building</h3>
        <p className="text-xs text-muted-foreground mt-1">
          kWh per sqft — reveals inefficiencies hidden in raw consumption
        </p>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sortedByIntensity} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              angle={-35}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 18%)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(160, 10%, 88%)",
              }}
              formatter={(value: number) => [`${value} kWh/sqft`, "Intensity"]}
            />
            <ReferenceLine
              y={avgIntensity}
              stroke="hsl(38, 92%, 60%)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Avg: ${avgIntensity.toFixed(1)}`,
                position: "right",
                fontSize: 10,
                fill: "hsl(38, 92%, 60%)",
              }}
            />
            <Bar dataKey="intensityKwhPerSqft" radius={[4, 4, 0, 0]}>
              {sortedByIntensity.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.intensityKwhPerSqft > avgIntensity * 1.5
                      ? "hsl(0, 72%, 55%)"
                      : entry.intensityKwhPerSqft > avgIntensity
                      ? "hsl(38, 92%, 60%)"
                      : "hsl(152, 76%, 48%)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-energy-red" /> Above 1.5× avg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-energy-amber" /> Above avg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" /> Below avg
        </span>
      </div>
    </div>
  );
};

export default EnergyIntensityChart;
