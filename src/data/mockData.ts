// Building metadata
export interface Building {
  id: string;
  name: string;
  sqft: number;
  type: string;
}

export const buildings: Building[] = [
  { id: "B001", name: "Engineering Hall", sqft: 125000, type: "Academic" },
  { id: "B002", name: "Science Center", sqft: 98000, type: "Research" },
  { id: "B003", name: "Data Center", sqft: 28000, type: "IT Infrastructure" },
  { id: "B004", name: "Student Union", sqft: 85000, type: "Mixed Use" },
  { id: "B005", name: "Medical Research", sqft: 110000, type: "Research" },
  { id: "B006", name: "Library", sqft: 72000, type: "Academic" },
  { id: "B007", name: "Athletics Complex", sqft: 145000, type: "Athletics" },
  { id: "B008", name: "Dormitory A", sqft: 60000, type: "Residential" },
  { id: "B009", name: "Admin Building", sqft: 42000, type: "Administrative" },
  { id: "B010", name: "Arts & Media", sqft: 55000, type: "Academic" },
  { id: "B011", name: "Chemistry Lab", sqft: 38000, type: "Research" },
  { id: "B012", name: "Dining Hall", sqft: 32000, type: "Food Service" },
];

// Seed-based pseudo-random number generator for consistency
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

const rand = seededRandom(42);

// Generate hourly data for 30 days
function generateHourlyData() {
  const data: { timestamp: string; hour: number; day: number; totalKwh: number; temperature: number }[] = [];
  const startDate = new Date(2025, 0, 1); // Jan 1, 2025

  for (let day = 0; day < 30; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      date.setHours(hour);

      // Temperature curve: cold in Jan, varies by hour
      const baseTempF = 32 + 10 * Math.sin((day / 30) * Math.PI) + 8 * Math.sin(((hour - 6) / 24) * 2 * Math.PI);
      const temperature = baseTempF + (rand() - 0.5) * 10;

      // Electricity demand: base load + time-of-day pattern + weather sensitivity + noise
      const baseLoad = 1200;
      const timeOfDayFactor = hour >= 8 && hour <= 20
        ? 800 + 400 * Math.sin(((hour - 8) / 12) * Math.PI)
        : 200;
      const weatherFactor = temperature < 35 ? (35 - temperature) * 15 : temperature > 70 ? (temperature - 70) * 20 : 0;
      const noise = (rand() - 0.5) * 300;
      const totalKwh = Math.max(400, baseLoad + timeOfDayFactor + weatherFactor + noise);

      data.push({
        timestamp: date.toISOString(),
        hour,
        day,
        totalKwh: Math.round(totalKwh),
        temperature: Math.round(temperature * 10) / 10,
      });
    }
  }
  return data;
}

export const hourlyData = generateHourlyData();

// Daily aggregation
export const dailyData = Array.from({ length: 30 }, (_, day) => {
  const dayEntries = hourlyData.filter(d => d.day === day);
  const totalKwh = dayEntries.reduce((sum, d) => sum + d.totalKwh, 0);
  const avgTemp = dayEntries.reduce((sum, d) => sum + d.temperature, 0) / dayEntries.length;
  const date = new Date(2025, 0, 1);
  date.setDate(date.getDate() + day);
  return {
    date: date.toISOString().split("T")[0],
    label: `Jan ${day + 1}`,
    totalKwh: Math.round(totalKwh),
    avgTemperature: Math.round(avgTemp * 10) / 10,
  };
});

// Per-building consumption data (average hourly kWh)
const buildingConsumptionRaw: Record<string, number> = {
  B001: 320,
  B002: 280,
  B003: 580, // Data center - high per sqft
  B004: 190,
  B005: 310,
  B006: 120,
  B007: 240,
  B008: 95,
  B009: 70,
  B010: 110,
  B011: 250,
  B012: 85,
};

export const buildingConsumption = buildings.map(b => {
  const avgKwh = buildingConsumptionRaw[b.id] || 100;
  const intensity = (avgKwh * 24 * 30) / b.sqft; // monthly kWh/sqft
  return {
    ...b,
    avgHourlyKwh: avgKwh,
    totalMonthlyKwh: avgKwh * 24 * 30,
    intensityKwhPerSqft: Math.round(intensity * 100) / 100,
  };
});

// Temperature vs electricity scatter data (sampled daily)
export const tempVsElectricity = dailyData.map(d => ({
  temperature: d.avgTemperature,
  electricity: d.totalKwh,
  date: d.label,
}));

// Summary metrics
export const summaryMetrics = {
  totalMonthlyMwh: Math.round(dailyData.reduce((s, d) => s + d.totalKwh, 0) / 1000),
  buildingsMonitored: buildings.length,
  avgIntensity: Math.round(
    buildingConsumption.reduce((s, b) => s + b.intensityKwhPerSqft, 0) /
    buildingConsumption.length * 100
  ) / 100,
  peakDemandKw: Math.max(...hourlyData.map(d => d.totalKwh)),
  weatherCorrelation: 0.34,
};
