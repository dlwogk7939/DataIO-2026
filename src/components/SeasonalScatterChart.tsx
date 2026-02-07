import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Legend,
} from "recharts";
import { useDataContext } from "@/contexts/DataContext";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(220, 18%, 10%)",
  border: "1px solid hsl(220, 14%, 18%)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(160, 10%, 88%)",
};

const SEASON_COLORS: Record<string, string> = {
  Winter: "hsl(190, 80%, 50%)",
  Spring: "hsl(152, 76%, 48%)",
  Summer: "hsl(38, 92%, 60%)",
  Fall: "hsl(0, 72%, 55%)",
};

function getSeason(dateStr: string): string {
  const month = new Date(dateStr).getMonth();
  if (month <= 1 || month === 11) return "Winter";
  if (month <= 4) return "Spring";
  if (month <= 7) return "Summer";
  return "Fall";
}

const SeasonalScatterChart = () => {
  const { data } = useDataContext();

  const { seasonData, regression, rSquared, activeSeasons } = useMemo(() => {
    if (!data) return { seasonData: { Winter: [], Spring: [], Summer: [], Fall: [] }, regression: [], rSquared: 0, activeSeasons: [] as string[] };
    const points = data.dailyData
      .filter((d) => d.avgTemperature !== 0 && d.totalKwh > 0)
      .map((d) => ({
        temperature: d.avgTemperature,
        electricity: d.totalKwh,
        season: getSeason(d.date),
        label: d.label,
      }));

    // Group by season
    const grouped: Record<string, typeof points> = { Winter: [], Spring: [], Summer: [], Fall: [] };
    for (const p of points) {
      grouped[p.season]?.push(p);
    }

    // Linear regression
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (const p of points) {
      sumX += p.temperature;
      sumY += p.electricity;
      sumXY += p.temperature * p.electricity;
      sumX2 += p.temperature * p.temperature;
      sumY2 += p.electricity * p.electricity;
    }
    const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
    const intercept = n > 0 ? (sumY - slope * sumX) / n : 0;
    const r = data.summaryMetrics.weatherCorrelation;
    const r2 = Math.round(r * r * 1000) / 10;

    const temps = points.map((p) => p.temperature);
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    const regressionLine = [
      { temperature: minT, electricity: slope * minT + intercept, season: "Regression" },
      { temperature: maxT, electricity: slope * maxT + intercept, season: "Regression" },
    ];

    const activeSeasons = Object.keys(grouped).filter((s) => grouped[s].length > 0);

    return { seasonData: grouped, regression: regressionLine, rSquared: r2, activeSeasons };
  }, [data]);

  if (!data) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "600ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Temperature Explains Only {rSquared}% of Electricity Variation
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Each dot = one day, colored by season — internal loads dominate over weather sensitivity
        </p>
      </div>
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 15, left: 10, bottom: 35 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            <XAxis
              type="number"
              dataKey="temperature"
              name="Temperature"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              label={{ value: "Temperature (°F)", position: "bottom", fontSize: 10, fill: "hsl(220, 10%, 50%)", offset: 0 }}
            />
            <YAxis
              type="number"
              dataKey="electricity"
              name="Electricity"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                return String(v);
              }}
              width={55}
              label={{ value: "Daily Electricity (kWh)", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(220, 10%, 50%)", dx: -15 }}
            />
            <ZAxis range={[30, 30]} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                name === "Temperature" ? `${value}°F` : `${value.toLocaleString()} kWh`,
                name,
              ]}
              labelFormatter={(_label: any, payload: any) => {
                const p = payload?.[0]?.payload;
                return p ? `${p.label} (${p.season})` : "";
              }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ fontSize: "10px", paddingTop: "12px" }}
              iconType="circle"
              iconSize={8}
            />
            {activeSeasons.map((season) => (
              <Scatter
                key={season}
                name={season}
                data={seasonData[season]}
                fill={SEASON_COLORS[season]}
                fillOpacity={0.7}
              />
            ))}
            {/* Regression line */}
            <Scatter
              name={`R² = ${rSquared}%`}
              data={regression}
              fill="transparent"
              line={{ stroke: "hsl(220, 10%, 60%)", strokeDasharray: "6 3", strokeWidth: 2 }}
              legendType="line"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-right">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] text-muted-foreground">
          r = {data.summaryMetrics.weatherCorrelation} · R² = {rSquared}%
        </span>
      </div>
    </div>
  );
};

export default SeasonalScatterChart;
