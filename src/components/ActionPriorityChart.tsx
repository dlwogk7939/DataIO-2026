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
  ReferenceLine,
  Label,
} from "recharts";
import { Target } from "lucide-react";
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

const ActionPriorityChart = () => {
  const { data } = useDataContext();

  const { scatterData, medianIntensity, medianKwh, maxArea } = useMemo(() => {
    if (!data) return { scatterData: [], medianIntensity: 0, medianKwh: 0, maxArea: 0 };
    const filtered = data.buildingConsumption.filter(
      (b) => b.intensityKwhPerSqft > 0 && b.totalMonthlyKwh > 0 && b.sqft > 0
    );

    const intensities = filtered.map((b) => b.intensityKwhPerSqft).sort((a, b) => a - b);
    const mwhs = filtered.map((b) => b.totalMonthlyKwh).sort((a, b) => a - b);
    const medInt = intensities.length > 0 ? intensities[Math.floor(intensities.length / 2)] : 0;
    const medMwh = mwhs.length > 0 ? mwhs[Math.floor(mwhs.length / 2)] : 0;
    const maxA = Math.max(...filtered.map((b) => b.sqft));

    // Take top 50 by total consumption for readability
    const top50 = [...filtered]
      .sort((a, b) => b.totalMonthlyKwh - a.totalMonthlyKwh)
      .slice(0, 50)
      .map((b) => {
        const isHighImpact = b.totalMonthlyKwh >= medMwh;
        const isHighInefficiency = b.intensityKwhPerSqft >= medInt;
        let quadrant = "";
        if (isHighImpact && isHighInefficiency) quadrant = "Immediate Action";
        else if (isHighImpact) quadrant = "Monitor";
        else if (isHighInefficiency) quadrant = "Targeted Fix";
        else quadrant = "Efficient";

        return {
          name: b.name,
          type: b.type,
          intensity: b.intensityKwhPerSqft,
          totalMwh: Math.round(b.totalMonthlyKwh / 1000),
          totalKwh: b.totalMonthlyKwh,
          sqft: b.sqft,
          quadrant,
        };
      });

    return {
      scatterData: top50,
      medianIntensity: Math.round(medInt * 100) / 100,
      medianKwh: medMwh,
      maxArea: maxA,
    };
  }, [data]);

  if (!data || scatterData.length === 0) return null;

  const immediateActions = scatterData.filter((b) => b.quadrant === "Immediate Action");

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "900ms" }}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Target className="h-4 w-4 text-energy-red" />
            Where Should OSU Act First?
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Impact (total MWh) vs inefficiency (kWh/sqft) — bubble size = building area
          </p>
        </div>
      </div>

      <div className="relative h-[400px]">
        {/* Quadrant labels */}
        <div className="absolute top-2 left-20 text-[9px] text-muted-foreground/60 font-medium z-10">
          High Impact · Efficient
        </div>
        <div className="absolute top-2 right-12 text-[9px] text-energy-red font-semibold z-10">
          ⚠ IMMEDIATE ACTION
        </div>
        <div className="absolute bottom-12 left-20 text-[9px] text-primary/60 font-medium z-10">
          Low Priority
        </div>
        <div className="absolute bottom-12 right-12 text-[9px] text-energy-amber font-medium z-10">
          Targeted Fixes
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
            <XAxis
              type="number"
              dataKey="intensity"
              name="Intensity"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              label={{ value: "kWh / sqft (Inefficiency →)", position: "bottom", fontSize: 10, fill: "hsl(220, 10%, 50%)", offset: -2 }}
            />
            <YAxis
              type="number"
              dataKey="totalMwh"
              name="Total MWh"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              label={{ value: "Total MWh (Impact →)", angle: -90, position: "insideLeft", fontSize: 10, fill: "hsl(220, 10%, 50%)", offset: 10 }}
            />
            <ZAxis
              type="number"
              dataKey="sqft"
              range={[40, 400]}
              name="Area"
            />
            <ReferenceLine
              x={medianIntensity}
              stroke="hsl(220, 10%, 30%)"
              strokeDasharray="6 3"
              strokeWidth={1.5}
            >
              <Label
                value={`Median: ${medianIntensity}`}
                position="top"
                fontSize={9}
                fill="hsl(220, 10%, 40%)"
              />
            </ReferenceLine>
            <ReferenceLine
              y={Math.round(medianKwh / 1000)}
              stroke="hsl(220, 10%, 30%)"
              strokeDasharray="6 3"
              strokeWidth={1.5}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div style={TOOLTIP_STYLE} className="p-2.5 rounded-lg">
                    <p className="font-semibold text-[12px] mb-1" style={{ color: "hsl(160, 10%, 88%)" }}>
                      {d.name}
                    </p>
                    <p className="text-[11px]" style={{ color: "hsl(220, 10%, 60%)" }}>Type: {d.type}</p>
                    <p className="text-[11px]" style={{ color: "hsl(220, 10%, 60%)" }}>
                      Total: {d.totalMwh.toLocaleString()} MWh
                    </p>
                    <p className="text-[11px]" style={{ color: "hsl(220, 10%, 60%)" }}>
                      Intensity: {d.intensity} kWh/sqft
                    </p>
                    <p className="text-[11px]" style={{ color: "hsl(220, 10%, 60%)" }}>
                      Area: {d.sqft.toLocaleString()} sqft
                    </p>
                    <p
                      className="text-[11px] font-semibold mt-1"
                      style={{
                        color:
                          d.quadrant === "Immediate Action"
                            ? "hsl(0, 72%, 55%)"
                            : d.quadrant === "Targeted Fix"
                              ? "hsl(38, 92%, 60%)"
                              : d.quadrant === "Monitor"
                                ? "hsl(190, 80%, 50%)"
                                : "hsl(152, 76%, 48%)",
                      }}
                    >
                      → {d.quadrant}
                    </p>
                  </div>
                );
              }}
            />
            <Scatter data={scatterData}>
              {scatterData.map((entry, i) => (
                <circle
                  key={i}
                  fill={TYPE_COLORS[entry.type] || "hsl(220, 16%, 28%)"}
                  fillOpacity={entry.quadrant === "Immediate Action" ? 0.9 : 0.5}
                  stroke={entry.quadrant === "Immediate Action" ? "hsl(0, 72%, 65%)" : "transparent"}
                  strokeWidth={entry.quadrant === "Immediate Action" ? 2 : 0}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Immediate Action buildings list */}
      {immediateActions.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-energy-red mb-2">
            ⚠ Immediate Action Required ({immediateActions.length} buildings)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
            {immediateActions.slice(0, 9).map((b, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 truncate">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: TYPE_COLORS[b.type] || "hsl(220, 16%, 28%)" }}
                  />
                  <span className="text-foreground truncate">{b.name}</span>
                </span>
                <span className="font-mono text-muted-foreground shrink-0 ml-1 text-[10px]">
                  {b.totalMwh} MWh
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <span className="text-muted-foreground/60 ml-auto">Bubble size = building area (sqft)</span>
      </div>
    </div>
  );
};

export default ActionPriorityChart;
