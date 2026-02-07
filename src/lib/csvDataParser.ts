/**
 * CSV Data Parser
 *
 * Parses the five required CSV files and builds a unified ParsedData object
 * that all visualization components consume.
 *
 * Required files:
 *  1. meter_prememerge_selected.csv
 *  2. meter_building_merged.csv
 *  3. meter_building_weather_merged.csv
 *  4. building_metadata_selected.csv
 *  5. weather_daily_selected.csv
 */

import Papa from "papaparse";
import type {
  ParsedData,
  Building,
  HourlyEntry,
  DailyEntry,
  BuildingConsumption,
  TempVsElectricity,
  SummaryMetrics,
  BuildingMoMChange,
  BuildingPrediction,
} from "./csvParser";

// ── Required file definitions ──────────────────────────────────────────────

export const REQUIRED_FILES = [
  "meter_prememerge_selected.csv",
  "meter_building_merged.csv",
  "meter_building_weather_merged.csv",
  "building_metadata_selected.csv",
  "weather_daily_selected.csv",
] as const;

export type RequiredFileName = (typeof REQUIRED_FILES)[number];

export const FILE_KEYS: Record<RequiredFileName, string> = {
  "meter_prememerge_selected.csv": "meterPrememerge",
  "meter_building_merged.csv": "meterBuilding",
  "meter_building_weather_merged.csv": "meterBuildingWeather",
  "building_metadata_selected.csv": "buildingMetadata",
  "weather_daily_selected.csv": "weatherDaily",
};

export const FILE_DESCRIPTIONS: Record<RequiredFileName, string> = {
  "meter_prememerge_selected.csv": "Raw smart meter readings",
  "meter_building_merged.csv": "Meter data merged with building info",
  "meter_building_weather_merged.csv": "Meter + building + weather data",
  "building_metadata_selected.csv": "Building metadata (area, type)",
  "weather_daily_selected.csv": "Daily weather observations",
};

// ── CSV file info ──────────────────────────────────────────────────────────

export interface CsvFileInfo {
  fileName: string;
  rowCount: number;
  columns: string[];
  fileSizeBytes: number;
}

export interface AllCsvInfo {
  [key: string]: CsvFileInfo;
}

// ── Parsing helpers ────────────────────────────────────────────────────────

function parseCsvFile(file: File): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const columns = results.meta.fields ?? [];
        const rows = results.data as Record<string, unknown>[];
        resolve({ rows, columns });
      },
      error: (err: Error) => reject(err),
    });
  });
}

function toNum(val: unknown): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toStr(val: unknown): string {
  return val == null ? "" : String(val);
}

function toDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

// ── Main parse function ────────────────────────────────────────────────────

export interface ParseResult {
  data: ParsedData;
  info: AllCsvInfo;
}

export async function parseAllCsvFiles(
  files: Record<RequiredFileName, File>
): Promise<ParseResult> {
  // Parse all five files in parallel
  const [
    meterPremerge,
    meterBuilding,
    meterBuildingWeather,
    buildingMeta,
    weatherDaily,
  ] = await Promise.all([
    parseCsvFile(files["meter_prememerge_selected.csv"]),
    parseCsvFile(files["meter_building_merged.csv"]),
    parseCsvFile(files["meter_building_weather_merged.csv"]),
    parseCsvFile(files["building_metadata_selected.csv"]),
    parseCsvFile(files["weather_daily_selected.csv"]),
  ]);

  // Build info for debug panel
  const info: AllCsvInfo = {};
  const allParsed = [
    { key: "meterPrememerge", file: files["meter_prememerge_selected.csv"], parsed: meterPremerge },
    { key: "meterBuilding", file: files["meter_building_merged.csv"], parsed: meterBuilding },
    { key: "meterBuildingWeather", file: files["meter_building_weather_merged.csv"], parsed: meterBuildingWeather },
    { key: "buildingMetadata", file: files["building_metadata_selected.csv"], parsed: buildingMeta },
    { key: "weatherDaily", file: files["weather_daily_selected.csv"], parsed: weatherDaily },
  ];

  for (const { key, file, parsed } of allParsed) {
    info[key] = {
      fileName: file.name,
      rowCount: parsed.rows.length,
      columns: parsed.columns,
      fileSizeBytes: file.size,
    };
    console.log(
      `📊 ${file.name}: ${parsed.rows.length.toLocaleString()} rows, ${parsed.columns.length} columns [${parsed.columns.join(", ")}]`
    );
  }

  // ── Use meter_building_weather_merged as the primary data source ──
  // It should contain: readingtime, readingvalue, sitename, temperature_2m, grossarea, kwh_per_sqft, etc.
  const primaryRows = meterBuildingWeather.rows;

  // Also build a building metadata lookup from building_metadata_selected.csv
  const metaMap = new Map<string, { sqft: number; type: string }>();
  for (const row of buildingMeta.rows) {
    const name = toStr(row["sitename"] ?? row["SiteName"] ?? row["site_name"] ?? row["name"] ?? "");
    if (!name) continue;
    metaMap.set(name, {
      sqft: toNum(row["grossarea"] ?? row["GrossArea"] ?? row["gross_area"] ?? row["sqft"] ?? 0),
      type: toStr(row["building_type"] ?? row["BuildingType"] ?? row["type"] ?? "Building"),
    });
  }

  // Filter to electricity rows
  const elecRows = primaryRows.filter((r) => {
    const utility = toStr(r["utility"] ?? r["Utility"] ?? "");
    return !utility || utility.toLowerCase().includes("elec") || utility === "";
  });

  // ── Buildings ──
  const siteMap = new Map<string, { sqft: number; type: string; code: string }>();
  for (const r of elecRows) {
    const sitename = toStr(r["sitename"] ?? r["SiteName"] ?? r["site_name"] ?? "");
    if (!sitename || siteMap.has(sitename)) continue;
    const meta = metaMap.get(sitename);
    siteMap.set(sitename, {
      sqft: meta?.sqft ?? toNum(r["grossarea"] ?? r["GrossArea"] ?? 0),
      type: meta?.type ?? "Building",
      code: toStr(r["simscode"] ?? r["SIMSCode"] ?? ""),
    });
  }

  const buildings: Building[] = Array.from(siteMap.entries()).map(([name, info]) => ({
    id: info.code || name,
    name,
    sqft: info.sqft,
    type: info.type,
  }));

  // ── Hourly data ──
  const hourlyMap = new Map<string, { kwh: number; temps: number[]; ts: Date }>();
  for (const r of elecRows) {
    const d = toDate(r["readingtime"] ?? r["ReadingTime"] ?? r["timestamp"] ?? r["date"]);
    if (!d) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
    const existing = hourlyMap.get(key) || { kwh: 0, temps: [], ts: d };
    existing.kwh += toNum(r["readingvalue"] ?? r["ReadingValue"] ?? r["electricity_kwh"] ?? 0);
    const temp = toNum(r["temperature_2m"] ?? r["Temperature"] ?? r["temp"] ?? NaN);
    if (!isNaN(temp) && temp !== 0) existing.temps.push(temp);
    hourlyMap.set(key, existing);
  }

  const startTime = elecRows.reduce((min, r) => {
    const d = toDate(r["readingtime"] ?? r["ReadingTime"] ?? r["timestamp"] ?? r["date"]);
    const t = d?.getTime() ?? Infinity;
    return t < min ? t : min;
  }, Infinity);
  const startDate = isFinite(startTime) ? new Date(startTime) : new Date(2025, 0, 1);

  const sortedHourlyKeys = Array.from(hourlyMap.keys()).sort((a, b) => {
    const pa = a.split("-").map(Number);
    const pb = b.split("-").map(Number);
    return (
      new Date(pa[0], pa[1], pa[2], pa[3]).getTime() -
      new Date(pb[0], pb[1], pb[2], pb[3]).getTime()
    );
  });

  const hourlyData: HourlyEntry[] = sortedHourlyKeys.map((key) => {
    const parts = key.split("-").map(Number);
    const d = new Date(parts[0], parts[1], parts[2], parts[3]);
    const entry = hourlyMap.get(key)!;
    const avgTemp =
      entry.temps.length > 0 ? entry.temps.reduce((s, t) => s + t, 0) / entry.temps.length : 0;
    const dayOffset = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      timestamp: d.toISOString(),
      hour: d.getHours(),
      day: dayOffset,
      totalKwh: Math.round(entry.kwh),
      temperature: Math.round(avgTemp * 10) / 10,
    };
  });

  // ── Daily aggregation ──
  const dailyMap = new Map<string, { kwh: number; temps: number[]; date: Date }>();
  for (const h of hourlyData) {
    const d = new Date(h.timestamp);
    const dateKey = d.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey) || { kwh: 0, temps: [], date: d };
    existing.kwh += h.totalKwh;
    if (h.temperature) existing.temps.push(h.temperature);
    dailyMap.set(dateKey, existing);
  }

  // Supplement with weather_daily_selected if daily map is thin on temps
  for (const row of weatherDaily.rows) {
    const dateVal = toStr(row["date"] ?? row["Date"] ?? row["time"] ?? "");
    if (!dateVal) continue;
    const d = toDate(dateVal);
    if (!d) continue;
    const dateKey = d.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey);
    if (existing && existing.temps.length === 0) {
      const temp = toNum(row["temperature_2m"] ?? row["temperature"] ?? row["avg_temp"] ?? NaN);
      if (!isNaN(temp) && temp !== 0) existing.temps.push(temp);
    }
  }

  const dailyData: DailyEntry[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, val]) => ({
      date: dateKey,
      label: val.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      totalKwh: Math.round(val.kwh),
      avgTemperature:
        val.temps.length > 0
          ? Math.round((val.temps.reduce((s, t) => s + t, 0) / val.temps.length) * 10) / 10
          : 0,
    }));

  // ── Per-building consumption ──
  const buildingStatsMap = new Map<string, { totalKwh: number; count: number; intensity: number }>();
  for (const r of elecRows) {
    const sitename = toStr(r["sitename"] ?? r["SiteName"] ?? r["site_name"] ?? "");
    if (!sitename) continue;
    const existing = buildingStatsMap.get(sitename) || {
      totalKwh: 0,
      count: 0,
      intensity: toNum(r["kwh_per_sqft"] ?? 0),
    };
    existing.totalKwh += toNum(r["readingvalue"] ?? r["ReadingValue"] ?? r["electricity_kwh"] ?? 0);
    existing.count += 1;
    const kps = toNum(r["kwh_per_sqft"] ?? NaN);
    if (!isNaN(kps) && kps > 0) existing.intensity = kps;
    buildingStatsMap.set(sitename, existing);
  }

  const buildingConsumption: BuildingConsumption[] = buildings.map((b) => {
    const stats = buildingStatsMap.get(b.name);
    const totalKwh = stats?.totalKwh ?? 0;
    const count = stats?.count ?? 1;
    const avgHourlyKwh = Math.round(totalKwh / Math.max(count, 1));
    const intensity =
      stats?.intensity ?? (b.sqft > 0 ? Math.round((totalKwh / b.sqft) * 100) / 100 : 0);
    return {
      ...b,
      avgHourlyKwh,
      totalMonthlyKwh: Math.round(totalKwh),
      intensityKwhPerSqft: Math.round(intensity * 100) / 100,
    };
  });

  // ── Temp vs electricity scatter ──
  const tempVsElectricity: TempVsElectricity[] = dailyData
    .filter((d) => d.avgTemperature !== 0)
    .map((d) => ({ temperature: d.avgTemperature, electricity: d.totalKwh, date: d.label }));

  // ── Pearson correlation ──
  let weatherCorrelation = 0;
  if (tempVsElectricity.length > 2) {
    const n = tempVsElectricity.length;
    const meanT = tempVsElectricity.reduce((s, d) => s + d.temperature, 0) / n;
    const meanE = tempVsElectricity.reduce((s, d) => s + d.electricity, 0) / n;
    let num = 0, denT = 0, denE = 0;
    for (const d of tempVsElectricity) {
      const dt = d.temperature - meanT;
      const de = d.electricity - meanE;
      num += dt * de;
      denT += dt * dt;
      denE += de * de;
    }
    const denom = Math.sqrt(denT * denE);
    weatherCorrelation = denom > 0 ? Math.round((num / denom) * 100) / 100 : 0;
  }

  // ── Summary metrics ──
  const summaryMetrics: SummaryMetrics = {
    totalMonthlyMwh: Math.round(dailyData.reduce((s, d) => s + d.totalKwh, 0) / 1000),
    buildingsMonitored: buildings.length,
    avgIntensity:
      buildingConsumption.length > 0
        ? Math.round(
            (buildingConsumption.reduce((s, b) => s + b.intensityKwhPerSqft, 0) /
              buildingConsumption.length) *
              100
          ) / 100
        : 0,
    peakDemandKw: hourlyData.length > 0 ? Math.max(...hourlyData.map((d) => d.totalKwh)) : 0,
    weatherCorrelation,
  };

  // ── Month-over-month building changes ──
  const buildingMonthMap = new Map<string, Map<string, number>>();
  for (const r of elecRows) {
    const sitename = toStr(r["sitename"] ?? r["SiteName"] ?? r["site_name"] ?? "");
    const d = toDate(r["readingtime"] ?? r["ReadingTime"] ?? r["timestamp"] ?? r["date"]);
    if (!d || !sitename) continue;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buildingMonthMap.has(sitename)) buildingMonthMap.set(sitename, new Map());
    const months = buildingMonthMap.get(sitename)!;
    months.set(
      monthKey,
      (months.get(monthKey) || 0) + toNum(r["readingvalue"] ?? r["ReadingValue"] ?? r["electricity_kwh"] ?? 0)
    );
  }

  const buildingMoMChanges: BuildingMoMChange[] = [];
  for (const [sitename, months] of buildingMonthMap) {
    const sortedMonths = Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (let i = 1; i < sortedMonths.length; i++) {
      const [prevKey, prevKwh] = sortedMonths[i - 1];
      const [currKey, currKwh] = sortedMonths[i];
      const changeKwh = currKwh - prevKwh;
      const changePct = prevKwh > 0 ? Math.round((changeKwh / prevKwh) * 10000) / 100 : 0;
      const fmtMonth = (k: string) => {
        const [y, m] = k.split("-");
        return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      };
      buildingMoMChanges.push({
        name: sitename,
        prevMonthKwh: Math.round(prevKwh),
        currMonthKwh: Math.round(currKwh),
        changeKwh: Math.round(changeKwh),
        changePct,
        prevMonthLabel: fmtMonth(prevKey),
        currMonthLabel: fmtMonth(currKey),
      });
    }
  }

  // ── Next-month predictions (linear extrapolation) ──
  const buildingPredictions: BuildingPrediction[] = [];
  for (const [sitename, months] of buildingMonthMap) {
    const sortedMonths = Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b));
    if (sortedMonths.length < 2) continue;
    const lastMonthEntry = sortedMonths[sortedMonths.length - 1];
    const lastMonthKwh = lastMonthEntry[1];
    const lastMonthKey = lastMonthEntry[0];
    const pctChanges: number[] = [];
    for (let i = 1; i < sortedMonths.length; i++) {
      const prev = sortedMonths[i - 1][1];
      const curr = sortedMonths[i][1];
      if (prev > 0) pctChanges.push((curr - prev) / prev);
    }
    const avgMoMChange =
      pctChanges.length > 0 ? pctChanges.reduce((s, v) => s + v, 0) / pctChanges.length : 0;
    const predictedKwh = Math.max(0, lastMonthKwh * (1 + avgMoMChange));
    const [y, m] = lastMonthKey.split("-").map(Number);
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const predictedMonthLabel = new Date(nextYear, nextMonth - 1).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    buildingPredictions.push({
      name: sitename,
      lastMonthKwh: Math.round(lastMonthKwh),
      predictedKwh: Math.round(predictedKwh),
      avgMoMChangePct: Math.round(avgMoMChange * 10000) / 100,
      predictedMonthLabel,
    });
  }
  buildingPredictions.sort((a, b) => b.predictedKwh - a.predictedKwh);

  return {
    data: {
      buildings,
      hourlyData,
      dailyData,
      buildingConsumption,
      tempVsElectricity,
      summaryMetrics,
      buildingMoMChanges,
      buildingPredictions,
    },
    info,
  };
}
