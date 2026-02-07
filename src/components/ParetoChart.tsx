import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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

const ParetoChart = () => {
  const { data } = useDataContext();

  const { chartData, top5Pct, top10Pct } = useMemo(() => {
    if (!data) return { chartData: [], top5Pct: 0, top10Pct: 0 };
    const sorted = [...data.buildingConsumption]
      .sort((a, b) => b.totalMonthlyKwh - a.totalMonthlyKwh)
      .slice(0, 15);

    const totalCampus = data.buildingConsumption.reduce((s, b) => s + b.totalMonthlyKwh, 0);

    let cumulative = 0;
    const result = sorted.map((b) => {
      cumulative += b.totalMonthlyKwh;
      return {
        name: b.name.length > 20 ? b.name.substring(0, 18) + "…" : b.name,
        fullName: b.name,
        mwh: Math.round(b.totalMonthlyKwh / 1000),
        cumulativePct: Math.round((cumulative / totalCampus) * 1000) / 10,
        type: b.type,
        pctOfTotal: Math.round((b.totalMonthlyKwh / totalCampus) * 1000) / 10,
      };
    });

    return {
      chartData: result,
      top5Pct: result[4]?.cumulativePct ?? 0,
      top10Pct: result[9]?.cumulativePct ?? 0,
    };
  }, [data]);

  if (!data || chartData.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "400ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          A Small Number of Buildings Drive Most Campus Energy Use
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Top 15 buildings by total MWh — top 5 account for <span className="text-primary font-semibold">{top5Pct}%</span>, top 10 for <span className="text-primary font-semibold">{top10Pct}%</span> of campus total
        </p>
      </div>
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 45, left: 0, bottom: 65 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              angle={-40}
              textAnchor="end"
              height={75}
            />
            <YAxis
              yAxisId="mwh"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              label={{ value: "MWh", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(220, 10%, 50%)", offset: 10 }}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 10, fill: "hsl(38, 92%, 60%)" }}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => {
                if (name === "cumulativePct") return [`${value}%`, "Cumulative % of Campus"];
                return [`${value.toLocaleString()} MWh`, "Total Consumption"];
              }}
              labelFormatter={(label) => {
                const item = chartData.find((d) => d.name === label);
                return `${item?.fullName || label} (${item?.type}) — ${item?.pctOfTotal}% of campus`;
              }}
            />
            <Bar yAxisId="mwh" dataKey="mwh" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={TYPE_COLORS[entry.type] || "hsl(152, 76%, 48%)"}
                  fillOpacity={i < 5 ? 1 : 0.65}
                />
              ))}
            </Bar>
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="cumulativePct"
              stroke="hsl(38, 92%, 60%)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "hsl(38, 92%, 60%)", stroke: "hsl(220, 18%, 10%)", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" /> Academic
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-energy-cyan" /> Residential
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-energy-amber" /> Utility
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-energy-red" /> Labs
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(280, 60%, 60%)" }} /> Athletics
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-4 inline-block bg-energy-amber" /> Cumulative %
        </span>
      </div>
    </div>
  );
};

export default ParetoChart;
