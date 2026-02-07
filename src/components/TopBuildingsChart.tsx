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

const TopBuildingsChart = () => {
  const { data } = useDataContext();
  if (!data) return null;

  // Get the largest MoM increases, pick the latest month transition per building,
  // then rank by changeKwh descending and take top 10
  const latestPerBuilding = new Map<string, typeof data.buildingMoMChanges[0]>();
  for (const entry of data.buildingMoMChanges) {
    const existing = latestPerBuilding.get(entry.name);
    if (!existing || entry.currMonthLabel > existing.currMonthLabel) {
      latestPerBuilding.set(entry.name, entry);
    }
  }

  const sorted = Array.from(latestPerBuilding.values())
    .sort((a, b) => b.changeKwh - a.changeKwh)
    .slice(0, 10);

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "500ms" }}>
        <h3 className="text-sm font-semibold text-foreground">Largest MoM Electricity Increase</h3>
        <p className="mt-4 text-xs text-muted-foreground text-center">
          Not enough monthly data to compute month-over-month changes.
        </p>
      </div>
    );
  }

  const period = sorted[0]
    ? `${sorted[0].prevMonthLabel} → ${sorted[0].currMonthLabel}`
    : "";

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "500ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Largest Month-over-Month Electricity Increase
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Top 10 buildings by absolute kWh increase ({period})
        </p>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
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
                v >= 1000 || v <= -1000
                  ? `${(v / 1000).toFixed(0)}k`
                  : String(v)
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
            <ReferenceLine x={0} stroke="hsl(220, 14%, 25%)" strokeWidth={1} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220, 18%, 10%)",
                border: "1px solid hsl(220, 14%, 18%)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(160, 10%, 88%)",
              }}
              formatter={(value: number, _name: string, props: any) => {
                const entry = props.payload;
                return [
                  `${value >= 0 ? "+" : ""}${value.toLocaleString()} kWh (${entry.changePct >= 0 ? "+" : ""}${entry.changePct}%)`,
                  "MoM Change",
                ];
              }}
              labelFormatter={(label) => String(label)}
            />
            <Bar dataKey="changeKwh" radius={[0, 4, 4, 0]}>
              {sorted.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.changeKwh > 0
                      ? index < 3
                        ? "hsl(0, 72%, 55%)"
                        : "hsl(38, 92%, 60%)"
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
          <span className="inline-block h-2 w-2 rounded-full bg-energy-red" /> Top 3 increase
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-energy-amber" /> Moderate increase
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" /> Decrease
        </span>
      </div>
    </div>
  );
};

export default TopBuildingsChart;
