import { buildingConsumption } from "@/data/mockData";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const sortedByIntensity = [...buildingConsumption].sort(
  (a, b) => b.intensityKwhPerSqft - a.intensityKwhPerSqft
);

const avgIntensity =
  sortedByIntensity.reduce((s, b) => s + b.intensityKwhPerSqft, 0) /
  sortedByIntensity.length;

const InsightsPanel = () => (
  <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: "900ms" }}>
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-foreground">Key Insights & Recommendations</h3>
      <p className="text-xs text-muted-foreground mt-1">
        Data-driven findings aligned to campus sustainability goals
      </p>
    </div>

    <div className="space-y-3">
      <InsightItem
        type="critical"
        title="Data Center leads intensity at 14.9 kWh/sqft"
        description="Despite being one of the smallest buildings, the Data Center has 3× average energy intensity. Prioritize cooling optimization and virtualization."
      />
      <InsightItem
        type="warning"
        title="Weather explains only 34% of demand variation"
        description="Internal loads (labs, IT, lighting) are the dominant drivers. HVAC optimization alone won't solve inefficiency."
      />
      <InsightItem
        type="success"
        title="Top 3 buildings account for 45% of total usage"
        description="Targeted retrofits on Engineering Hall, Data Center, and Medical Research will yield the highest ROI."
      />
      <InsightItem
        type="info"
        title="Use kWh/sqft for benchmarking, not raw kWh"
        description="Raw consumption masks true efficiency. Normalized metrics reveal that Dormitory A and Admin Building are the most efficient."
      />
    </div>

    <div className="mt-5 rounded-md border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs font-medium text-primary">
        → Recommended next steps
      </p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        <li className="flex items-start gap-1.5">
          <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-energy-amber" />
          Commission energy audit for top 3 intensity buildings
        </li>
        <li className="flex items-start gap-1.5">
          <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-energy-amber" />
          Deploy sub-metering in Data Center for granular analysis
        </li>
        <li className="flex items-start gap-1.5">
          <ArrowDownRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          Establish kWh/sqft benchmarks for ongoing monitoring
        </li>
      </ul>
    </div>
  </div>
);

function InsightItem({
  type,
  title,
  description,
}: {
  type: "critical" | "warning" | "success" | "info";
  title: string;
  description: string;
}) {
  const colors = {
    critical: "border-energy-red/30 bg-energy-red/5",
    warning: "border-energy-amber/30 bg-energy-amber/5",
    success: "border-primary/30 bg-primary/5",
    info: "border-energy-cyan/30 bg-energy-cyan/5",
  };

  const dotColors = {
    critical: "bg-energy-red",
    warning: "bg-energy-amber",
    success: "bg-primary",
    info: "bg-energy-cyan",
  };

  return (
    <div className={`rounded-md border p-3 ${colors[type]}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotColors[type]}`} />
        <div>
          <p className="text-xs font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default InsightsPanel;
