import { useMemo } from "react";
import { useDataContext } from "@/contexts/DataContext";

function formatCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(v % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
}

function interpolateColor(t: number): string {
  // Dark theme gradient: deep blue → green → amber → red
  if (t < 0.33) {
    const p = t / 0.33;
    const h = 210 + (152 - 210) * p;
    const s = 60 + (76 - 60) * p;
    const l = 30 + (40 - 30) * p;
    return `hsl(${h}, ${s}%, ${l}%)`;
  } else if (t < 0.66) {
    const p = (t - 0.33) / 0.33;
    const h = 152 + (38 - 152) * p;
    const s = 76 + (92 - 76) * p;
    const l = 40 + (50 - 40) * p;
    return `hsl(${h}, ${s}%, ${l}%)`;
  } else {
    const p = (t - 0.66) / 0.34;
    const h = 38 + (0 - 38) * p;
    const s = 92 + (72 - 92) * p;
    const l = 50 + (45 - 50) * p;
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
}

const WeatherHeatmapChart = () => {
  const { data } = useDataContext();

  const { grid, temps, winds, minPred, maxPred } = useMemo(() => {
    if (!data?.weatherModel) return { grid: [], temps: [], winds: [], minPred: 0, maxPred: 1 };

    const hd = data.weatherModel.heatmapData;
    const tempSet = [...new Set(hd.map((d) => d.temperature))].sort((a, b) => a - b);
    const windSet = [...new Set(hd.map((d) => d.windSpeed))].sort((a, b) => a - b);
    const minP = Math.min(...hd.map((d) => d.predicted));
    const maxP = Math.max(...hd.map((d) => d.predicted));

    // Build grid as a lookup
    const lookup = new Map<string, number>();
    for (const d of hd) {
      lookup.set(`${d.temperature}|${d.windSpeed}`, d.predicted);
    }

    return {
      grid: hd,
      temps: tempSet,
      winds: windSet,
      minPred: minP,
      maxPred: maxP,
    };
  }, [data]);

  if (!data?.weatherModel || grid.length === 0) return null;

  // Build a lookup for quick access
  const lookup = new Map<string, number>();
  for (const d of grid) {
    lookup.set(`${d.temperature}|${d.windSpeed}`, d.predicted);
  }

  const range = maxPred - minPred || 1;
  const cellW = Math.max(28, Math.min(50, Math.floor(700 / temps.length)));
  const cellH = Math.max(24, Math.min(40, Math.floor(300 / winds.length)));

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "1600ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Weather Sensitivity Heatmap
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Predicted electricity at varying temperature × wind speed — reveals interaction effects
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Y-axis label */}
          <div className="flex items-start">
            <div className="flex flex-col items-end pr-2" style={{ width: 80 }}>
              <span className="text-[10px] text-muted-foreground mb-1 font-medium">Wind (m/s)</span>
              {[...winds].reverse().map((w) => (
                <div
                  key={w}
                  className="flex items-center justify-end text-[10px] text-muted-foreground font-mono"
                  style={{ height: cellH }}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div>
              <div className="flex flex-col">
                {[...winds].reverse().map((w) => (
                  <div key={w} className="flex">
                    {temps.map((t) => {
                      const val = lookup.get(`${t}|${w}`) ?? 0;
                      const normalized = (val - minPred) / range;
                      const color = interpolateColor(normalized);
                      return (
                        <div
                          key={`${t}-${w}`}
                          className="border border-background/30 flex items-center justify-center group relative cursor-default"
                          style={{
                            width: cellW,
                            height: cellH,
                            backgroundColor: color,
                          }}
                          title={`Temp: ${t}°F, Wind: ${w} m/s → ${val.toLocaleString()} kWh`}
                        >
                          <span className="text-[8px] font-mono text-white/70 group-hover:text-white transition-colors">
                            {formatCompact(val)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* X-axis labels */}
              <div className="flex mt-1">
                {temps.map((t) => (
                  <div
                    key={t}
                    className="text-[10px] text-muted-foreground font-mono text-center"
                    style={{ width: cellW }}
                  >
                    {t}°
                  </div>
                ))}
              </div>
              <div className="text-center text-[10px] text-muted-foreground mt-1 font-medium">
                Temperature (°F)
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 justify-center">
            <span className="text-[10px] text-muted-foreground font-mono">{formatCompact(minPred)}</span>
            <div
              className="h-3 rounded-sm"
              style={{
                width: 120,
                background: `linear-gradient(to right, ${interpolateColor(0)}, ${interpolateColor(0.33)}, ${interpolateColor(0.66)}, ${interpolateColor(1)})`,
              }}
            />
            <span className="text-[10px] text-muted-foreground font-mono">{formatCompact(maxPred)}</span>
            <span className="text-[10px] text-muted-foreground ml-1">kWh</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherHeatmapChart;
