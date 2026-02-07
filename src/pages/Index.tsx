import { Zap, Activity } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import EnergyTimeSeriesChart from "@/components/EnergyTimeSeriesChart";
import TopBuildingsChart from "@/components/TopBuildingsChart";
import TemperatureScatterChart from "@/components/TemperatureScatterChart";
import EnergyIntensityChart from "@/components/EnergyIntensityChart";
import DailyEnergyWeatherChart from "@/components/DailyEnergyWeatherChart";
import InsightsPanel from "@/components/InsightsPanel";
import { summaryMetrics } from "@/data/mockData";

const Index = () => {
  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-primary/10 p-1.5 glow-green">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                DATA<span className="text-gradient-green">IO</span>
              </span>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:inline-block">
              Campus Energy Analytics
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1">
              <Activity className="h-3 w-3 text-primary animate-pulse-slow" />
              <span className="font-mono text-xs text-primary">LIVE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        {/* Title Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Energy Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Smart meter analytics for {summaryMetrics.buildingsMonitored} campus buildings · January 2025
          </p>
        </div>

        {/* KPI Metrics */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total Consumption"
            value={summaryMetrics.totalMonthlyMwh.toLocaleString()}
            unit="MWh"
            icon="zap"
            trend="Monthly aggregate"
            delay={0}
          />
          <MetricCard
            label="Buildings Monitored"
            value={summaryMetrics.buildingsMonitored}
            icon="building"
            trend="All campus facilities"
            delay={100}
          />
          <MetricCard
            label="Avg. Intensity"
            value={summaryMetrics.avgIntensity}
            unit="kWh/sqft"
            icon="gauge"
            trend="Normalized metric"
            delay={200}
          />
          <MetricCard
            label="Peak Demand"
            value={summaryMetrics.peakDemandKw.toLocaleString()}
            unit="kW"
            icon="thermometer"
            trend="Hourly maximum"
            delay={300}
          />
        </div>

        {/* Chart Grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Full width time series */}
          <div className="lg:col-span-2">
            <EnergyTimeSeriesChart />
          </div>

          {/* Row 2: Top buildings + Scatter */}
          <TopBuildingsChart />
          <TemperatureScatterChart />

          {/* Row 3: Intensity + Daily overlay */}
          <EnergyIntensityChart />
          <DailyEnergyWeatherChart />

          {/* Full width insights */}
          <div className="lg:col-span-2">
            <InsightsPanel />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 border-t border-border pt-4 pb-6">
          <div className="flex flex-col items-center justify-between gap-2 text-[11px] text-muted-foreground sm:flex-row">
            <p>
              DATAIO · Campus Energy Analytics for Efficiency & Sustainability
            </p>
            <p className="font-mono">
              Data period: Jan 1 – Jan 30, 2025
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
