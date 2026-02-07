import { useMemo } from "react";
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
  ErrorBar,
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

const BuildingDistributionChart = () => {
  const { data } = useDataContext();

  const { boxData, overallMedian } = useMemo(() => {
    if (!data) return { boxData: [], overallMedian: 0 };

    // Group daily electricity by building
    const buildingDays = new Map<string, number[]>();
    for (const entry of data.buildingWeatherData) {
      const arr = buildingDays.get(entry.buildingName) || [];
      arr.push(entry.electricity);
      buildingDays.set(entry.buildingName, arr);
    }

    // Compute box plot stats per building
    const stats = Array.from(buildingDays.entries())
      .filter(([, vals]) => vals.length >= 3)
      .map(([name, vals]) => {
        const sorted = [...vals].sort((a, b) => a - b);
        const n = sorted.length;
        const q1 = sorted[Math.floor(n * 0.25)];
        const median = sorted[Math.floor(n * 0.5)];
        const q3 = sorted[Math.floor(n * 0.75)];
        const min = sorted[0];
        const max = sorted[n - 1];
        return {
          name: name.length > 18 ? name.slice(0, 16) + "…" : name,
          fullName: name,
          median,
          q1,
          q3,
          min,
          max,
          iqr: q3 - q1,
          errorLow: median - q1,
          errorHigh: q3 - median,
          count: n,
        };
      })
      .sort((a, b) => b.median - a.median)
      .slice(0, 15); // Top 15 for readability

    const allMedians = stats.map((s) => s.median);
    const sortedMedians = [...allMedians].sort((a, b) => a - b);
    const om = sortedMedians.length > 0 ? sortedMedians[Math.floor(sortedMedians.length / 2)] : 0;

    return { boxData: stats, overallMedian: om };
  }, [data]);

  if (!data || boxData.length === 0) return null;

  const colors = [
    "hsl(152, 76%, 48%)", "hsl(190, 80%, 50%)", "hsl(38, 92%, 60%)",
    "hsl(280, 60%, 60%)", "hsl(0, 72%, 55%)", "hsl(210, 70%, 55%)",
    "hsl(320, 60%, 55%)", "hsl(170, 60%, 45%)", "hsl(50, 80%, 55%)",
    "hsl(240, 50%, 60%)", "hsl(15, 80%, 55%)", "hsl(140, 50%, 50%)",
    "hsl(200, 70%, 50%)", "hsl(260, 50%, 55%)", "hsl(30, 70%, 55%)",
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "1200ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Electricity Usage Distribution Across Buildings
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Median daily kWh with IQR error bars — extreme variance justifies non-building-level modeling
        </p>
      </div>

      <div className="h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={boxData} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              tickFormatter={formatCompact}
              label={{ value: "Daily Electricity (kWh)", position: "bottom", fontSize: 10, fill: "hsl(220, 10%, 50%)", offset: -2 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 9, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <ReferenceLine
              x={overallMedian}
              stroke="hsl(220, 10%, 40%)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: "Overall median", position: "top", fontSize: 9, fill: "hsl(220, 10%, 40%)" }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, _name: string, props: any) => {
                const d = props.payload;
                return [
                  `Median: ${value.toLocaleString()} kWh\nQ1: ${d.q1.toLocaleString()}\nQ3: ${d.q3.toLocaleString()}\nMin: ${d.min.toLocaleString()}\nMax: ${d.max.toLocaleString()}\nDays: ${d.count}`,
                  d.fullName,
                ];
              }}
            />
            <Bar dataKey="median" radius={[0, 4, 4, 0]} barSize={14}>
              <ErrorBar dataKey="errorHigh" direction="x" width={4} stroke="hsl(220, 10%, 45%)" />
              {boxData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BuildingDistributionChart;
