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
} from "recharts";
import { useDataContext } from "@/contexts/DataContext";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(220, 18%, 10%)",
  border: "1px solid hsl(220, 14%, 18%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(160, 10%, 88%)",
};

const TYPE_COLORS: Record<string, string> = {
  Utility: "hsl(38, 92%, 60%)",
  Labs: "hsl(0, 72%, 55%)",
  Academic: "hsl(152, 76%, 48%)",
  Residential: "hsl(190, 80%, 50%)",
  Athletics: "hsl(280, 60%, 60%)",
};

const IntensityByTypeChart = () => {
  const { data } = useDataContext();

  const { typeStats, outliers, campusMedian } = useMemo(() => {
    if (!data) return { typeStats: [], outliers: [], campusMedian: 0 };
    const withIntensity = data.buildingConsumption.filter(
      (b) => b.intensityKwhPerSqft > 0 && b.sqft > 0
    );

    // Group by type
    const typeGroups = new Map<string, number[]>();
    for (const b of withIntensity) {
      const group = typeGroups.get(b.type) || [];
      group.push(b.intensityKwhPerSqft);
      typeGroups.set(b.type, group);
    }

    const stats = Array.from(typeGroups.entries())
      .map(([type, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] || 0;
        const q1 = sorted[Math.floor(sorted.length * 0.25)] || 0;
        const q3 = sorted[Math.floor(sorted.length * 0.75)] || 0;
        return {
          type,
          median: Math.round(median * 100) / 100,
          q1: Math.round(q1 * 100) / 100,
          q3: Math.round(q3 * 100) / 100,
          count: sorted.length,
          range: `${(sorted[0] || 0).toFixed(1)} – ${(sorted[sorted.length - 1] || 0).toFixed(1)}`,
        };
      })
      .sort((a, b) => b.median - a.median);

    // Top 10 worst-intensity outliers
    const worstOutliers = [...withIntensity]
      .sort((a, b) => b.intensityKwhPerSqft - a.intensityKwhPerSqft)
      .slice(0, 10);

    // Campus median
    const allIntensities = withIntensity.map((b) => b.intensityKwhPerSqft).sort((a, b) => a - b);
    const cm = allIntensities.length > 0 ? allIntensities[Math.floor(allIntensities.length / 2)] : 0;

    return { typeStats: stats, outliers: worstOutliers, campusMedian: Math.round(cm * 100) / 100 };
  }, [data]);

  if (!data || typeStats.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "600ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Labs and Utility Buildings Are Systematically Less Efficient
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Median kWh/sqft by building category — campus median: {campusMedian} kWh/sqft
        </p>
      </div>

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={typeStats} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              label={{ value: "kWh/sqft", position: "bottom", fontSize: 10, fill: "hsl(220, 10%, 50%)", offset: -2 }}
            />
            <YAxis
              type="category"
              dataKey="type"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <ReferenceLine
              x={campusMedian}
              stroke="hsl(220, 10%, 40%)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: "Campus median", position: "top", fontSize: 9, fill: "hsl(220, 10%, 40%)" }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, _name: string, props: any) => {
                const entry = props.payload;
                return [
                  `Median: ${value} kWh/sqft\nIQR: ${entry.q1} – ${entry.q3}\nRange: ${entry.range}\nBuildings: ${entry.count}`,
                  "Intensity",
                ];
              }}
            />
            <Bar dataKey="median" radius={[0, 4, 4, 0]} barSize={20}>
              {typeStats.map((entry, i) => (
                <Cell key={i} fill={TYPE_COLORS[entry.type] || "hsl(220, 16%, 28%)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 10 outlier buildings */}
      <div className="mt-4 border-t border-border pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Top 10 Inefficiency Outliers
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {outliers.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 truncate">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: TYPE_COLORS[b.type] || "hsl(220, 16%, 28%)" }}
                />
                <span className="text-foreground truncate">{b.name}</span>
              </span>
              <span className="font-mono text-energy-red shrink-0 ml-2">
                {b.intensityKwhPerSqft} kWh/sqft
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IntensityByTypeChart;
