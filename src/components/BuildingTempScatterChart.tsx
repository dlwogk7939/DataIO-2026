import { useState, useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
} from "recharts";
import { useDataContext } from "@/contexts/DataContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const BuildingTempScatterChart = () => {
  const { data } = useDataContext();
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");

  const buildingNames = useMemo(() => {
    if (!data) return [];
    const names = [...new Set(data.buildingWeatherData.map((d) => d.buildingName))].sort();
    return names;
  }, [data]);

  // Default to Thompson Library or first building
  const activeBuilding = useMemo(() => {
    if (selectedBuilding) return selectedBuilding;
    const thompson = buildingNames.find((n) => n.toLowerCase().includes("thompson"));
    return thompson || buildingNames[0] || "";
  }, [selectedBuilding, buildingNames]);

  const scatterData = useMemo(() => {
    if (!data || !activeBuilding) return [];
    return data.buildingWeatherData
      .filter((d) => d.buildingName === activeBuilding && d.temperature !== 0)
      .map((d) => ({ temperature: d.temperature, electricity: d.electricity }));
  }, [data, activeBuilding]);

  // Simple linear trend line
  const trendLine = useMemo(() => {
    if (scatterData.length < 3) return [];
    const n = scatterData.length;
    const meanX = scatterData.reduce((s, d) => s + d.temperature, 0) / n;
    const meanY = scatterData.reduce((s, d) => s + d.electricity, 0) / n;
    let num = 0, den = 0;
    for (const d of scatterData) {
      num += (d.temperature - meanX) * (d.electricity - meanY);
      den += (d.temperature - meanX) ** 2;
    }
    const slope = den > 0 ? num / den : 0;
    const intercept = meanY - slope * meanX;
    const temps = scatterData.map((d) => d.temperature);
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    return [
      { temperature: minT, electricity: Math.round(intercept + slope * minT) },
      { temperature: maxT, electricity: Math.round(intercept + slope * maxT) },
    ];
  }, [scatterData]);

  if (!data || buildingNames.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "1000ms" }}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Temperature vs Electricity Usage (Building-Level)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Direct weather sensitivity of electricity demand per building
          </p>
        </div>
        <Select value={activeBuilding} onValueChange={setSelectedBuilding}>
          <SelectTrigger className="w-[220px] h-8 text-xs bg-background">
            <SelectValue placeholder="Select building" />
          </SelectTrigger>
          <SelectContent>
            {buildingNames.map((name) => (
              <SelectItem key={name} value={name} className="text-xs">
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-[320px]">
        {scatterData.length < 3 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground">Not enough data for {activeBuilding}.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 15, left: 15, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis
                dataKey="temperature"
                type="number"
                name="Temperature"
                tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
                label={{
                  value: "Temperature (°F)",
                  position: "bottom",
                  fontSize: 10,
                  fill: "hsl(220, 10%, 50%)",
                  offset: 5,
                }}
              />
              <YAxis
                dataKey="electricity"
                type="number"
                name="Electricity"
                tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
                tickLine={false}
                axisLine={false}
                width={55}
                tickFormatter={formatCompact}
                label={{
                  value: "Electricity (kWh)",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 10,
                  fill: "hsl(220, 10%, 50%)",
                  dx: -15,
                }}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [
                  `${value.toLocaleString()} ${name === "Temperature" ? "°F" : "kWh"}`,
                  name,
                ]}
              />
              <Scatter
                data={scatterData}
                fill="hsl(152, 76%, 48%)"
                fillOpacity={0.5}
                r={3}
              />
              <Scatter
                data={trendLine}
                fill="none"
                line={{ stroke: "hsl(38, 92%, 60%)", strokeWidth: 2, strokeDasharray: "6 3" }}
                shape={() => null}
                legendType="none"
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default BuildingTempScatterChart;
