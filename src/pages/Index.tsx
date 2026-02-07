import { Zap, Activity, RotateCcw } from "lucide-react";
import { useDataContext } from "@/contexts/DataContext";
import CsvUploader from "@/components/CsvUploader";
import MetricCard from "@/components/MetricCard";
import UtilityTimeChart from "@/components/UtilityTimeChart";
import IntensityByTypeChart from "@/components/IntensityByTypeChart";
import SeasonalScatterChart from "@/components/SeasonalScatterChart";
import MonthlyTrendChart from "@/components/MonthlyTrendChart";
import MoMPercentChart from "@/components/MoMPercentChart";
import ForecastBaselineChart from "@/components/ForecastBaselineChart";
import WeatherElectricityChart from "@/components/WeatherElectricityChart";
import InsightsPanel from "@/components/InsightsPanel";
import BuildingTempScatterChart from "@/components/BuildingTempScatterChart";
import MarginalEffectChart from "@/components/MarginalEffectChart";
import BuildingDistributionChart from "@/components/BuildingDistributionChart";
import FeatureImportanceChart from "@/components/FeatureImportanceChart";
import PredictedVsActualChart from "@/components/PredictedVsActualChart";
import ScenarioComparisonChart from "@/components/ScenarioComparisonChart";
import WeatherHeatmapChart from "@/components/WeatherHeatmapChart";

const Index = () => {
  const { data, reset } = useDataContext();

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
            {data && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                New Data
              </button>
            )}
            <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1">
              <Activity className="h-3 w-3 text-primary animate-pulse-slow" />
              <span className="font-mono text-xs text-primary">{data ? "LIVE" : "AWAITING DATA"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        {!data ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <CsvUploader />
          </div>
        ) : (
          <>
            {/* Title Section */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Energy Analytics Dashboard
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Insight-first analysis of {data.summaryMetrics.buildingsMonitored} campus buildings — identifying inefficiencies, trends, and action priorities
              </p>
            </div>

            {/* KPI Metrics */}
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label="Total Consumption"
                value={data.summaryMetrics.totalMonthlyMwh.toLocaleString()}
                unit="MWh"
                icon="zap"
                trend="Aggregate total"
                delay={0}
              />
              <MetricCard
                label="Buildings Monitored"
                value={data.summaryMetrics.buildingsMonitored}
                icon="building"
                trend="All campus facilities"
                delay={100}
              />
              <MetricCard
                label="Avg. Intensity"
                value={data.summaryMetrics.avgIntensity}
                unit="kWh/sqft"
                icon="gauge"
                trend="Normalized metric"
                delay={200}
              />
              <MetricCard
                label="Peak Demand"
                value={data.summaryMetrics.peakDemandKw.toLocaleString()}
                unit="kW"
                icon="thermometer"
                trend="Hourly maximum"
                delay={300}
              />
            </div>

            {/* Chart Grid — Insight-first layout */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* 1. Utility vs Time — full width */}
              <div className="lg:col-span-2">
                <UtilityTimeChart />
              </div>

              {/* 2. Intensity by Type + Seasonal Scatter */}
              <IntensityByTypeChart />
              <SeasonalScatterChart />

              {/* 3. Monthly Trend + MoM % Change */}
              <MonthlyTrendChart />
              <MoMPercentChart />

              {/* 4. Forecast — full width */}
              <div className="lg:col-span-2">
                <ForecastBaselineChart />
              </div>

              {/* 5. Weather vs Electricity — full width */}
              <div className="lg:col-span-2">
                <WeatherElectricityChart />
              </div>

              {/* ── Methodology & Model-Driven Insights ── */}
              <div className="lg:col-span-2 mt-4">
                <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  Weather Sensitivity &amp; Model Analysis
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Methodology-driven visualizations — quantifying weather impact, model behavior, and what-if scenarios
                </p>
              </div>

              {/* 6. Building-level Temp vs Electricity + Marginal Effect */}
              <BuildingTempScatterChart />
              <MarginalEffectChart />

              {/* 7. Building Distribution — full width */}
              <div className="lg:col-span-2">
                <BuildingDistributionChart />
              </div>

              {/* 8. Feature Importance + Scenario Comparison */}
              <FeatureImportanceChart />
              <ScenarioComparisonChart />

              {/* 9. Predicted vs Actual — full width */}
              <div className="lg:col-span-2">
                <PredictedVsActualChart />
              </div>

              {/* 10. Weather Heatmap — full width */}
              <div className="lg:col-span-2">
                <WeatherHeatmapChart />
              </div>

              {/* 11. Insights Panel — full width */}
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
                  {data.dailyData.length > 0
                    ? `Data period: ${data.dailyData[0].label} – ${data.dailyData[data.dailyData.length - 1].label}`
                    : "No data period available"}
                </p>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
