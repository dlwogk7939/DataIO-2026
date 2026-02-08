/**
 * CSV Data Parser
 *
 * Parses the five required CSV files and builds a unified ParsedData object
 * that all visualization components consume.
 *
 * Required files & authoritative column schemas:
 *  1. meter_premerge_selected.csv
 *     → simscode, utility, readingtime, readingunits, readingunitsdisplay, readingwindowsum
 *  2. meter_building_merged.csv
 *     → simscode, utility, readingtime, readingunits, readingunitsdisplay, readingwindowsum,
 *       buildingnumber, buildingname, campusname, city, latitude, longitude
 *  3. meter_building_weather_merged.csv  (PRIMARY)
 *     → simscode, utility, readingtime, readingunits, readingunitsdisplay, readingwindowsum,
 *       buildingnumber, buildingname, campusname, address, city, state, postalcode, county,
 *       formalname, alsoknownas, grossarea, floorsaboveground, floorsbelowground,
 *       constructiondate, latitude, longitude,
 *       date, temperature_2m, shortwave_radiation, relative_humidity_2m, precipitation,
 *       wind_speed_10m, cloud_cover, cdd, hdd
 *  4. building_metadata_selected.csv
 *     → buildingnumber, buildingname, campusname, city, latitude, longitude
 *  5. weather_daily_selected.csv
 *     → date, temperature_2m, shortwave_radiation, relative_humidity_2m, precipitation,
 *       wind_speed_10m, cloud_cover, cdd, hdd
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
  BuildingMonthlyKwh,
  UtilityMonthlyEntry,
  BuildingWeatherEntry,
  WeatherModelResult,
} from "./csvParser";

// ── Required file definitions ──────────────────────────────────────────────

export const REQUIRED_FILES = [
  "meter_premerge_selected.csv",
  "meter_building_merged.csv",
  "meter_building_weather_merged.csv",
  "building_metadata_selected.csv",
  "weather_daily_selected.csv",
] as const;

export type RequiredFileName = (typeof REQUIRED_FILES)[number];

export const FILE_KEYS: Record<RequiredFileName, string> = {
  "meter_premerge_selected.csv": "meterPremerge",
  "meter_building_merged.csv": "meterBuilding",
  "meter_building_weather_merged.csv": "meterBuildingWeather",
  "building_metadata_selected.csv": "buildingMetadata",
  "weather_daily_selected.csv": "weatherDaily",
};

export const FILE_DESCRIPTIONS: Record<RequiredFileName, string> = {
  "meter_premerge_selected.csv": "Raw smart meter readings",
  "meter_building_merged.csv": "Meter data merged with building info",
  "meter_building_weather_merged.csv": "Meter + building + weather data",
  "building_metadata_selected.csv": "Building metadata (area, type)",
  "weather_daily_selected.csv": "Daily weather observations",
};

// ── Expected columns per file (for validation) ────────────────────────────

const EXPECTED_COLUMNS: Record<RequiredFileName, string[]> = {
  "meter_premerge_selected.csv": [
    "simscode", "utility", "readingtime", "readingunits", "readingunitsdisplay", "readingwindowsum",
  ],
  "meter_building_merged.csv": [
    "simscode", "utility", "readingtime", "readingunits", "readingunitsdisplay", "readingwindowsum",
    "buildingnumber", "buildingname", "campusname", "city", "latitude", "longitude",
  ],
  "meter_building_weather_merged.csv": [
    "simscode", "utility", "readingtime", "readingunits", "readingunitsdisplay", "readingwindowsum",
    "buildingnumber", "buildingname", "grossarea", "temperature_2m",
  ],
  "building_metadata_selected.csv": [
    "buildingnumber", "buildingname",
  ],
  "weather_daily_selected.csv": [
    "date", "temperature_2m",
  ],
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

function normalizeColumnName(key: string): string {
  return key.replace(/^\uFEFF/, "").trim();
}

function sanitizeColumns(columns: string[]): string[] {
  return columns.map(normalizeColumnName).filter((c) => c.length > 0);
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    normalized[normalizeColumnName(k)] = v;
  }
  return normalized;
}

function isLikelyFileReadIssueMessage(message: string): boolean {
  return /requested file could not be read|notreadableerror|permission problems/i.test(message);
}

function formatFileReadError(fileName: string, err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err ?? "Unknown file parse error");
  const alreadyPrefixed = message.startsWith(`${fileName}:`);
  const alreadyHinted = /Re-select this file and try again/i.test(message);
  if (alreadyPrefixed && alreadyHinted) {
    return new Error(message);
  }
  if (isLikelyFileReadIssueMessage(message)) {
    if (alreadyHinted) {
      return new Error(alreadyPrefixed ? message : `${fileName}: ${message}`);
    }
    return new Error(
      `${fileName}: ${message} Re-select this file and try again (the file may have been regenerated after selection).`
    );
  }
  return new Error(alreadyPrefixed ? message : `${fileName}: ${message}`);
}

function parseCsvFile(file: File): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // we handle numeric conversion explicitly
      worker: true,
      complete: (results) => {
        const columns = sanitizeColumns(results.meta.fields ?? []);
        const rows = (results.data as Record<string, unknown>[]).map(normalizeRowKeys);
        resolve({ rows, columns });
      },
      error: (err: unknown) => reject(formatFileReadError(file.name, err)),
    });
  });
}

async function parseCsvHeader(file: File): Promise<string[]> {
  try {
    const columns = await new Promise<string[]>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        preview: 1,
        skipEmptyLines: true,
        dynamicTyping: false,
        worker: true,
        complete: (results) => {
          resolve(sanitizeColumns(results.meta.fields ?? []));
        },
        error: (err: unknown) => reject(formatFileReadError(file.name, err)),
      });
    });

    if (columns.length > 0) return columns;
  } catch (err) {
    throw formatFileReadError(file.name, err);
  }

  // Fallback for browsers that fail to return meta.fields on the first parse pass.
  const sample = await file.slice(0, 512 * 1024).text();
  const firstLine = sample
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) {
    throw new Error(`${file.name}: header row is empty.`);
  }

  const fallback = Papa.parse<string[]>(firstLine, {
    header: false,
    skipEmptyLines: true,
  });
  const row = (fallback.data?.[0] ?? []) as string[];
  const columns = sanitizeColumns(row);
  if (columns.length === 0) {
    throw new Error(`${file.name}: failed to detect CSV header columns.`);
  }
  return columns;
}

interface PrimaryParseResult {
  columns: string[];
  rowCount: number;
  elecRowCount: number;
  utilitySamples: string[];
  earliestTsMs: number;
  siteMap: Map<string, { grossarea: number; code: string }>;
  hourlyMap: Map<number, { kwh: number; tempSum: number; tempCount: number }>;
  dailyWeatherMap: Map<string, { precipSum: number; precipCount: number; windSum: number; windCount: number }>;
  buildingStatsMap: Map<string, { totalKwh: number; count: number; grossarea: number }>;
  buildingMonthMap: Map<string, Map<string, number>>;
  utilityMonthAggMap: Map<string, Map<string, { total: number; unit: string }>>;
  bwMap: Map<
    string,
    {
      kwh: number;
      tempSum: number;
      tempCount: number;
      precipSum: number;
      precipCount: number;
      windSum: number;
      windCount: number;
      date: string;
      building: string;
    }
  >;
}

function isElectricityUtility(utility: string): boolean {
  const upper = utility.toUpperCase();
  return upper === "ELECTRICITY" || upper === "ELECTRIC" || upper.includes("ELEC");
}

function parsePrimaryCsv(file: File): Promise<PrimaryParseResult> {
  return new Promise((resolve, reject) => {
    const utilitySamples = new Set<string>();
    const siteMap = new Map<string, { grossarea: number; code: string }>();
    const hourlyMap = new Map<number, { kwh: number; tempSum: number; tempCount: number }>();
    const dailyWeatherMap = new Map<
      string,
      { precipSum: number; precipCount: number; windSum: number; windCount: number }
    >();
    const buildingStatsMap = new Map<string, { totalKwh: number; count: number; grossarea: number }>();
    const buildingMonthMap = new Map<string, Map<string, number>>();
    const utilityMonthAggMap = new Map<string, Map<string, { total: number; unit: string }>>();
    const bwMap = new Map<
      string,
      {
        kwh: number;
        tempSum: number;
        tempCount: number;
        precipSum: number;
        precipCount: number;
        windSum: number;
        windCount: number;
        date: string;
        building: string;
      }
    >();

    let columns: string[] = [];
    let rowCount = 0;
    let elecRowCount = 0;
    let earliestTsMs = Infinity;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      worker: true,
      step: (results) => {
        if (columns.length === 0) {
          columns = sanitizeColumns(results.meta.fields ?? []);
        }

        const row = normalizeRowKeys(results.data as Record<string, unknown>);
        if (!row || Object.keys(row).length === 0) return;
        rowCount += 1;

        const utility = toStr(row["utility"]).trim();
        const readingDate = toDate(row["readingtime"]);

        if (utility) {
          if (utilitySamples.size < 25) utilitySamples.add(utility);
          if (readingDate) {
            const monthKey = `${readingDate.getFullYear()}-${String(
              readingDate.getMonth() + 1
            ).padStart(2, "0")}`;
            if (!utilityMonthAggMap.has(utility)) utilityMonthAggMap.set(utility, new Map());
            const utilityMonths = utilityMonthAggMap.get(utility)!;
            const existing =
              utilityMonths.get(monthKey) || {
                total: 0,
                unit: toStr(row["readingunitsdisplay"]) || toStr(row["readingunits"]) || "kWh",
              };
            existing.total += toNum(row["readingwindowsum"]);
            utilityMonths.set(monthKey, existing);
          }
        }

        if (!utility || !isElectricityUtility(utility) || !readingDate) return;
        elecRowCount += 1;

        const tsMs = readingDate.getTime();
        if (tsMs < earliestTsMs) earliestTsMs = tsMs;

        const readingSum = toNum(row["readingwindowsum"]);
        const temperature = toNum(row["temperature_2m"]);
        const precipitation = toNum(row["precipitation"]);
        const windSpeed = toNum(row["wind_speed_10m"]);
        const buildingName = toStr(row["buildingname"]);
        const grossarea = toNum(row["grossarea"]);
        const simscode = toStr(row["simscode"]);

        if (buildingName && !siteMap.has(buildingName)) {
          siteMap.set(buildingName, { grossarea, code: simscode });
        }

        const hourTs = new Date(
          readingDate.getFullYear(),
          readingDate.getMonth(),
          readingDate.getDate(),
          readingDate.getHours()
        ).getTime();
        const hourAgg = hourlyMap.get(hourTs) || { kwh: 0, tempSum: 0, tempCount: 0 };
        hourAgg.kwh += readingSum;
        if (temperature !== 0) {
          hourAgg.tempSum += temperature;
          hourAgg.tempCount += 1;
        }
        hourlyMap.set(hourTs, hourAgg);

        const dateKey = readingDate.toISOString().split("T")[0];
        const weatherAgg =
          dailyWeatherMap.get(dateKey) || { precipSum: 0, precipCount: 0, windSum: 0, windCount: 0 };
        if (precipitation !== 0) {
          weatherAgg.precipSum += precipitation;
          weatherAgg.precipCount += 1;
        }
        if (windSpeed !== 0) {
          weatherAgg.windSum += windSpeed;
          weatherAgg.windCount += 1;
        }
        dailyWeatherMap.set(dateKey, weatherAgg);

        if (buildingName) {
          const buildingAgg = buildingStatsMap.get(buildingName) || {
            totalKwh: 0,
            count: 0,
            grossarea,
          };
          buildingAgg.totalKwh += readingSum;
          buildingAgg.count += 1;
          if (buildingAgg.grossarea === 0) buildingAgg.grossarea = grossarea;
          buildingStatsMap.set(buildingName, buildingAgg);

          const monthKey = `${readingDate.getFullYear()}-${String(
            readingDate.getMonth() + 1
          ).padStart(2, "0")}`;
          if (!buildingMonthMap.has(buildingName)) buildingMonthMap.set(buildingName, new Map());
          const monthAgg = buildingMonthMap.get(buildingName)!;
          monthAgg.set(monthKey, (monthAgg.get(monthKey) || 0) + readingSum);

          const bwKey = `${buildingName}||${dateKey}`;
          const bwAgg = bwMap.get(bwKey) || {
            kwh: 0,
            tempSum: 0,
            tempCount: 0,
            precipSum: 0,
            precipCount: 0,
            windSum: 0,
            windCount: 0,
            date: dateKey,
            building: buildingName,
          };
          bwAgg.kwh += readingSum;
          if (temperature !== 0) {
            bwAgg.tempSum += temperature;
            bwAgg.tempCount += 1;
          }
          bwAgg.precipSum += precipitation;
          bwAgg.precipCount += 1;
          bwAgg.windSum += windSpeed;
          bwAgg.windCount += 1;
          bwMap.set(bwKey, bwAgg);
        }
      },
      complete: (results) => {
        if (columns.length === 0) columns = sanitizeColumns(results.meta.fields ?? []);
        resolve({
          columns,
          rowCount,
          elecRowCount,
          utilitySamples: Array.from(utilitySamples),
          earliestTsMs,
          siteMap,
          hourlyMap,
          dailyWeatherMap,
          buildingStatsMap,
          buildingMonthMap,
          utilityMonthAggMap,
          bwMap,
        });
      },
      error: (err: unknown) => reject(formatFileReadError(file.name, err)),
    });
  });
}

const NUMERIC_FIELDS = new Set([
  "readingwindowsum", "grossarea", "temperature_2m", "shortwave_radiation",
  "relative_humidity_2m", "precipitation", "wind_speed_10m", "cloud_cover",
  "cdd", "hdd", "latitude", "longitude", "floorsaboveground", "floorsbelowground",
]);

function toNum(val: unknown): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (val == null || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toStr(val: unknown): string {
  return val == null ? "" : String(val).trim();
}

function toDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (val == null || val === "") return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * clamp(q, 0, 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

function isUtilityLikeBuildingName(name: string): boolean {
  return /substation|plant|utility|central|chiller|boiler|power|service|garage|parking|tunnel|steam/i.test(
    name
  );
}

const WEATHER_MODEL_BUILDING_TOKENS = [
  "thompson library",
  "recreation and physical activity center",
  "rpac",
  "knowlton hall",
  "hitchcock hall",
  "ohio union",
];

function isPreferredWeatherModelBuilding(name: string): boolean {
  const lower = name.toLowerCase();
  return WEATHER_MODEL_BUILDING_TOKENS.some((token) => lower.includes(token));
}

/** Validate that a parsed CSV contains the minimum required columns */
function validateColumns(
  fileName: RequiredFileName,
  actualColumns: string[],
): string | null {
  const expected = EXPECTED_COLUMNS[fileName];
  const lower = new Set(actualColumns.map((c) => c.toLowerCase().trim()));
  const missing = expected.filter((c) => !lower.has(c));
  if (missing.length > 0) {
    return `${fileName} is missing required columns: ${missing.join(", ")}. Found columns: ${actualColumns.join(", ")}`;
  }
  return null;
}

// ── Main parse function ────────────────────────────────────────────────────

export interface ParseResult {
  data: ParsedData;
  info: AllCsvInfo;
}

export async function parseAllCsvFiles(
  files: Record<RequiredFileName, File>
): Promise<ParseResult> {
  const info: AllCsvInfo = {};

  // Validate headers first. This avoids expensive full-file parsing for large CSVs.
  const headersByFile = {} as Record<RequiredFileName, string[]>;
  let weatherHeaderReadIssue: string | null = null;
  for (const fileName of REQUIRED_FILES) {
    try {
      const columns = await parseCsvHeader(files[fileName]);
      headersByFile[fileName] = columns;
      const headerErr = validateColumns(fileName, columns);
      if (headerErr) throw new Error(headerErr);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        fileName === "meter_building_weather_merged.csv" &&
        isLikelyFileReadIssueMessage(message)
      ) {
        // Do not fail immediately; we'll fall back to meter_building_merged.csv as primary.
        headersByFile[fileName] = [];
        weatherHeaderReadIssue = message;
        continue;
      }
      throw err;
    }
  }

  // Small files are parsed fully.
  const buildingMeta = await parseCsvFile(files["building_metadata_selected.csv"]);
  const weatherDaily = await parseCsvFile(files["weather_daily_selected.csv"]);

  // Primary large file is parsed in streaming mode to avoid browser memory spikes.
  // If weather-merged file can't be read by the browser, fall back to meter_building_merged.csv.
  let primary = null as PrimaryParseResult | null;
  let primarySource: "meter_building_weather_merged.csv" | "meter_building_merged.csv" =
    "meter_building_weather_merged.csv";
  try {
    primary = await parsePrimaryCsv(files["meter_building_weather_merged.csv"]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isLikelyFileReadIssueMessage(message)) {
      throw err;
    }
    primarySource = "meter_building_merged.csv";
    primary = await parsePrimaryCsv(files["meter_building_merged.csv"]);
  }

  info.meterPremerge = {
    fileName: files["meter_premerge_selected.csv"].name,
    rowCount: -1,
    columns: headersByFile["meter_premerge_selected.csv"],
    fileSizeBytes: files["meter_premerge_selected.csv"].size,
  };
  info.meterBuilding = {
    fileName: files["meter_building_merged.csv"].name,
    rowCount: -1,
    columns: headersByFile["meter_building_merged.csv"],
    fileSizeBytes: files["meter_building_merged.csv"].size,
  };
  info.meterBuildingWeather = {
    fileName: files["meter_building_weather_merged.csv"].name,
    rowCount: primarySource === "meter_building_weather_merged.csv" ? primary.rowCount : -1,
    columns:
      headersByFile["meter_building_weather_merged.csv"].length > 0
        ? headersByFile["meter_building_weather_merged.csv"]
        : ["(unreadable in browser session)"],
    fileSizeBytes: files["meter_building_weather_merged.csv"].size,
  };
  info.buildingMetadata = {
    fileName: files["building_metadata_selected.csv"].name,
    rowCount: buildingMeta.rows.length,
    columns: buildingMeta.columns,
    fileSizeBytes: files["building_metadata_selected.csv"].size,
  };
  info.weatherDaily = {
    fileName: files["weather_daily_selected.csv"].name,
    rowCount: weatherDaily.rows.length,
    columns: weatherDaily.columns,
    fileSizeBytes: files["weather_daily_selected.csv"].size,
  };

  if (primary.elecRowCount === 0) {
    throw new Error(
      `No electricity rows found in ${primarySource}. ` +
        'Expected column "utility" to contain "ELECTRICITY". ' +
        `Found unique utility values: ${primary.utilitySamples.join(", ")}`
    );
  }
  if (weatherHeaderReadIssue) {
    console.warn(
      "meter_building_weather_merged.csv was unreadable in this browser session; using meter_building_merged.csv as fallback source.",
      weatherHeaderReadIssue
    );
  }

  // Build a building metadata lookup from building_metadata_selected.csv
  const metaMap = new Map<string, { grossarea: number }>();
  for (const row of buildingMeta.rows) {
    const name = toStr(row["buildingname"]);
    if (!name) continue;
    metaMap.set(name, { grossarea: toNum(row["grossarea"]) });
  }

  function classifyBuildingType(n: string): string {
    const lower = n.toLowerCase();
    if (
      /substation|plant|utility|central|chiller|boiler|power|service|garage|parking|tunnel|steam/.test(
        lower
      )
    )
      return "Utility";
    if (/lab|research|science|chemistry|physics|biology|engineering|medical|hospital|veterinar/.test(lower))
      return "Labs";
    if (/residence|dorm|living|apartment/.test(lower)) return "Residential";
    if (/stadium|arena|recreation|gym|athletic|field|wellness|aquatic|ice|golf/.test(lower))
      return "Athletics";
    return "Academic";
  }

  const buildings: Building[] = Array.from(primary.siteMap.entries()).map(([name, infoItem]) => {
    const meta = metaMap.get(name);
    const grossarea = infoItem.grossarea || meta?.grossarea || 0;
    return {
      id: infoItem.code || name,
      name,
      sqft: grossarea,
      type: classifyBuildingType(name),
    };
  });

  // Hourly aggregation from streamed map
  const startDate = isFinite(primary.earliestTsMs) ? new Date(primary.earliestTsMs) : new Date(2025, 0, 1);
  const sortedHourTs = Array.from(primary.hourlyMap.keys()).sort((a, b) => a - b);
  const hourlyData: HourlyEntry[] = sortedHourTs.map((hourTs) => {
    const d = new Date(hourTs);
    const entry = primary.hourlyMap.get(hourTs)!;
    const avgTemp = entry.tempCount > 0 ? entry.tempSum / entry.tempCount : 0;
    const dayOffset = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      timestamp: d.toISOString(),
      hour: d.getHours(),
      day: dayOffset,
      totalKwh: Math.round(entry.kwh),
      temperature: Math.round(avgTemp * 10) / 10,
    };
  });

  // Daily aggregation from hourly series (keeps behavior consistent with previous implementation)
  const dailyMap = new Map<string, { kwh: number; tempSum: number; tempCount: number; date: Date }>();
  for (const h of hourlyData) {
    const d = new Date(h.timestamp);
    const dateKey = d.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey) || { kwh: 0, tempSum: 0, tempCount: 0, date: d };
    existing.kwh += h.totalKwh;
    if (h.temperature !== 0) {
      existing.tempSum += h.temperature;
      existing.tempCount += 1;
    }
    dailyMap.set(dateKey, existing);
  }

  // Supplement with weather_daily_selected.csv if daily map is thin on temps/precip/wind
  for (const row of weatherDaily.rows) {
    const dateVal = toStr(row["date"]);
    if (!dateVal) continue;
    const d = toDate(dateVal);
    if (!d) continue;
    const dateKey = d.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey);
    if (existing && existing.tempCount === 0) {
      const temp = toNum(row["temperature_2m"]);
      if (temp !== 0) {
        existing.tempSum += temp;
        existing.tempCount += 1;
      }
    }

    const currentWeather = primary.dailyWeatherMap.get(dateKey);
    if (
      !currentWeather ||
      (currentWeather.precipCount === 0 && currentWeather.windCount === 0)
    ) {
      const precip = toNum(row["precipitation"]);
      const wind = toNum(row["wind_speed_10m"]);
      const entry = { precipSum: 0, precipCount: 0, windSum: 0, windCount: 0 };
      if (precip !== 0) {
        entry.precipSum += precip;
        entry.precipCount += 1;
      }
      if (wind !== 0) {
        entry.windSum += wind;
        entry.windCount += 1;
      }
      if (entry.precipCount > 0 || entry.windCount > 0) {
        primary.dailyWeatherMap.set(dateKey, entry);
      }
    }
  }

  const dailyData: DailyEntry[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, val]) => {
      const weather = primary.dailyWeatherMap.get(dateKey);
      const avgPrecip =
        weather && weather.precipCount > 0
          ? Math.round((weather.precipSum / weather.precipCount) * 100) / 100
          : 0;
      const avgWind =
        weather && weather.windCount > 0
          ? Math.round((weather.windSum / weather.windCount) * 100) / 100
          : 0;
      return {
        date: dateKey,
        label: val.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        totalKwh: Math.round(val.kwh),
        avgTemperature:
          val.tempCount > 0 ? Math.round((val.tempSum / val.tempCount) * 10) / 10 : 0,
        avgPrecipitation: avgPrecip,
        avgWindSpeed: avgWind,
      };
    });

  const buildingConsumption: BuildingConsumption[] = buildings.map((b) => {
    const stats = primary.buildingStatsMap.get(b.name);
    const totalKwh = stats?.totalKwh ?? 0;
    const count = stats?.count ?? 1;
    const grossarea = stats?.grossarea || b.sqft || 0;
    const intensity = grossarea > 0 ? Math.round((totalKwh / grossarea) * 100) / 100 : 0;
    return {
      ...b,
      sqft: grossarea,
      avgHourlyKwh: Math.round(totalKwh / Math.max(count, 1)),
      totalMonthlyKwh: Math.round(totalKwh),
      intensityKwhPerSqft: intensity,
    };
  });

  const tempVsElectricity: TempVsElectricity[] = dailyData
    .filter((d) => d.avgTemperature !== 0)
    .map((d) => ({ temperature: d.avgTemperature, electricity: d.totalKwh, date: d.label }));

  let weatherCorrelation = 0;
  if (tempVsElectricity.length > 2) {
    const n = tempVsElectricity.length;
    const meanT = tempVsElectricity.reduce((s, d) => s + d.temperature, 0) / n;
    const meanE = tempVsElectricity.reduce((s, d) => s + d.electricity, 0) / n;
    let num = 0;
    let denT = 0;
    let denE = 0;
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

  const buildingMoMChanges: BuildingMoMChange[] = [];
  for (const [buildingname, months] of primary.buildingMonthMap) {
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
        name: buildingname,
        prevMonthKwh: Math.round(prevKwh),
        currMonthKwh: Math.round(currKwh),
        changeKwh: Math.round(changeKwh),
        changePct,
        prevMonthLabel: fmtMonth(prevKey),
        currMonthLabel: fmtMonth(currKey),
      });
    }
  }

  const buildingMonthlyData: BuildingMonthlyKwh[] = [];
  for (const [buildingname, months] of primary.buildingMonthMap) {
    const sortedMonths = Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [monthKey, kwh] of sortedMonths) {
      const [yy, mm] = monthKey.split("-").map(Number);
      const ml = new Date(yy, mm - 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      buildingMonthlyData.push({ name: buildingname, monthKey, monthLabel: ml, kwh: Math.round(kwh) });
    }
  }

  const buildingPredictions: BuildingPrediction[] = [];
  for (const [buildingname, months] of primary.buildingMonthMap) {
    const sortedMonths = Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b));
    if (sortedMonths.length < 2) continue;

    const positiveValues = sortedMonths
      .map(([, kwh]) => Math.max(0, kwh))
      .filter((kwh) => kwh > 0);
    if (positiveValues.length < 2) continue;

    const positiveRecentMedian = median(positiveValues.slice(-6));
    const validMonthFloorKwh = Math.max(10_000, positiveRecentMedian * 0.2);
    const validMonths = sortedMonths.filter(([, kwh]) => Math.max(0, kwh) >= validMonthFloorKwh);
    const effectiveMonths =
      validMonths.length >= 2
        ? validMonths
        : sortedMonths.filter(([, kwh]) => Math.max(0, kwh) > 0);
    if (effectiveMonths.length < 2) continue;

    const lastMonthEntry = effectiveMonths[effectiveMonths.length - 1];
    const lastMonthKwh = Math.max(0, lastMonthEntry[1]);
    const lastMonthKey = lastMonthEntry[0];
    const monthlyKwh = effectiveMonths.map(([, kwh]) => Math.max(0, kwh));
    const recentKwh = monthlyKwh.slice(-6);
    const recentMean = recentKwh.reduce((sum, value) => sum + value, 0) / recentKwh.length;
    const recentMedian = median(recentKwh);
    const baselineFloorKwh = Math.max(10_000, recentMedian * 0.2);
    const pctChanges: number[] = [];

    for (let i = 1; i < effectiveMonths.length; i++) {
      const prev = Math.max(0, effectiveMonths[i - 1][1]);
      const curr = Math.max(0, effectiveMonths[i][1]);
      if (prev < baselineFloorKwh) continue;
      const pctChange = (curr - prev) / prev;
      if (Math.abs(pctChange) <= 0.4) {
        pctChanges.push(pctChange);
      }
    }

    const robustMoMChange = pctChanges.length > 0 ? median(pctChanges) : 0;
    const baselineKwh = lastMonthKwh * 0.65 + recentMean * 0.35;
    const rawPredictedKwh = baselineKwh * (1 + robustMoMChange);
    const minPredictedKwh = lastMonthKwh * 0.75;
    const maxPredictedKwh = Math.max(minPredictedKwh, lastMonthKwh * 1.25);
    const predictedKwh = clamp(rawPredictedKwh, minPredictedKwh, maxPredictedKwh);

    const [y, m] = lastMonthKey.split("-").map(Number);
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const predictedMonthLabel = new Date(nextYear, nextMonth - 1).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    buildingPredictions.push({
      name: buildingname,
      lastMonthKwh: Math.round(lastMonthKwh),
      predictedKwh: Math.round(predictedKwh),
      avgMoMChangePct: Math.round(robustMoMChange * 10000) / 100,
      predictedMonthLabel,
    });
  }
  buildingPredictions.sort((a, b) => b.lastMonthKwh - a.lastMonthKwh);

  const utilityMonthlyData: UtilityMonthlyEntry[] = [];
  const availableUtilities: string[] = [];
  for (const [utility, months] of primary.utilityMonthAggMap) {
    availableUtilities.push(utility);
    const sortedMonths = Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [monthKey, val] of sortedMonths) {
      const [yy, mm] = monthKey.split("-").map(Number);
      const ml = new Date(yy, mm - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      utilityMonthlyData.push({
        utility,
        monthKey,
        monthLabel: ml,
        totalUsage: Math.round(val.total),
        unit: val.unit,
      });
    }
  }
  availableUtilities.sort();

  const buildingWeatherData: BuildingWeatherEntry[] = [];
  const weatherDailyByDate = new Map<string, { temp: number; precip: number; wind: number }>();
  for (const row of weatherDaily.rows) {
    const dateVal = toStr(row["date"]);
    const d = toDate(dateVal);
    if (!d) continue;
    const key = d.toISOString().split("T")[0];
    weatherDailyByDate.set(key, {
      temp: toNum(row["temperature_2m"]),
      precip: toNum(row["precipitation"]),
      wind: toNum(row["wind_speed_10m"]),
    });
  }

  for (const val of primary.bwMap.values()) {
    const fallbackWeather = weatherDailyByDate.get(val.date);
    if (val.tempCount === 0 && !fallbackWeather) continue;
    buildingWeatherData.push({
      buildingName: val.building,
      temperature:
        val.tempCount > 0
          ? Math.round((val.tempSum / val.tempCount) * 10) / 10
          : Math.round((fallbackWeather?.temp ?? 0) * 10) / 10,
      precipitation:
        val.precipCount > 0
          ? Math.round((val.precipSum / val.precipCount) * 100) / 100
          : Math.round((fallbackWeather?.precip ?? 0) * 100) / 100,
      windSpeed:
        val.windCount > 0
          ? Math.round((val.windSum / val.windCount) * 100) / 100
          : Math.round((fallbackWeather?.wind ?? 0) * 100) / 100,
      electricity: Math.round(val.kwh),
      date: val.date,
    });
  }

  const weatherModel = buildWeatherModel(buildingWeatherData);

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
      buildingMonthlyData,
      utilityMonthlyData,
      availableUtilities,
      buildingWeatherData,
      weatherModel,
    },
    info,
  };
}

// ── OLS Multivariate Linear Regression ──────────────────────────────────────

function buildWeatherModel(entries: BuildingWeatherEntry[]): WeatherModelResult | null {
  const baseUsableEntries = entries.filter(
    (e) =>
      Number.isFinite(e.electricity) &&
      e.electricity > 0 &&
      Number.isFinite(e.temperature) &&
      Number.isFinite(e.precipitation) &&
      Number.isFinite(e.windSpeed) &&
      !isUtilityLikeBuildingName(e.buildingName)
  );

  const preferredEntries = baseUsableEntries.filter((e) =>
    isPreferredWeatherModelBuilding(e.buildingName)
  );
  const usableEntries =
    preferredEntries.length >= 50 ? preferredEntries : baseUsableEntries;

  if (usableEntries.length < 10) return null;

  // Aggregate to daily totals across all buildings for the model
  const dailyAgg = new Map<string, { kwh: number; temp: number; precip: number; wind: number; count: number }>();
  for (const e of usableEntries) {
    const existing = dailyAgg.get(e.date) || { kwh: 0, temp: 0, precip: 0, wind: 0, count: 0 };
    existing.kwh += e.electricity;
    existing.temp += e.temperature;
    existing.precip += e.precipitation;
    existing.wind += e.windSpeed;
    existing.count += 1;
    dailyAgg.set(e.date, existing);
  }

  const rows = Array.from(dailyAgg.values())
    .filter((d) => d.count > 0)
    .map((d) => ({
      temp: d.temp / d.count,
      precip: d.precip / d.count,
      wind: d.wind / d.count,
      kwh: d.kwh,
      count: d.count,
    }));

  if (rows.length < 10) return null;

  // Remove low-coverage dates (partial ingestion days).
  const coverageCounts = rows.map((r) => r.count);
  const medianCoverage = median(coverageCounts);
  const minCoverage = Math.max(1, Math.floor(medianCoverage * 0.6));
  const coverageFilteredRows = rows.filter((r) => r.count >= minCoverage);
  if (coverageFilteredRows.length >= 10) {
    rows.length = 0;
    rows.push(...coverageFilteredRows);
  }

  // Remove very low daily totals that are likely incomplete ingest days.
  const positiveDailyKwh = rows.map((r) => r.kwh).filter((v) => v > 0);
  const lowTail = quantile(positiveDailyKwh, 0.05);
  const minDailyKwh = Math.max(10_000, lowTail * 0.5);
  const completenessFilteredRows = rows.filter((r) => r.kwh >= minDailyKwh);
  if (completenessFilteredRows.length >= 10) {
    rows.length = 0;
    rows.push(...completenessFilteredRows);
  }

  // Remove extreme daily-usage outliers before fitting.
  const kwhValues = rows.map((r) => r.kwh).filter((v) => Number.isFinite(v));
  const lowKwh = quantile(kwhValues, 0.01);
  const highKwh = quantile(kwhValues, 0.99);
  const filteredRows = rows.filter((r) => r.kwh >= lowKwh && r.kwh <= highKwh);
  if (filteredRows.length >= 10) {
    rows.length = 0;
    rows.push(...filteredRows);
  }

  // Standardize features and fit ridge-stabilized linear model.
  const meanTemp = rows.reduce((s, r) => s + r.temp, 0) / rows.length;
  const meanPrecip = rows.reduce((s, r) => s + r.precip, 0) / rows.length;
  const meanWind = rows.reduce((s, r) => s + r.wind, 0) / rows.length;
  const meanKwh = rows.reduce((s, r) => s + r.kwh, 0) / rows.length;

  const stdTemp = Math.sqrt(rows.reduce((s, r) => s + (r.temp - meanTemp) ** 2, 0) / rows.length) || 1;
  const stdPrecip = Math.sqrt(rows.reduce((s, r) => s + (r.precip - meanPrecip) ** 2, 0) / rows.length) || 1;
  const stdWind = Math.sqrt(rows.reduce((s, r) => s + (r.wind - meanWind) ** 2, 0) / rows.length) || 1;

  // Build standardized X matrix [1, zTemp, zPrecip, zWind] and y vector.
  // Ridge-style regularization keeps coefficients stable on collinear weather features.
  const X: number[][] = rows.map((r) => [
    1,
    (r.temp - meanTemp) / stdTemp,
    (r.precip - meanPrecip) / stdPrecip,
    (r.wind - meanWind) / stdWind,
  ]);
  const y: number[] = rows.map((r) => r.kwh);

  const XtX = matMul(transpose(X), X);
  const ridgeAlpha = 1.0;
  for (let i = 1; i < XtX.length; i++) {
    XtX[i][i] += ridgeAlpha;
  }
  const XtXInv = invert4x4(XtX);
  if (!XtXInv) return null;

  const Xty = matVecMul(transpose(X), y);
  const betaStd = XtXInv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
  const [stdIntercept, stdBTemp, stdBPrecip, stdBWind] = betaStd;
  const bTemp = stdBTemp / stdTemp;
  const bPrecip = stdBPrecip / stdPrecip;
  const bWind = stdBWind / stdWind;
  const intercept =
    stdIntercept - bTemp * meanTemp - bPrecip * meanPrecip - bWind * meanWind;

  const maxObservedKwh = Math.max(...rows.map((r) => r.kwh));
  const predictionCap = Math.max(1, quantile(rows.map((r) => r.kwh), 0.99) * 1.25, maxObservedKwh * 1.1);
  const predictKwh = (temp: number, precip: number, wind: number): number =>
    clamp(intercept + bTemp * temp + bPrecip * precip + bWind * wind, 0, predictionCap);

  // Predictions (clamped to physically plausible non-negative range)
  const predictions = rows.map((r) => ({
    actual: r.kwh,
    predicted: Math.round(predictKwh(r.temp, r.precip, r.wind)),
    temperature: r.temp,
    precipitation: r.precip,
    windSpeed: r.wind,
  }));

  // R²
  const ssRes = predictions.reduce((s, p) => s + (p.actual - p.predicted) ** 2, 0);
  const ssTot = rows.reduce((s, r) => s + (r.kwh - meanKwh) ** 2, 0);
  const r2 = ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 10000) / 10000 : 0;

  // Standardized coefficients for feature importance
  const stdCoeffs = [
    { feature: "Temperature", importance: 0, absCoeff: Math.abs(bTemp * stdTemp) },
    { feature: "Precipitation", importance: 0, absCoeff: Math.abs(bPrecip * stdPrecip) },
    { feature: "Wind Speed", importance: 0, absCoeff: Math.abs(bWind * stdWind) },
  ];
  const totalAbsCoeff = stdCoeffs.reduce((s, c) => s + c.absCoeff, 0) || 1;
  for (const c of stdCoeffs) {
    c.importance = Math.round((c.absCoeff / totalAbsCoeff) * 10000) / 100;
  }
  stdCoeffs.sort((a, b) => b.importance - a.importance);

  // Marginal effect of temperature (hold others at median)
  const tempRange = rows.map((r) => r.temp);
  const minTemp = Math.floor(Math.min(...tempRange));
  const maxTemp = Math.ceil(Math.max(...tempRange));
  const marginalEffect: WeatherModelResult["marginalEffect"] = [];
  for (let t = minTemp; t <= maxTemp; t += 2) {
    marginalEffect.push({
      temperature: t,
      predicted: Math.round(predictKwh(t, meanPrecip, meanWind)),
    });
  }

  // Scenario comparison: moderate (~70°F) vs extreme (~90°F)
  const scenarioComparison: WeatherModelResult["scenarioComparison"] = [
    {
      label: "Moderate (~70°F)",
      temperature: 70,
      predicted: Math.round(predictKwh(70, meanPrecip, meanWind)),
    },
    {
      label: "Extreme (~90°F)",
      temperature: 90,
      predicted: Math.round(predictKwh(90, meanPrecip, meanWind)),
    },
  ];

  // Heatmap: temperature vs wind speed grid
  const windRange = rows.map((r) => r.wind);
  const minWind = Math.floor(Math.min(...windRange));
  const maxWind = Math.ceil(Math.max(...windRange));
  const heatmapData: WeatherModelResult["heatmapData"] = [];
  const tempStep = Math.max(2, Math.round((maxTemp - minTemp) / 10));
  const windStep = Math.max(1, Math.round((maxWind - minWind) / 8)) || 1;
  for (let t = minTemp; t <= maxTemp; t += tempStep) {
    for (let w = minWind; w <= maxWind; w += windStep) {
      heatmapData.push({
        temperature: t,
        windSpeed: w,
        predicted: Math.round(predictKwh(t, meanPrecip, w)),
      });
    }
  }

  return {
    coefficients: { temperature: bTemp, precipitation: bPrecip, windSpeed: bWind, intercept },
    featureImportance: stdCoeffs,
    predictions,
    r2,
    marginalEffect,
    scenarioComparison,
    heatmapData,
  };
}

// ── Linear algebra helpers for 4×4 OLS ───────────────────────────────────────

function transpose(m: number[][]): number[][] {
  const rows = m.length;
  const cols = m[0].length;
  const result: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = m[i][j];
    }
  }
  return result;
}

function matMul(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const result: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

function matVecMul(m: number[][], v: number[]): number[] {
  return m.map((row) => row.reduce((s, val, j) => s + val * v[j], 0));
}

function invert4x4(m: number[][]): number[][] | null {
  const n = m.length;
  const aug: number[][] = m.map((row, i) => {
    const r = [...row];
    for (let j = 0; j < n; j++) r.push(i === j ? 1 : 0);
    return r;
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-10) return null;

    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map((row) => row.slice(n));
}
