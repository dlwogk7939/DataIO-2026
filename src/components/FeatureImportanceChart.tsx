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

const FEATURE_COLORS: Record<string, string> = {
  Temperature: "hsl(0, 72%, 55%)",
  "Wind Speed": "hsl(190, 80%, 50%)",
  Precipitation: "hsl(38, 92%, 60%)",
};

const FeatureImportanceChart = () => {
  const { data } = useDataContext();

  if (!data?.weatherModel) return null;

  const { featureImportance, r2 } = data.weatherModel;

  return (
    <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "1300ms" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Feature Importance — Which Variables Drive Predictions?
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Relative influence of weather variables on electricity demand (model R² = {(r2 * 100).toFixed(1)}%)
        </p>
      </div>

      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={featureImportance} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(220, 14%, 18%)" }}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              label={{ value: "Relative Importance (%)", position: "bottom", fontSize: 10, fill: "hsl(220, 10%, 50%)", offset: -2 }}
            />
            <YAxis
              type="category"
              dataKey="feature"
              tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Importance"]}
            />
            <Bar dataKey="importance" radius={[0, 4, 4, 0]} barSize={20}>
              {featureImportance.map((entry, i) => (
                <Cell key={i} fill={FEATURE_COLORS[entry.feature] || "hsl(152, 76%, 48%)"} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 rounded-md border border-border bg-background p-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Interpretation:</span>{" "}
          {featureImportance[0]?.feature} is the dominant predictor of electricity usage, explaining{" "}
          <span className="font-mono text-primary">{featureImportance[0]?.importance.toFixed(1)}%</span>{" "}
          of the model's variation. The overall model captures{" "}
          <span className="font-mono text-primary">{(r2 * 100).toFixed(1)}%</span> of demand variation through weather alone.
        </p>
      </div>
    </div>
  );
};

export default FeatureImportanceChart;
