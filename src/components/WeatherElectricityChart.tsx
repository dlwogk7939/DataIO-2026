import { useState, useMemo } from "react";
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
import { BarChart3, TrendingUp } from "lucide-react";
import { useDataContext } from "@/contexts/DataContext";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(220, 18%, 10%)",
  border: "1px solid hsl(220, 14%, 18%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(160, 10%, 88%)",
};

type XAxisVar = "temperature" | "precipitation" | "windSpeed";
type ChartType = "bar" | "trend";

interface XAxisOption {
  key: XAxisVar;
  label: string;
  unit: string;
  titleSegment: string;
}

const X_AXIS_OPTIONS: XAxisOption[] = [
  { key: "temperature", label: "Temperature", unit: "°F", titleSegment: "Temperature" },
  { key: "precipitation", label: "Precipitation", unit: "mm", titleSegment: "Precipitation" },
  { key: "windSpeed", label: "Wind Speed", unit: "m/s", titleSegment: "Wind Speed" },
];

function formatCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(v % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
}

const WeatherElectricityChart = () => {
  const { data } = useDataContext();
  const [xAxisVar, setXAxisVar] = useState<XAxisVar>("temperature");
  const [chartType, setChartType] = useState<ChartType>("bar");

  const activeOption = X_AXIS_OPTIONS.find((o) => o.key === xAxisVar)!;
  const isPrecip = xAxisVar === "precipitation";
  const precipTicks = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

  // Bar mode: fixed precipitation scale; Trend mode: dynamic domain starting at 0
  const barXAxisProps = isPrecip
    ? { ticks: precipTicks, domain: [-0.05, 0.55] as [number, number], type: "number" as const }
    : {};

  // Trend mode gets a dynamic domain computed from chartData (defined after chartData)
  // We'll compute trendXAxisProps after chartData is ready


  const chartData = useMemo(() => {
    if (!data) return [];

    // Get the weather field value for each daily entry
    const getWeatherVal = (entry: typeof data.dailyData[0]) => {
      switch (xAxisVar) {
        case "temperature": return entry.avgTemperature;
        case "precipitation": return entry.avgPrecipitation;
        case "windSpeed": return entry.avgWindSpeed;
      }
    };

    // Filter out zero-weather entries
    const filtered = data.dailyData.filter((d) => getWeatherVal(d) !== 0 && d.totalKwh > 0);

    // Bin the data by weather variable ranges for bar chart clarity
    if (filtered.length === 0) return [];

    // For precipitation, use fixed bins aligned to the defined ticks (0, 0.1, ..., 0.5)
    if (xAxisVar === "precipitation") {
      const precipBins = new Map<number, { total: number; count: number }>();
      for (const d of filtered) {
        const val = getWeatherVal(d);
        // Snap to nearest 0.1 bin center, clamped to [0, 0.5]
        const binCenter = Math.min(0.5, Math.max(0, Math.round(val * 10) / 10));
        const existing = precipBins.get(binCenter) || { total: 0, count: 0 };
        existing.total += d.totalKwh;
        existing.count += 1;
        precipBins.set(binCenter, existing);
      }
      return Array.from(precipBins.entries())
        .sort(([a], [b]) => a - b)
        .map(([binCenter, val]) => ({
          weatherVal: binCenter,
          electricity: Math.round(val.total / val.count),
          label: `${binCenter}${activeOption.unit}`,
        }));
    }

    const values = filtered.map(getWeatherVal);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) return filtered.map((d) => ({
      weatherVal: getWeatherVal(d),
      electricity: d.totalKwh,
      label: `${getWeatherVal(d)}${activeOption.unit}`,
    }));

    // Create ~20 bins for a clean chart
    const binCount = Math.min(20, filtered.length);
    const binSize = range / binCount;

    const bins = new Map<number, { total: number; count: number }>();
    for (const d of filtered) {
      const val = getWeatherVal(d);
      const binIndex = Math.min(Math.floor((val - min) / binSize), binCount - 1);
      const binCenter = Math.round((min + binIndex * binSize + binSize / 2) * 10) / 10;
      const existing = bins.get(binCenter) || { total: 0, count: 0 };
      existing.total += d.totalKwh;
      existing.count += 1;
      bins.set(binCenter, existing);
    }

    return Array.from(bins.entries())
      .sort(([a], [b]) => a - b)
      .map(([binCenter, val]) => ({
        weatherVal: binCenter,
        electricity: Math.round(val.total / val.count),
        label: `${binCenter}${activeOption.unit}`,
      }));
  }, [data, xAxisVar, activeOption.unit]);

  // Trend mode: dynamic domain for precipitation, starting at 0 with slight padding on the right
  const trendXAxisProps = useMemo(() => {
    if (!isPrecip || chartData.length === 0) return {};
    const maxVal = Math.max(...chartData.map((d) => d.weatherVal));
    const domainMax = Math.max(0.1, maxVal + 0.02); // small right padding
    return { domain: [0, domainMax] as [number, number], type: "number" as const };
  }, [isPrecip, chartData]);

  if (!data) return null;

  const chartTitle = `Campus ELECTRICITY Usage Over ${activeOption.titleSegment}`;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "900ms" }}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{chartTitle}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Average daily electricity usage binned by {activeOption.label.toLowerCase()} — toggle variable and chart type
        </p>
      </div>

      {/* Toggle controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* X-Axis toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
          {X_AXIS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setXAxisVar(opt.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                xAxisVar === opt.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Chart type toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
          <button
            onClick={() => setChartType("bar")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              chartType === "bar"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-3 w-3" />
            Bar
          </button>
          <button
            onClick={() => setChartType("trend")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              chartType === "trend"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="h-3 w-3" />
            Trend
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div className="h-[350px]">
        {chartData.length < 2 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Not enough {activeOption.label.toLowerCase()} data available to render this chart.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={chartData} margin={{ top: 5, right: 15, left: 15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                <XAxis
                  dataKey="weatherVal"
                  tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
                  label={{
                    value: `${activeOption.label} (${activeOption.unit})`,
                    position: "bottom",
                    fontSize: 10,
                    fill: "hsl(220, 10%, 50%)",
                    offset: 5,
                  }}
                  {...barXAxisProps}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                  tickFormatter={formatCompact}
                  label={{
                    value: "Avg Daily Electricity (kWh)",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 10,
                    fill: "hsl(220, 10%, 50%)",
                    dx: -15,
                  }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [`${value.toLocaleString()} kWh`, "Avg Electricity"]}
                  labelFormatter={(label) => `${activeOption.label}: ${label}${activeOption.unit}`}
                />
                <Bar
                  dataKey="electricity"
                  fill="hsl(152, 76%, 48%)"
                  fillOpacity={0.8}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 5, right: 15, left: 15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                <XAxis
                  dataKey="weatherVal"
                  tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
                  label={{
                    value: `${activeOption.label} (${activeOption.unit})`,
                    position: "bottom",
                    fontSize: 10,
                    fill: "hsl(220, 10%, 50%)",
                    offset: 5,
                  }}
                  {...trendXAxisProps}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                  tickFormatter={formatCompact}
                  label={{
                    value: "Avg Daily Electricity (kWh)",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 10,
                    fill: "hsl(220, 10%, 50%)",
                    dx: -15,
                  }}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => [`${value.toLocaleString()} kWh`, "Avg Electricity"]}
                  labelFormatter={(label) => `${activeOption.label}: ${label}${activeOption.unit}`}
                />
                <Line
                  type="monotone"
                  dataKey="electricity"
                  stroke="hsl(152, 76%, 48%)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "hsl(152, 76%, 48%)", stroke: "hsl(220, 18%, 10%)", strokeWidth: 2 }}
                  activeDot={{ r: 5, stroke: "hsl(152, 76%, 48%)", strokeWidth: 2 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default WeatherElectricityChart;
