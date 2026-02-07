// ── Public types used across the application ─────────────────────────────────

export interface Building {
  id: string;
  name: string;
  sqft: number;
  type: string;
}

export interface HourlyEntry {
  timestamp: string;
  hour: number;
  day: number;
  totalKwh: number;
  temperature: number;
  buildingId?: string;
}

export interface DailyEntry {
  date: string;
  label: string;
  totalKwh: number;
  avgTemperature: number;
  avgPrecipitation: number;
  avgWindSpeed: number;
}

export interface BuildingConsumption extends Building {
  avgHourlyKwh: number;
  totalMonthlyKwh: number;
  intensityKwhPerSqft: number;
}

export interface TempVsElectricity {
  temperature: number;
  electricity: number;
  date: string;
}

export interface SummaryMetrics {
  totalMonthlyMwh: number;
  buildingsMonitored: number;
  avgIntensity: number;
  peakDemandKw: number;
  weatherCorrelation: number;
}

export interface BuildingMoMChange {
  name: string;
  prevMonthKwh: number;
  currMonthKwh: number;
  changeKwh: number;
  changePct: number;
  prevMonthLabel: string;
  currMonthLabel: string;
}

export interface BuildingPrediction {
  name: string;
  lastMonthKwh: number;
  predictedKwh: number;
  avgMoMChangePct: number;
  predictedMonthLabel: string;
}

export interface BuildingMonthlyKwh {
  name: string;
  monthKey: string;
  monthLabel: string;
  kwh: number;
}

export interface UtilityMonthlyEntry {
  utility: string;
  monthKey: string;
  monthLabel: string;
  totalUsage: number;
  unit: string;
}

export interface BuildingWeatherEntry {
  buildingName: string;
  temperature: number;
  precipitation: number;
  windSpeed: number;
  electricity: number;
  date: string;
}

export interface WeatherModelResult {
  coefficients: {
    temperature: number;
    precipitation: number;
    windSpeed: number;
    intercept: number;
  };
  featureImportance: { feature: string; importance: number; absCoeff: number }[];
  predictions: {
    actual: number;
    predicted: number;
    temperature: number;
    precipitation: number;
    windSpeed: number;
  }[];
  r2: number;
  marginalEffect: { temperature: number; predicted: number }[];
  scenarioComparison: { label: string; temperature: number; predicted: number }[];
  heatmapData: { temperature: number; windSpeed: number; predicted: number }[];
}

export interface ParsedData {
  buildings: Building[];
  hourlyData: HourlyEntry[];
  dailyData: DailyEntry[];
  buildingConsumption: BuildingConsumption[];
  tempVsElectricity: TempVsElectricity[];
  summaryMetrics: SummaryMetrics;
  buildingMoMChanges: BuildingMoMChange[];
  buildingPredictions: BuildingPrediction[];
  buildingMonthlyData: BuildingMonthlyKwh[];
  utilityMonthlyData: UtilityMonthlyEntry[];
  availableUtilities: string[];
  buildingWeatherData: BuildingWeatherEntry[];
  weatherModel: WeatherModelResult | null;
}
