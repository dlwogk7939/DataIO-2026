import { Zap, Building2, Gauge, Thermometer } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: "zap" | "building" | "gauge" | "thermometer";
  trend?: string;
  delay?: number;
}

const iconMap = {
  zap: Zap,
  building: Building2,
  gauge: Gauge,
  thermometer: Thermometer,
};

const MetricCard = ({ label, value, unit, icon, trend, delay = 0 }: MetricCardProps) => {
  const Icon = iconMap[icon];

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-border bg-card p-5 glow-border animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-bold text-foreground animate-counter-up" style={{ animationDelay: `${delay + 200}ms` }}>
              {value}
            </span>
            {unit && (
              <span className="text-sm font-medium text-muted-foreground">{unit}</span>
            )}
          </div>
          {trend && (
            <p className="text-xs text-primary">{trend}</p>
          )}
        </div>
        <div className="rounded-md bg-primary/10 p-2.5">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      {/* Ambient glow */}
      <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
    </div>
  );
};

export default MetricCard;
