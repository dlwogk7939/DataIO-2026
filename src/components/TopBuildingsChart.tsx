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
import { useDataContext } from "@/contexts/DataContext";

const TopBuildingsChart = () => {
  const { data } = useDataContext();
  if (!data) return null;

  const sortedBuildings = [...data.buildingConsumption]
    .sort((a, b) => b.avgHourlyKwh - a.avgHourlyKwh)
    .slice(0, 8);

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "500ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Top Buildings by Avg. Electricity</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Average hourly kWh consumption — a small subset dominates total demand
        </p>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sortedBuildings} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 18%)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(160, 10%, 88%)",
              }}
              formatter={(value: number) => [`${value} kWh/hr`, "Avg. Usage"]}
            />
            <Bar dataKey="avgHourlyKwh" radius={[0, 4, 4, 0]}>
              {sortedBuildings.map((_, index) => (
                <Cell
                  key={index}
                  fill={index === 0 ? "hsl(152, 76%, 48%)" : index < 3 ? "hsl(190, 80%, 50%)" : "hsl(220, 16%, 28%)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TopBuildingsChart;
