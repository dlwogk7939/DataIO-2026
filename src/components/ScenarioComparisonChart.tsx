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

const COLORS = ["hsl(190, 80%, 50%)", "hsl(0, 72%, 55%)"];

const ScenarioComparisonChart = () => {
  const { data } = useDataContext();

  if (!data?.weatherModel) return null;

  const { scenarioComparison } = data.weatherModel;
  const diff = scenarioComparison[1].predicted - scenarioComparison[0].predicted;
  const pctDiff =
    scenarioComparison[0].predicted > 0
      ? Math.round((diff / scenarioComparison[0].predicted) * 100)
      : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "1500ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Scenario Comparison: Moderate vs Extreme Temperature
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          What-if analysis — predicted campus-wide demand at 70°F vs 90°F
        </p>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={scenarioComparison} margin={{ top: 5, right: 30, left: 15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={55}
              tickFormatter={formatCompact}
              label={{
                value: "Predicted (kWh)",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
                fill: "hsl(220, 10%, 50%)",
                dx: -15,
              }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number) => [`${value.toLocaleString()} kWh`, "Predicted Usage"]}
            />
            <Bar dataKey="predicted" radius={[4, 4, 0, 0]} barSize={50}>
              {scenarioComparison.map((_, i) => (
                <Cell key={i} fill={COLORS[i]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 rounded-md border border-border bg-background p-3 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Moving from 70°F → 90°F changes predicted campus demand by
        </p>
        <span className={`font-mono text-sm font-bold ${diff > 0 ? "text-destructive" : "text-primary"}`}>
          {diff > 0 ? "+" : ""}{formatCompact(diff)} kWh ({pctDiff > 0 ? "+" : ""}{pctDiff}%)
        </span>
      </div>
    </div>
  );
};

export default ScenarioComparisonChart;
