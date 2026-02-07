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

const MoMPercentChart = () => {
  const { data } = useDataContext();

  const { sorted, period } = useMemo(() => {
    if (!data) return { sorted: [], period: "" };
    // Get latest MoM change per building
    const latestPerBuilding = new Map<string, (typeof data.buildingMoMChanges)[0]>();
    for (const entry of data.buildingMoMChanges) {
      const existing = latestPerBuilding.get(entry.name);
      if (!existing || entry.currMonthLabel > existing.currMonthLabel) {
        latestPerBuilding.set(entry.name, entry);
      }
    }

    // Sort by % change descending, top 10
    const result = Array.from(latestPerBuilding.values())
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 10)
      .map((e) => ({
        ...e,
        displayName: e.name.length > 22 ? e.name.substring(0, 20) + "…" : e.name,
      }));

    const p = result[0]
      ? `${result[0].prevMonthLabel} → ${result[0].currMonthLabel}`
      : "";

    return { sorted: result, period: p };
  }, [data]);

  if (!data) return null;

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "500ms" }}>
        <h3 className="text-sm font-semibold text-foreground">Disproportionate Spikes Merit Investigation</h3>
        <p className="mt-4 text-xs text-muted-foreground text-center">
          Not enough monthly data to compute month-over-month changes.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "500ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Some Buildings Show Disproportionate Usage Spikes
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Top 10 by % month-over-month increase ({period}) — contextualizes absolute changes
        </p>
      </div>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              tickFormatter={(v) => `${v}%`}
              label={{ value: "% Change", position: "bottom", fontSize: 10, fill: "hsl(220, 10%, 50%)", offset: -2 }}
            />
            <YAxis
              type="category"
              dataKey="displayName"
              tick={{ fontSize: 9, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={130}
            />
            <ReferenceLine x={0} stroke="hsl(220, 14%, 25%)" strokeWidth={1} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(_value: number, _name: string, props: any) => {
                const e = props.payload;
                return [
                  [
                    `Change: ${e.changePct >= 0 ? "+" : ""}${e.changePct}%`,
                    `Previous: ${e.prevMonthKwh.toLocaleString()} kWh`,
                    `Current: ${e.currMonthKwh.toLocaleString()} kWh`,
                    `Absolute: ${e.changeKwh >= 0 ? "+" : ""}${e.changeKwh.toLocaleString()} kWh`,
                  ].join("\n"),
                  "MoM Change",
                ];
              }}
              labelFormatter={(label) => String(label)}
            />
            <Bar dataKey="changePct" radius={[0, 4, 4, 0]} barSize={16}>
              {sorted.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.changePct > 20
                      ? "hsl(0, 72%, 55%)"
                      : entry.changePct > 0
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
        {sorted.some((e) => e.changePct > 20) && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-energy-red" /> &gt;20% increase
          </span>
        )}
        {sorted.some((e) => e.changePct > 0 && e.changePct <= 20) && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-energy-amber" /> Moderate increase
          </span>
        )}
        {sorted.some((e) => e.changePct <= 0) && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-primary" /> Decrease
          </span>
        )}
      </div>
    </div>
  );
};

export default MoMPercentChart;
