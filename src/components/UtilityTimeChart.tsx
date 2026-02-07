import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useDataContext } from "@/contexts/DataContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";

/* ── Utility color map ─────────────────────────────────────────────────── */
const UTILITY_COLORS: Record<string, string> = {
  electricity: "hsl(210, 70%, 55%)",
  electric: "hsl(210, 70%, 55%)",
  gas: "hsl(30, 85%, 55%)",
  "natural gas": "hsl(30, 85%, 55%)",
  steam: "hsl(0, 65%, 55%)",
  "chilled water": "hsl(190, 80%, 50%)",
  power: "hsl(260, 60%, 55%)",
};

function getUtilityColor(utility: string): string {
  const lower = utility.toLowerCase();
  for (const [key, color] of Object.entries(UTILITY_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "hsl(152, 76%, 48%)";
}

/* ── Subtitle per utility ──────────────────────────────────────────────── */
const UTILITY_SUBTITLES: Record<string, string> = {
  electricity: "Reveals seasonal demand patterns and structural energy loads",
  electric: "Reveals seasonal demand patterns and structural energy loads",
  gas: "Shows heating-season peaks and baseload gas consumption",
  "natural gas": "Shows heating-season peaks and baseload gas consumption",
  steam: "Tracks district heating demand and thermal load patterns",
  "chilled water": "Maps cooling demand to seasonal temperature cycles",
};

function getSubtitle(utility: string): string {
  const lower = utility.toLowerCase();
  for (const [key, sub] of Object.entries(UTILITY_SUBTITLES)) {
    if (lower.includes(key)) return sub;
  }
  return "Time-series view used as the foundation for future demand forecasting";
}

/* ── Tooltip style ─────────────────────────────────────────────────────── */
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(220, 18%, 10%)",
  border: "1px solid hsl(220, 14%, 18%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(160, 10%, 88%)",
};

/* ── Component ─────────────────────────────────────────────────────────── */
const UtilityTimeChart = () => {
  const { data } = useDataContext();
  const [selectedUtility, setSelectedUtility] = useState<string>("");
  const [viewMode, setViewMode] = useState<"bar" | "line">("bar");

  // Determine default utility on first render
  const utilities = useMemo(() => {
    if (!data) return [];
    return data.availableUtilities;
  }, [data]);

  // Auto-select first utility
  const activeUtility = selectedUtility || utilities[0] || "";

  const { chartData, unit, maxUsage } = useMemo(() => {
    if (!data || !activeUtility) return { chartData: [], unit: "kWh", maxUsage: 0 };

    const filtered = data.utilityMonthlyData.filter(
      (d) => d.utility === activeUtility
    );

    if (filtered.length === 0) return { chartData: [], unit: "kWh", maxUsage: 0 };

    // Determine unit from data
    const detectedUnit = filtered[0].unit || "kWh";

    // Compute % change from previous period
    const result = filtered.map((entry, i) => {
      const prev = i > 0 ? filtered[i - 1].totalUsage : null;
      const pctChange = prev && prev > 0
        ? Math.round(((entry.totalUsage - prev) / prev) * 1000) / 10
        : null;
      return {
        ...entry,
        pctChange,
        displayUsage: entry.totalUsage,
      };
    });

    const max = Math.max(...result.map((d) => d.displayUsage));

    return { chartData: result, unit: detectedUnit, maxUsage: max };
  }, [data, activeUtility]);

  if (!data || utilities.length === 0) return null;

  const color = getUtilityColor(activeUtility);
  const subtitle = getSubtitle(activeUtility);

  const formatUsage = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
    return val.toLocaleString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={TOOLTIP_STYLE} className="px-3 py-2.5">
        <p className="font-semibold text-xs mb-1" style={{ color }}>
          {activeUtility}
        </p>
        <p className="text-[11px] text-muted-foreground mb-1.5">{d.monthLabel}</p>
        <p className="text-sm font-mono font-medium">
          {d.displayUsage.toLocaleString()} {unit}
        </p>
        {d.pctChange !== null && (
          <p className={`text-[11px] mt-1 ${d.pctChange >= 0 ? "text-energy-red" : "text-primary"}`}>
            {d.pctChange >= 0 ? "▲" : "▼"} {Math.abs(d.pctChange)}% from previous month
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      className="rounded-lg border border-border bg-card p-5 animate-fade-in"
      style={{ animationDelay: "400ms" }}
    >
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            Campus {activeUtility} Usage Over Time
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("bar")}
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
                viewMode === "bar"
                  ? "bg-secondary text-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              Bars
            </button>
            <button
              onClick={() => setViewMode("line")}
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
                viewMode === "line"
                  ? "bg-secondary text-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              Trend
            </button>
          </div>

          {/* Utility selector */}
          <Select value={activeUtility} onValueChange={setSelectedUtility}>
            <SelectTrigger className="h-8 w-[160px] text-xs bg-card border-border">
              <SelectValue placeholder="Select Utility" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {utilities.map((u) => (
                <SelectItem key={u} value={u} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: getUtilityColor(u) }}
                    />
                    {u}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[340px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data available for {activeUtility}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "bar" ? (
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 10, bottom: 45 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(220, 14%, 18%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
                  angle={-35}
                  textAnchor="end"
                  height={55}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatUsage}
                  label={{
                    value: unit,
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 10,
                    fill: "hsl(220, 10%, 50%)",
                    offset: 10,
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="displayUsage"
                  fill={color}
                  radius={[4, 4, 0, 0]}
                  fillOpacity={0.85}
                />
              </BarChart>
            ) : (
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 10, bottom: 45 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(220, 14%, 18%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
                  angle={-35}
                  textAnchor="end"
                  height={55}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatUsage}
                  label={{
                    value: unit,
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 10,
                    fill: "hsl(220, 10%, 50%)",
                    offset: 10,
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="displayUsage"
                  stroke={color}
                  strokeWidth={2.5}
                  dot={{
                    r: 3,
                    fill: color,
                    stroke: "hsl(220, 18%, 10%)",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer: Legend + Forecast hook */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: color }}
            />
            {activeUtility}
          </span>
          <span className="font-mono">
            {chartData.length} months · {unit}
          </span>
        </div>

        {/* Forecast placeholder */}
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1">
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            🔮 Forecasting coming soon — predicted next-month usage will appear here
          </span>
        </div>
      </div>
    </div>
  );
};

export default UtilityTimeChart;
